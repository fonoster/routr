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
	"fmt"
)

// DefaultLocationBindAddr is the Location's Routr 2 port.
const DefaultLocationBindAddr = "0.0.0.0:51902"

// LocationFileSpec is the spec of Routr 2's location.yaml.
type LocationFileSpec struct {
	BindAddr string `yaml:"bindAddr"`
	Cache    Cache  `yaml:"cache"`
}

// LocationFile is Routr 2's location.yaml (mods/location/src/config/
// schema.ts), what a standalone Location reads.
type LocationFile struct {
	Kind       string           `yaml:"kind"`
	APIVersion string           `yaml:"apiVersion"`
	Metadata   map[string]any   `yaml:"metadata"`
	Spec       LocationFileSpec `yaml:"spec"`
}

// LoadLocation reads location.yaml from the process environment and file
// system.
func LoadLocation(path string) (*LocationFile, error) {
	return LoadLocationWith(path, ResolveOptions{})
}

// LoadLocationWith reads location.yaml, resolves its placeholders and secret
// references through opts, validates it as Routr 2's Location did and fills
// in the defaults (memory cache; host=localhost,port=6379 for redis).
func LoadLocationWith(path string, opts ResolveOptions) (*LocationFile, error) {
	raw, err := readTree(path)
	if err != nil {
		return nil, err
	}
	cfg, err := parseLocation(raw, opts)
	if err != nil {
		return nil, fmt.Errorf("invalid config %s: %w", path, err)
	}
	return cfg, nil
}

// ParseLocation decodes, resolves and validates the content of location.yaml.
func ParseLocation(data []byte, opts ResolveOptions) (*LocationFile, error) {
	raw, err := parseTree(data)
	if err != nil {
		return nil, err
	}
	return parseLocation(raw, opts)
}

func parseLocation(raw map[string]any, opts ResolveOptions) (*LocationFile, error) {
	resolved, err := Resolve(raw, opts)
	if err != nil {
		return nil, err
	}
	tree, _ := resolved.(map[string]any)
	if err := validateLocationFile(tree); err != nil {
		return nil, err
	}
	cfg := &LocationFile{Spec: LocationFileSpec{BindAddr: DefaultLocationBindAddr}}
	if err := decodeTree(tree, cfg); err != nil {
		return nil, err
	}
	if err := finishCache(&cfg.Spec.Cache, "spec.cache"); err != nil {
		return nil, err
	}
	return cfg, nil
}

// validateLocationFile checks the rules of mods/location/src/config/
// schema.ts, which took unknown keys, with Ajv's wording.
func validateLocationFile(raw map[string]any) error {
	if raw == nil {
		return fmt.Errorf("(root): should be object")
	}
	for _, key := range []string{"apiVersion", "kind", "metadata", "spec"} {
		if _, ok := raw[key]; !ok {
			return fmt.Errorf("should have required property '%s'", key)
		}
	}
	if v, _ := raw["kind"].(string); v != "Location" && v != "location" {
		return fmt.Errorf(".kind should be equal to one of the allowed values")
	}
	if v, _ := raw["apiVersion"].(string); v != "v2beta1" && v != "v2" {
		return fmt.Errorf(".apiVersion should be equal to one of the allowed values")
	}
	if _, isMap := raw["metadata"].(map[string]any); !isMap {
		return fmt.Errorf(".metadata should be object")
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return fmt.Errorf(".spec should be object")
	}
	if v, ok := spec["bindAddr"]; ok {
		if _, isString := v.(string); !isString {
			return fmt.Errorf(".spec.bindAddr should be string")
		}
	}
	v, ok := spec["cache"]
	if !ok {
		return nil
	}
	cache, isMap := v.(map[string]any)
	if !isMap {
		return fmt.Errorf(".spec.cache should be object")
	}
	provider, ok := cache["provider"]
	if !ok {
		return fmt.Errorf(".spec.cache should have required property 'provider'")
	}
	if p, _ := provider.(string); lowerProvider(p) != "memory" && lowerProvider(p) != "redis" {
		return fmt.Errorf(".spec.cache.provider should be equal to one of the allowed values")
	}
	if v, ok := cache["parameters"]; ok {
		if _, isString := v.(string); !isString {
			return fmt.Errorf(".spec.cache.parameters should be string")
		}
	}
	return nil
}
