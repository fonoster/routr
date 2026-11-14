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
package numbering

import "testing"

func TestIsE164TelURL(t *testing.T) {
	cases := map[string]bool{
		"tel:+442079460018":     true,
		"tel:+12":               true,
		"tel:02079460018":       false,
		"tel:+0123":             false,
		"tel:+1234567890123456": false,
		"tel:+1":                false,
		"sip:x":                 false,
		"":                      false,
	}
	for in, want := range cases {
		if got := IsE164TelURL(in); got != want {
			t.Errorf("IsE164TelURL(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestIsKnownRegion(t *testing.T) {
	cases := map[string]bool{"GB": true, "gb": true, " us ": true, "XX": false, "ZZ": false, "GBR": false, "": false}
	for in, want := range cases {
		if got := IsKnownRegion(in); got != want {
			t.Errorf("IsKnownRegion(%q) = %v, want %v", in, got, want)
		}
	}
}
