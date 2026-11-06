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
	"path/filepath"
	"strings"
	"testing"
)

const validLocationYAML = `kind: Location
apiVersion: v2beta1
metadata:
  region: default
spec:
  bindAddr: 0.0.0.0:51902
  cache:
    provider: memory
`

func TestLoadRepoConfig(t *testing.T) {
	cfg, err := Load(filepath.Join("..", "..", "config", "location.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.BindAddr != "0.0.0.0:51902" || cfg.Spec.Cache.Provider != "memory" {
		t.Fatalf("unexpected config: %+v", cfg.Spec)
	}
}

func TestLoadFailures(t *testing.T) {
	cases := []struct {
		name, path, want string
	}{
		{"unset", "", "CONFIG_PATH is not set"},
		{"missing", filepath.Join(t.TempDir(), "none.yaml"), "config file "},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := Load(c.path)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("expected an error containing %q, got %v", c.want, err)
			}
		})
	}
}

func TestParseDefaults(t *testing.T) {
	cases := []struct {
		name       string
		yaml       string
		bindAddr   string
		provider   string
		parameters string
	}{
		{
			name:     "memory when no cache is given",
			yaml:     "kind: location\napiVersion: v2\nmetadata: {}\nspec: {}\n",
			bindAddr: DefaultBindAddr, provider: "memory",
		},
		{
			name:     "the local redis for a redis cache without parameters",
			yaml:     "kind: Location\napiVersion: v3\nmetadata: {}\nspec:\n  cache:\n    provider: Redis\n",
			bindAddr: DefaultBindAddr, provider: "Redis", parameters: DefaultRedisParameters,
		},
		{
			name:     "what the file says",
			yaml:     validLocationYAML,
			bindAddr: "0.0.0.0:51902", provider: "memory",
		},
		{
			name:     "redis parameters kept",
			yaml:     "kind: Location\napiVersion: v2beta1\nmetadata: {}\nspec:\n  bindAddr: 127.0.0.1:51902\n  cache:\n    provider: redis\n    parameters: host=redis,port=6380\n",
			bindAddr: "127.0.0.1:51902", provider: "redis", parameters: "host=redis,port=6380",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			cfg, err := Parse([]byte(c.yaml))
			if err != nil {
				t.Fatal(err)
			}
			if cfg.Spec.BindAddr != c.bindAddr || cfg.Spec.Cache.Provider != c.provider || cfg.Spec.Cache.Parameters != c.parameters {
				t.Fatalf("got %+v %+v", cfg.Spec, cfg.Spec.Cache)
			}
		})
	}
}

func TestParseFailures(t *testing.T) {
	cases := []struct {
		name, yaml, want string
	}{
		{"not yaml", "kind: [", "file is not a valid YAML file"},
		{"no kind", "apiVersion: v2beta1\nmetadata: {}\nspec: {}\n", "kind is required"},
		{"no apiVersion", "kind: Location\nmetadata: {}\nspec: {}\n", "apiVersion is required"},
		{"no metadata", "kind: Location\napiVersion: v2beta1\nspec: {}\n", "metadata is required"},
		{"no spec", "kind: Location\napiVersion: v2beta1\nmetadata: {}\n", "spec is required"},
		{"wrong kind", "kind: EdgePort\napiVersion: v2beta1\nmetadata: {}\nspec: {}\n", "kind must be one of Location, location"},
		{"wrong apiVersion", "kind: Location\napiVersion: v1\nmetadata: {}\nspec: {}\n", "apiVersion must be one of v2beta1, v2, v3"},
		{"spec is not an object", "kind: Location\napiVersion: v2beta1\nmetadata: {}\nspec: yes\n", "file does not match the Location schema"},
		{"spec is null", "kind: Location\napiVersion: v2beta1\nmetadata: {}\nspec:\n", "spec must be an object"},
		{"cache without provider", "kind: Location\napiVersion: v2beta1\nmetadata: {}\nspec:\n  cache:\n    parameters: host=x\n", "spec.cache.provider is required"},
		{"unknown provider", "kind: Location\napiVersion: v2beta1\nmetadata: {}\nspec:\n  cache:\n    provider: memcached\n", "spec.cache.provider must be one of memory, redis"},
		{"parameters not a string", "kind: Location\napiVersion: v2beta1\nmetadata: {}\nspec:\n  cache:\n    provider: redis\n    parameters: [a]\n", "file does not match the Location schema"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := Parse([]byte(c.yaml))
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("expected an error containing %q, got %v", c.want, err)
			}
		})
	}
}

func TestOpenStore(t *testing.T) {
	for _, provider := range []string{"memory", "Memory", ""} {
		store, err := OpenStore(Cache{Provider: provider})
		if err != nil {
			t.Fatalf("%q: %v", provider, err)
		}
		if _, ok := store.(*MemoryStore); !ok {
			t.Fatalf("%q: expected a memory store, got %T", provider, store)
		}
		_ = store.Close()
	}

	cases := []struct{ provider, want string }{
		{"redis", "cache provider redis is not available yet"},
		{"Redis", "cache provider redis is not available yet"},
		{"memcached", `unknown cache provider "memcached"`},
	}
	for _, c := range cases {
		_, err := OpenStore(Cache{Provider: c.provider})
		if err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%q: expected %q, got %v", c.provider, c.want, err)
		}
	}
}
