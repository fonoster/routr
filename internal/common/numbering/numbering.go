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
// Package numbering holds what Routr knows about phone numbers, on top of
// github.com/nyaruka/phonenumbers (a Go port of libphonenumber): the countries with a
// numbering plan, and the E.164 rule a stored Number follows.
package numbering

import (
	"regexp"
	"strings"

	"github.com/nyaruka/phonenumbers"
)

var e164TelURL = regexp.MustCompile(`^tel:\+[1-9][0-9]{1,14}$`)

// IsE164TelURL reports whether telURL is tel:+ followed by 2 to 15 digits, the first not 0.
func IsE164TelURL(telURL string) bool {
	return e164TelURL.MatchString(telURL)
}

// Region upper-cases an ISO 3166-1 alpha-2 code, the form phonenumbers expects.
func Region(countryISOCode string) string {
	return strings.ToUpper(strings.TrimSpace(countryISOCode))
}

// IsKnownRegion reports whether countryISOCode, in any case, is a country phonenumbers
// has a numbering plan for. "XX", "ZZ" (unknown) and three-letter codes are not.
func IsKnownRegion(countryISOCode string) bool {
	region := Region(countryISOCode)
	if len(region) != 2 {
		return false
	}
	return phonenumbers.GetCountryCodeForRegion(region) != 0
}
