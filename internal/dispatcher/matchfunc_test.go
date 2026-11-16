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

package dispatcher

import "testing"

func TestIsConstantTrue(t *testing.T) {
	cases := []struct {
		src  string
		want bool
	}{
		{"req => true", true},
		{"(req) => true", true},
		{"() => true", true},
		{"req=>true", true},
		{"  request  =>  true ; ", true},
		{"req => { return true }", true},
		{"req => { return true; }", true},
		{"req => false", false},
		{"req => req", false},
		{"req => true || false", false},
		{"true", false},
		{"", false},
		{"req => req.method === \"INVITE\"", false},
		{"(req, extra) => true", false},
		{"function (req) { return true }", false},
		{"req => trueish", false},
	}
	for _, c := range cases {
		t.Run(c.src, func(t *testing.T) {
			if got := isConstantTrue(c.src); got != c.want {
				t.Fatalf("isConstantTrue(%q) = %v, want %v", c.src, got, c.want)
			}
		})
	}
}

func TestAlwaysMatch(t *testing.T) {
	ok, err := alwaysMatch(nil)
	if err != nil || !ok {
		t.Fatalf("alwaysMatch = %v, %v", ok, err)
	}
}

// Both builds compile the shipped matchFunc into the Go fast path.
func TestCompileMatchFuncConstantTrue(t *testing.T) {
	match, err := compileMatchFunc("req => true")
	if err != nil {
		t.Fatalf("compileMatchFunc: %v", err)
	}
	ok, err := match(registerRequest())
	if err != nil || !ok {
		t.Fatalf("match = %v, %v", ok, err)
	}
}
