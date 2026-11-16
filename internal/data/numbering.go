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

package data

import (
	"fmt"
	"regexp"

	"github.com/fonoster/routr/internal/common/numbering"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// The rules Routr 3 stores Numbers and Trunks by: a telUrl in +E.164 (unless
// spec.data.enforceE164Numbers is false), a countryIsoCode with a numbering
// plan, the aliases of #692 (unique per Trunk) and the number formats of a
// Trunk with their prefixes. The files backend and the postgres backend apply
// the same rules with the same messages.

// e164Message is the telUrl a Create or the files backend refuses when
// enforceE164Numbers is on.
func e164Message(telURL string) string {
	return fmt.Sprintf("telUrl %q is not E.164: use tel:+ followed by 2 to 15 digits, the first not 0; or set spec.data.enforceE164Numbers: false", telURL)
}

// isE164TelURL is the telUrl check of a Create when enforceE164Numbers is on.
func isE164TelURL(telURL string) error {
	if !numbering.IsE164TelURL(telURL) {
		return badRequest(e164Message(telURL))
	}
	return nil
}

func countryIsoCodeMessage(code string) string {
	return fmt.Sprintf("countryIsoCode %q is not a country with a numbering plan", code)
}

// isKnownCountryIsoCode refuses a countryIsoCode libphonenumber has no
// numbering plan for, in any case: Connect matches and formats numbers with it.
func isKnownCountryIsoCode(code string) error {
	if code != "" && !numbering.IsKnownRegion(code) {
		return badRequest(countryIsoCodeMessage(code))
	}
	return nil
}

// aliasRE is an alias: 1 to 60 letters, digits or + * . _ -
var aliasRE = regexp.MustCompile(`^[A-Za-z0-9+*._-]{1,60}$`)

func invalidAliasMessage(alias string) string {
	return fmt.Sprintf("alias %q is invalid: use 1 to 60 letters, digits or + * . _ -", alias)
}

func usedAliasMessage(alias, ref string) string {
	return fmt.Sprintf("alias %q is already used by Number %s on this Trunk", alias, ref)
}

// hasValidAliases checks each alias's characters and length.
func hasValidAliases(aliases []string) error {
	for _, alias := range aliases {
		if !aliasRE.MatchString(alias) {
			return badRequest(invalidAliasMessage(alias))
		}
	}
	return nil
}

// firstSharedAlias is the first of aliases that taken holds, or "".
func firstSharedAlias(aliases []string, taken map[string]bool) string {
	for _, alias := range aliases {
		if taken[alias] {
			return alias
		}
	}
	return ""
}

// prefixRE is a carrier's tech prefix: digits, * and #, up to 20.
var prefixRE = regexp.MustCompile(`^[0-9*#]{1,20}$`)

// trunkNumberFormat is one side (called or caller) of a Trunk's number
// format as it is, or would be, stored.
type trunkNumberFormat struct {
	// field names the side in messages: calledNumber or callerNumber
	field  string
	format trunks.NumberFormat
	prefix string
}

// isValidNumberFormat refuses a value the NumberFormat enum has no name for.
func isValidNumberFormat(field string, format trunks.NumberFormat) error {
	if _, ok := trunks.NumberFormat_name[int32(format)]; !ok {
		return badRequest(fmt.Sprintf("%sFormat must be E164, E164_WITHOUT_PLUS, NATIONAL or INTERNATIONAL, not %d", field, int32(format)))
	}
	return nil
}

// isValidPrefix checks a prefix's characters, when there is one.
func isValidPrefix(field, prefix string) error {
	if prefix != "" && !prefixRE.MatchString(prefix) {
		return badRequest(field + "Prefix may contain only digits, * and # (up to 20)")
	}
	return nil
}

// validate checks a side of the Trunk as it would be stored: a prefix needs
// a format that writes digits it can go in front of.
func (f trunkNumberFormat) validate() error {
	if err := isValidNumberFormat(f.field, f.format); err != nil {
		return err
	}
	if err := isValidPrefix(f.field, f.prefix); err != nil {
		return err
	}
	if f.prefix == "" {
		return nil
	}
	switch f.format {
	case trunks.NumberFormat_E164_WITHOUT_PLUS, trunks.NumberFormat_NATIONAL, trunks.NumberFormat_INTERNATIONAL:
		return nil
	}
	return badRequest(f.field + "Prefix needs " + f.field + "Format e164-without-plus, national or international")
}

// validateTrunkNumberFormats checks both sides of a Trunk as it would be
// stored.
func validateTrunkNumberFormats(called, caller trunkNumberFormat) error {
	return firstError(called.validate(), caller.validate())
}
