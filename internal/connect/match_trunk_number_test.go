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
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
)

func TestMatchTrunkNumber(t *testing.T) {
	sales := &numbers.Number{Ref: "number-uk", TelUrl: "tel:+442079460018", CountryIsoCode: "GB", Aliases: []string{"sales"}}
	ix := newTrunkNumberIndex([]*numbers.Number{sales}, time.Time{})
	for user, want := range map[string]numberMatch{
		"442079460018":      matchDigits,
		"442079460018;npdi": matchDigits,
		"+442079460018":     matchDigits,
		"02079460018":       matchNational,
		"2079460018":        matchNational,
		"00442079460018":    matchInternational,
		"sales":             matchAlias,
	} {
		got := ix.match(user)
		if got == nil || got.number != sales || got.match != want {
			t.Errorf("match(%q) = %+v, want %s", user, got, want)
		}
	}
	for _, user := range []string{"", "SALES", "2079460", "+12079460018", "0012079460018", "anonymous", ";npdi"} {
		if got := ix.match(user); got != nil {
			t.Errorf("match(%q) = %+v, want nothing", user, got)
		}
	}

	t.Run("reads the country in any case", func(t *testing.T) {
		lower := &numbers.Number{Ref: "number-uk", TelUrl: "tel:+442079460018", CountryIsoCode: "gb"}
		if got := newTrunkNumberIndex([]*numbers.Number{lower}, time.Time{}).match("02079460018"); got == nil || got.match != matchNational {
			t.Errorf("match() = %+v", got)
		}
	})
	t.Run("the international prefix of the Number's own country", func(t *testing.T) {
		us := &numbers.Number{Ref: "number-us", TelUrl: "tel:+12025550123", CountryIsoCode: "US"}
		ix := newTrunkNumberIndex([]*numbers.Number{us}, time.Time{})
		if got := ix.match("2025550123"); got == nil || got.match != matchNational {
			t.Errorf("national = %+v", got)
		}
		if got := ix.match("01112025550123"); got == nil || got.match != matchInternational {
			t.Errorf("011 from the US = %+v, want international", got)
		}
		if got := ix.match("0012025550123"); got != nil {
			t.Errorf("00 is no international prefix from the US: %+v", got)
		}
	})
	t.Run("counts a reading only for a Number of that country", func(t *testing.T) {
		// 2079460018 read in GB is +442079460018, a US Number's E.164 in no country
		us := &numbers.Number{Ref: "number-us", TelUrl: "tel:+442079460018", CountryIsoCode: "US"}
		if got := newTrunkNumberIndex([]*numbers.Number{us}, time.Time{}).match("02079460018"); got != nil {
			t.Errorf("match() = %+v", got)
		}
	})
	t.Run("two Numbers at one step are ambiguous", func(t *testing.T) {
		gb := &numbers.Number{Ref: "number-uk", TelUrl: "tel:+442079460018", CountryIsoCode: "GB"}
		us := &numbers.Number{Ref: "number-us", TelUrl: "tel:+12079460018", CountryIsoCode: "US"}
		got := newTrunkNumberIndex([]*numbers.Number{gb, us}, time.Time{}).match("2079460018")
		if got == nil || got.number != nil || len(got.ambiguous) != 2 {
			t.Errorf("match() = %+v", got)
		}
	})
	t.Run("a stricter step wins over a later one", func(t *testing.T) {
		digits := &numbers.Number{Ref: "a", TelUrl: "tel:+442079460018", CountryIsoCode: "GB"}
		alias := &numbers.Number{Ref: "b", TelUrl: "tel:+442079460019", CountryIsoCode: "GB", Aliases: []string{"442079460018"}}
		got := newTrunkNumberIndex([]*numbers.Number{digits, alias}, time.Time{}).match("442079460018")
		if got == nil || got.number != digits || got.match != matchDigits {
			t.Errorf("match() = %+v", got)
		}
	})
	t.Run("a Number with no country is matched by digits and alias only", func(t *testing.T) {
		n := &numbers.Number{Ref: "a", TelUrl: "tel:+442079460018", Aliases: []string{"x"}}
		ix := newTrunkNumberIndex([]*numbers.Number{n}, time.Time{})
		if ix.match("02079460018") != nil || ix.match("442079460018") == nil || ix.match("x") == nil {
			t.Error("unexpected match")
		}
	})
}
