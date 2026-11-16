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

package location

import (
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

func TestOpenStore(t *testing.T) {
	for _, provider := range []string{"memory", "Memory", ""} {
		store, err := OpenStore(config.Cache{Provider: provider})
		if err != nil {
			t.Fatalf("%q: %v", provider, err)
		}
		if _, ok := store.(*MemoryStore); !ok {
			t.Fatalf("%q: expected a memory store, got %T", provider, store)
		}
		_ = store.Close()
	}

	cases := []struct{ provider, want string }{
		{"redis", "spec.cache.parameters"},
		{"Redis", "spec.cache.parameters"},
		{"memcached", `unknown cache provider "memcached"`},
	}
	for _, c := range cases {
		_, err := OpenStore(config.Cache{Provider: c.provider, Parameters: "not parameters"})
		if err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%q: expected %q, got %v", c.provider, c.want, err)
		}
	}
}
