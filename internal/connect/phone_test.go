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

import "testing"

func TestNormalizeToE164(t *testing.T) {
	tests := []struct {
		name, user, want string
		valid            bool
	}{
		{"a US number without the plus", "17853178070", "+17853178070", true},
		{"a US number with the plus", "+17853178070", "+17853178070", true},
		{"a landline, which the mobile prefix check would reject", "19103434434", "+19103434434", true},
		{"a Dominican number", "18095863314", "+18095863314", true},
		{"a UK mobile", "447911123456", "+447911123456", true},
		{"a trunk code after the calling code is dropped", "4407911123456", "+447911123456", true},
		{"an extension", "1001", "", false},
		{"a name", "asterisk", "", false},
		{"nothing", "", "", false},
	}
	for _, tt := range tests {
		got, ok := normalizeToE164(tt.user)
		if ok != tt.valid || got != tt.want {
			t.Errorf("%s: normalizeToE164(%q) = %q, %v, want %q, %v", tt.name, tt.user, got, ok, tt.want, tt.valid)
		}
	}
}

func TestDigitsOf(t *testing.T) {
	if got := digitsOf("+1-809 555"); got != "1809555" {
		t.Errorf("digitsOf() = %q", got)
	}
	if got := digitsOf("abc"); got != "" {
		t.Errorf("digitsOf() = %q", got)
	}
}
