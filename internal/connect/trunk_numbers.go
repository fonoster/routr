/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package connect

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nyaruka/phonenumbers"

	"github.com/fonoster/routr/internal/common/numbering"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// numberMatch is how the Number of a call on a Trunk was found
// (trace.numberMatch).
type numberMatch string

const (
	// The Request-URI user is the Number's telUrl
	matchExact numberMatch = "exact"
	// The Number's digits, without the +
	matchDigits numberMatch = "digits"
	// The Number in national form, read with the Number's country
	matchNational numberMatch = "national"
	// The Number after the international prefix of the Number's country
	matchInternational numberMatch = "international"
	// One of the Number's aliases
	matchAlias numberMatch = "alias"
)

// trunkIndexMaxAge is how long a Trunk's index answers before it is built
// again: a new Number reached by a non-exact form can take this long to match.
const trunkIndexMaxAge = 30 * time.Second

// trunkNumberIndex is what Connect knows of one Trunk's Numbers, read once by
// trunkRef: every call on the Trunk does map lookups on it, never a scan.
type trunkNumberIndex struct {
	builtAt time.Time
	// The digits of each Number's telUrl, without the +
	byDigits map[string][]*numbers.Number
	// Each alias, exact and case-sensitive
	byAlias map[string][]*numbers.Number
	// The upper-cased countryIsoCode, then the digits, of the Numbers of
	// each country
	byRegion map[string]map[string][]*numbers.Number
	// The keys of byRegion, sorted, so the national step is deterministic
	regions []string
}

// telDigits is the number of a tel URL without its +.
func telDigits(telURL string) string {
	return strings.TrimPrefix(telNumber(telURL), "+")
}

// newTrunkNumberIndex indexes a Trunk's Numbers.
func newTrunkNumberIndex(items []*numbers.Number, builtAt time.Time) *trunkNumberIndex {
	ix := &trunkNumberIndex{
		builtAt:  builtAt,
		byDigits: map[string][]*numbers.Number{},
		byAlias:  map[string][]*numbers.Number{},
		byRegion: map[string]map[string][]*numbers.Number{},
	}
	for _, n := range items {
		digits := telDigits(n.GetTelUrl())
		if digits != "" {
			ix.byDigits[digits] = append(ix.byDigits[digits], n)
		}
		for _, alias := range n.GetAliases() {
			ix.byAlias[alias] = append(ix.byAlias[alias], n)
		}
		region := numbering.Region(n.GetCountryIsoCode())
		if region == "" || digits == "" {
			continue
		}
		if ix.byRegion[region] == nil {
			ix.byRegion[region] = map[string][]*numbers.Number{}
			ix.regions = append(ix.regions, region)
		}
		ix.byRegion[region][digits] = append(ix.byRegion[region][digits], n)
	}
	sort.Strings(ix.regions)
	return ix
}

// trunkMatch is what the ladder found: a Number and how, or the Numbers a
// step found more than one of.
type trunkMatch struct {
	number    *numbers.Number
	match     numberMatch
	ambiguous []*numbers.Number
}

// candidates collects the distinct Numbers a step finds, by ref.
type candidates struct {
	refs  map[string]bool
	found []*numbers.Number
	match numberMatch
}

func (c *candidates) add(match numberMatch, items ...*numbers.Number) {
	for _, n := range items {
		if c.refs == nil {
			c.refs = map[string]bool{}
		}
		if c.refs[n.GetRef()] {
			continue
		}
		if len(c.found) == 0 {
			c.match = match
		}
		c.refs[n.GetRef()] = true
		c.found = append(c.found, n)
	}
}

// result ends a step: nil when it found nothing.
func (c *candidates) result() *trunkMatch {
	switch len(c.found) {
	case 0:
		return nil
	case 1:
		return &trunkMatch{number: c.found[0], match: c.match}
	}
	return &trunkMatch{ambiguous: c.found}
}

