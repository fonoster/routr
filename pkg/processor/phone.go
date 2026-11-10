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

package processor

import "strings"

// normalizeToE164 is the phone npm package as Routr 2 calls it,
// phone("+" + user, { validateMobilePrefix: false }): the user as +E.164 when it
// reads as a number of some country, false otherwise. The mobile prefix check
// stays off because it rejects landlines. A number one digit too long for its
// country has a trunk code after the calling code, which is dropped: the UK's
// 07911 123456 is +44 7911 123456.
func normalizeToE164(user string) (string, bool) {
	digits := digitsOf(user)
	if digits == "" {
		return "", false
	}
	var possible *phoneCountry
	for i := range phoneCountries {
		country := &phoneCountries[i]
		if !strings.HasPrefix(digits, country.code) {
			continue
		}
		for _, length := range country.lengths {
			if len(country.code)+length == len(digits) {
				return "+" + digits, true
			}
			if possible == nil && len(country.code)+length+1 == len(digits) {
				possible = country
			}
		}
	}
	if possible == nil {
		return "", false
	}
	return "+" + possible.code + digits[len(possible.code)+1:], true
}

// digitsOf is the user without anything that is not a digit.
func digitsOf(user string) string {
	var b strings.Builder
	b.Grow(len(user))
	for i := 0; i < len(user); i++ {
		if c := user[i]; c >= '0' && c <= '9' {
			b.WriteByte(c)
		}
	}
	return b.String()
}
