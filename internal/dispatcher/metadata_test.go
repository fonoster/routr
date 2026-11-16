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

import (
	"maps"
	"testing"
)

func TestWithoutTraceMetadata(t *testing.T) {
	cases := []struct {
		name string
		in   map[string]string
		want map[string]string
	}{
		{"nil", nil, nil},
		{"empty", map[string]string{}, nil},
		{"only trace keys", map[string]string{"trace.record": "true", "trace.note": "x"}, nil},
		{"mixed", map[string]string{"trace.record": "true", "x-connect-token": "abc"}, map[string]string{"x-connect-token": "abc"}},
		{"no trace keys", map[string]string{"a": "1", "tracer": "2"}, map[string]string{"a": "1", "tracer": "2"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			before := maps.Clone(c.in)
			got := withoutTraceMetadata(c.in)
			if !maps.Equal(got, c.want) {
				t.Fatalf("got %v, want %v", got, c.want)
			}
			if !maps.Equal(c.in, before) {
				t.Fatal("the input was changed")
			}
		})
	}
}