// match is the ladder after the exact lookup, strictest step first: the
// digits without the +; the national or international form, read once with
// each country of the Trunk's Numbers and counted only for a Number of that
// country; an alias. The user is read up to its first ";". A step that finds
// two Numbers ends the ladder, ambiguous. Nil when no step finds one.
func (ix *trunkNumberIndex) match(user string) *trunkMatch {
	user, _, _ = strings.Cut(user, ";")
	if user == "" {
		return nil
	}
	var digits candidates
	digits.add(matchDigits, ix.byDigits[strings.TrimPrefix(user, "+")]...)
	if found := digits.result(); found != nil {
		return found
	}
	var national candidates
	for _, region := range ix.regions {
		number, err := phonenumbers.ParseAndKeepRawInput(user, region)
		if err != nil {
			continue
		}
		e164 := strings.TrimPrefix(phonenumbers.Format(number, phonenumbers.E164), "+")
		match := matchNational
		if number.GetCountryCodeSource() == phonenumbers.PhoneNumber_FROM_NUMBER_WITH_IDD {
			match = matchInternational
		}
		national.add(match, ix.byRegion[region][e164]...)
	}
	if found := national.result(); found != nil {
		return found
	}
	var alias candidates
	alias.add(matchAlias, ix.byAlias[user]...)
	return alias.result()
}

// trunkIndexes are the indexes of the Trunks calls arrived on, by ref, each
// built when first needed and again once it is older than trunkIndexMaxAge.
type trunkIndexes struct {
	mu      sync.Mutex
	byTrunk map[string]*trunkNumberIndex
}

// trunkNumbers is the index of the Trunk's Numbers, from Numbers.FindBy
// trunkRef. Two calls that find it stale at once both build it; the last one
// stays.
func (c *Connect) trunkNumbers(ctx context.Context, trunkRef string) (*trunkNumberIndex, error) {
	now := c.now()
	c.trunkIndexes.mu.Lock()
	ix := c.trunkIndexes.byTrunk[trunkRef]
	c.trunkIndexes.mu.Unlock()
	if ix != nil && now.Sub(ix.builtAt) < trunkIndexMaxAge {
		return ix, nil
	}
	res, err := c.numbers.FindBy(ctx, &numbers.FindByRequest{FieldName: "trunkRef", FieldValue: trunkRef})
	if err != nil {
		return nil, fmt.Errorf("numbers of Trunk ref %s: %w", trunkRef, err)
	}
	ix = newTrunkNumberIndex(res.GetItems(), now)
	c.trunkIndexes.mu.Lock()
	if c.trunkIndexes.byTrunk == nil {
		c.trunkIndexes.byTrunk = map[string]*trunkNumberIndex{}
	}
	c.trunkIndexes.byTrunk[trunkRef] = ix
	c.trunkIndexes.mu.Unlock()
	return ix, nil
}

// findNumberOnTrunk is the callee of a call that arrived on a Trunk without a
// Connect Token: the Trunk alone decides it. Its access control list and
// inbound credentials are checked first, so a source that may not use the
// Trunk learns nothing about its Numbers. Then the Request-URI user, up to its
// first ";", is looked up as a telUrl, which counts only for a Number of this
// Trunk, and else matched against the Trunk's index. Anything else is 404,
// for a user no Number of this Trunk answers to and for one two of them do.
func (c *Connect) findNumberOnTrunk(ctx context.Context, req *ppb.MessageRequest, trunk *trunks.Trunk) (*numbers.Number, numberMatch, *ppb.MessageResponse, error) {
	if res := c.checkTrunkAccess(req, trunk); res != nil {
		return nil, "", res, nil
	}
	received := req.GetMessage().GetRequestUri().GetUser()
	user, _, _ := strings.Cut(received, ";")
	notFound := notFoundWith("No Number found for " + received)
	if c.numbers == nil || user == "" {
		return nil, "", notFound, nil
	}
	number, err := c.findNumber(ctx, "tel:"+user)
	if err != nil {
		return nil, "", nil, err
	}
	if number != nil && number.GetTrunk().GetRef() == trunk.GetRef() {
		return number, matchExact, nil, nil
	}
	ix, err := c.trunkNumbers(ctx, trunk.GetRef())
	if err != nil {
		return nil, "", nil, err
	}
	found := ix.match(user)
	switch {
	case found == nil:
		return nil, "", notFound, nil
	case len(found.ambiguous) > 0:
		refs := make([]string, 0, len(found.ambiguous))
		for _, n := range found.ambiguous {
			refs = append(refs, n.GetRef())
		}
		c.log.Warn("the called number matches more than one Number of the Trunk", "ref", req.GetRef(), "trunk", trunk.GetRef(), "user", received, "numbers", strings.Join(refs, ","))
		return nil, "", notFound, nil
	}
	return found.number, found.match, nil, nil
}
