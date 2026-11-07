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

// Cache is spec.location.cache: the provider and, for redis, the parameters
// string Routr 2's Location names (ParseRedisParameters reads it).
type Cache struct {
	Provider   string `yaml:"provider"`
	Parameters string `yaml:"parameters"`
}

// LocationSpec is spec.location of routr.yaml and the spec of location.yaml.
type LocationSpec struct {
	// BindAddr is where the Location serves gRPC; in routr.yaml an empty
	// string means it is not served.
	BindAddr string `yaml:"bindAddr"`
	Cache    Cache  `yaml:"cache"`
	// ServerAuth is who may call it.
	ServerAuth `yaml:",inline"`
}

// LocationFile is Routr 2's location.yaml (mods/location/src/config/
// schema.ts), what a standalone Location reads.
type LocationFile struct {
	Kind       string         `yaml:"kind"`
	APIVersion string         `yaml:"apiVersion"`
	Metadata   map[string]any `yaml:"metadata"`
	LogLevel   string         `yaml:"logLevel"`
	Spec       LocationSpec   `yaml:"spec"`
}

// LoadLocation reads location.yaml, validates it as Routr 2's Location did
// and fills in the defaults (memory cache; host=localhost,port=6379 for
// redis).
func LoadLocation(path string, opts ResolveOptions) (*LocationFile, error) {
	cfg := newLocationFile()
	if err := Load(path, validateLocationFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseLocation is LoadLocation on the content of the file.
func ParseLocation(data []byte, opts ResolveOptions) (*LocationFile, error) {
	cfg := newLocationFile()
	if err := Parse(data, validateLocationFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

func newLocationFile() *LocationFile {
	return &LocationFile{LogLevel: DefaultLogLevel, Spec: LocationSpec{BindAddr: DefaultLocationBindAddr, Cache: Cache{Provider: "memory"}}}
}

func (c *LocationFile) finish() error {
	return finishCache(&c.Spec.Cache, "spec.cache")
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
	if err := validateLogLevel(raw); err != nil {
		return err
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return fmt.Errorf(".spec should be object")
	}
	if err := ValidateServerAuth(spec, "spec"); err != nil {
		return err
	}
	if v, ok := spec["bindAddr"]; ok {
		s, isString := v.(string)
		if !isString {
			return fmt.Errorf(".spec.bindAddr should be string")
		}
		if s == "" {
			return fmt.Errorf(".spec.bindAddr should NOT be shorter than 1 characters")
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
