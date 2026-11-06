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
package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const locationValid = `
kind: Location
apiVersion: v2beta1
metadata:
  region: default
spec:
  bindAddr: 0.0.0.0:51902
  cache:
    provider: memory
`

func TestLoadsTheRepositoryLocationConfig(t *testing.T) {
	cfg, err := LoadLocation(filepath.Join("..", "..", "..", "config", "location.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Kind != "Location" || cfg.Spec.BindAddr != "0.0.0.0:51902" || cfg.Spec.Cache != (Cache{Provider: "memory"}) {
		t.Errorf("%+v", cfg)
	}
}

func TestParseLocationDefaults(t *testing.T) {
	cfg, err := ParseLocation([]byte("kind: location\napiVersion: v2\nmetadata: {}\nspec: {}\n"), ResolveOptions{Env: EnvFromMap(nil)})
	if err != nil || cfg.Spec.BindAddr != DefaultLocationBindAddr || cfg.Spec.Cache != (Cache{Provider: "memory"}) {
		t.Errorf("memory and the Routr 2 port: %+v %v", cfg, err)
	}

	cfg, err = ParseLocation([]byte(strings.Replace(locationValid, "provider: memory", "provider: Redis", 1)), ResolveOptions{Env: EnvFromMap(nil)})
	if err != nil || cfg.Spec.Cache != (Cache{Provider: "redis", Parameters: DefaultRedisParameters}) {
		t.Errorf("redis without parameters: %+v %v", cfg, err)
	}

	text := strings.Replace(locationValid, "provider: memory", "provider: redis\n    parameters: host=redis,password=secret://env/REDIS_PASSWORD", 1)
	cfg, err = ParseLocation([]byte(text), ResolveOptions{Env: EnvFromMap(map[string]string{"REDIS_PASSWORD": "x"})})
	if err != nil || cfg.Spec.Cache.Parameters != "host=redis,password=secret://env/REDIS_PASSWORD" {
		t.Errorf("a reference inside a value is left alone: %+v %v", cfg, err)
	}

	text = strings.Replace(locationValid, "provider: memory", "provider: redis\n    parameters: host=redis,password=${REDIS_PASSWORD}", 1)
	cfg, err = ParseLocation([]byte(text), ResolveOptions{Env: EnvFromMap(map[string]string{"REDIS_PASSWORD": "x"})})
	if err != nil || cfg.Spec.Cache.Parameters != "host=redis,password=x" {
		t.Errorf("${VAR} inside the parameters: %+v %v", cfg, err)
	}
}

func TestParseLocationValidation(t *testing.T) {
	with := func(old, new string) string { return strings.Replace(locationValid, old, new, 1) }
	cases := map[string]struct{ text, want string }{
		"not yaml":         {"{{{", "file is not a valid JSON or YAML file"},
		"missing metadata": {with("metadata:\n  region: default\n", ""), "should have required property 'metadata'"},
		"missing spec":     {"kind: Location\napiVersion: v2\nmetadata: {}\n", "should have required property 'spec'"},
		"bad kind":         {with("kind: Location", "kind: Locator"), ".kind should be equal to one of the allowed values"},
		"bad apiVersion":   {with("apiVersion: v2beta1", "apiVersion: v3"), ".apiVersion should be equal to one of the allowed values"},
		"bad bindAddr":     {with("bindAddr: 0.0.0.0:51902", "bindAddr: 51902"), ".spec.bindAddr should be string"},
		"no provider":      {with("    provider: memory\n", "    parameters: x\n"), ".spec.cache should have required property 'provider'"},
		"bad provider":     {with("provider: memory", "provider: disk"), ".spec.cache.provider should be equal to one of the allowed values"},
		"bad parameters":   {with("provider: memory", "provider: redis\n    parameters: [a]"), ".spec.cache.parameters should be string"},
		"bad parameter":    {with("provider: memory", "provider: redis\n    parameters: host=x,db=1"), "spec.cache.parameters: invalid parameter: db"},
		"unset reference":  {with("provider: memory", "provider: redis\n    parameters: secret://env/REDIS"), "spec.cache.parameters: secret://env/REDIS: environment variable REDIS is not set"},
	}
	for name, c := range cases {
		_, err := ParseLocation([]byte(c.text), ResolveOptions{Env: EnvFromMap(nil)})
		if err == nil {
			t.Errorf("%s: accepted", name)
			continue
		}
		if !strings.HasPrefix(err.Error(), c.want) {
			t.Errorf("%s: got %q, want prefix %q", name, err, c.want)
		}
	}
	// Routr 2's Location took unknown keys; so does the file here.
	if _, err := ParseLocation([]byte(locationValid+"  extra: 1\n"), ResolveOptions{Env: EnvFromMap(nil)}); err != nil {
		t.Errorf("unknown keys are allowed in location.yaml: %v", err)
	}
}

func TestLoadLocation(t *testing.T) {
	path := filepath.Join(t.TempDir(), "location.yaml")
	if err := os.WriteFile(path, []byte(strings.Replace(locationValid, "provider: memory", "provider: ${ROUTR_TEST_PROVIDER}", 1)), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ROUTR_TEST_PROVIDER", "redis")
	cfg, err := LoadLocation(path)
	if err != nil || cfg.Spec.Cache.Provider != "redis" {
		t.Errorf("%+v %v", cfg, err)
	}
	_, err = LoadLocationWith(path, ResolveOptions{Env: EnvFromMap(nil)})
	if err == nil || !strings.HasPrefix(err.Error(), "invalid config "+path+": spec.cache.provider: ") {
		t.Errorf("names the file: %v", err)
	}
	if _, err := LoadLocation(""); err == nil {
		t.Error("an unset CONFIG_PATH fails")
	}
}
