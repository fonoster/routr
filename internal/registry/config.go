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

package registry

import (
	"errors"
	"fmt"

	"github.com/fonoster/routr/internal/common/config"
)

// defaultRegisterInterval is how often, in seconds, a round runs when the
// file doesn't say.
const defaultRegisterInterval = 60

// EdgePort is an entry of spec.edgePorts: where a REGISTER leaves through.
type EdgePort struct {
	Address string `yaml:"address"`
	Region  string `yaml:"region"`
}

// Spec is the spec of registry.yaml (mods/registry/src/config/schema.ts).
type Spec struct {
	// RequesterAddr is the Requester service.
	RequesterAddr string `yaml:"requesterAddr"`
	// RequesterAuth is how to reach RequesterAddr.
	RequesterAuth config.ClientAuth `yaml:"requesterAuth"`
	// APIAddr is the Data API.
	APIAddr string `yaml:"apiAddr"`
	// APIAuth is how to reach APIAddr.
	APIAuth config.ClientAuth `yaml:"apiAuth"`
	// RegisterInterval is the seconds between rounds, 60 by default.
	RegisterInterval float64 `yaml:"registerInterval"`
	// Cache names the store.
	Cache config.Cache `yaml:"cache"`
	// Methods become the REGISTER's Allow headers.
	Methods []string `yaml:"methods"`
	// EdgePorts are the ways out; the first one is used.
	EdgePorts []EdgePort `yaml:"edgePorts"`
	// EnableHealthchecks serves GET /healthz on port 8080, the chart's probe.
	// True by default; Routr 2 read it from ENABLE_HEALTHCHECKS.
	EnableHealthchecks bool `yaml:"enableHealthchecks"`
}

// File is registry.yaml, what a standalone Registry reads.
type File struct {
	Kind       string         `yaml:"kind"`
	APIVersion string         `yaml:"apiVersion"`
	Metadata   map[string]any `yaml:"metadata"`
	LogLevel   string         `yaml:"logLevel"`
	Spec       Spec           `yaml:"spec"`
}

// LoadFile reads registry.yaml, validates it and fills in the defaults.
func LoadFile(path string, opts config.ResolveOptions) (*File, error) {
	file := newFile()
	if err := config.Load(path, validateFile, file, opts); err != nil {
		return nil, err
	}
	file.applyCacheDefaults()
	return file, nil
}

// ParseFile is LoadFile on the content of the file.
func ParseFile(data []byte, opts config.ResolveOptions) (*File, error) {
	file := newFile()
	if err := config.Parse(data, validateFile, file, opts); err != nil {
		return nil, err
	}
	file.applyCacheDefaults()
	return file, nil
}

func newFile() *File {
	return &File{
		LogLevel: config.DefaultLogLevel,
		Spec: Spec{
			RegisterInterval:   defaultRegisterInterval,
			Cache:              config.Cache{Provider: providerMemory},
			EnableHealthchecks: true,
		},
	}
}

func (f *File) applyCacheDefaults() {
	if f.Spec.Cache.Provider == providerRedis && f.Spec.Cache.Parameters == "" {
		f.Spec.Cache.Parameters = "host=localhost,port=6379"
	}
}

// validateFile checks the rules of mods/registry/src/config/schema.ts, which
// took unknown keys, with Ajv's wording. Two rules are new: an interval above
// zero, and an address on every EdgePort, which that schema meant to require.
func validateFile(raw map[string]any) error {
	if raw == nil {
		return errors.New("(root): should be object")
	}
	for _, key := range []string{"kind", "spec", "apiVersion"} {
		if _, ok := raw[key]; !ok {
			return fmt.Errorf("should have required property '%s'", key)
		}
	}
	if v, _ := raw["kind"].(string); v != "Registry" && v != "registry" {
		return errors.New(".kind should be equal to one of the allowed values")
	}
	if v, _ := raw["apiVersion"].(string); v != "v2beta1" && v != "v2" && v != "v3" {
		return errors.New(".apiVersion should be equal to one of the allowed values")
	}
	if v, ok := raw["metadata"]; ok {
		if _, isMap := v.(map[string]any); !isMap {
			return errors.New(".metadata should be object")
		}
	}
	if v, ok := raw["logLevel"]; ok {
		if s, isString := v.(string); !isString || !validLogLevel(s) {
			return errors.New(".logLevel should be equal to one of the allowed values")
		}
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return errors.New(".spec should be object")
	}
	for _, key := range []string{"requesterAddr", "apiAddr", "edgePorts"} {
		if _, ok := spec[key]; !ok {
			return fmt.Errorf(".spec should have required property '%s'", key)
		}
	}
	for _, key := range []string{"requesterAddr", "apiAddr"} {
		if _, isString := spec[key].(string); !isString {
			return fmt.Errorf(".spec.%s should be string", key)
		}
	}
	if v, ok := spec["enableHealthchecks"]; ok {
		if _, isBool := v.(bool); !isBool {
			return errors.New(".spec.enableHealthchecks should be boolean")
		}
	}
	if v, ok := spec["registerInterval"]; ok {
		n, isNumber := numberOf(v)
		if !isNumber {
			return errors.New(".spec.registerInterval should be number")
		}
		if n <= 0 {
			return errors.New(".spec.registerInterval should be > 0")
		}
	}
	for _, key := range []string{"requesterAuth", "apiAuth"} {
		if err := config.ValidateClientAuth(spec, "spec", key); err != nil {
			return err
		}
	}
	if err := validateCache(spec); err != nil {
		return err
	}
	if err := validateMethods(spec); err != nil {
		return err
	}
	return validateEdgePorts(spec)
}

func validateCache(spec map[string]any) error {
	v, ok := spec["cache"]
	if !ok {
		return nil
	}
	cache, isMap := v.(map[string]any)
	if !isMap {
		return errors.New(".spec.cache should be object")
	}
	provider, ok := cache["provider"]
	if !ok {
		return errors.New(".spec.cache should have required property 'provider'")
	}
	if p, _ := provider.(string); p != providerMemory && p != providerRedis {
		return errors.New(".spec.cache.provider should be equal to one of the allowed values")
	}
	if v, ok := cache["parameters"]; ok {
		if _, isString := v.(string); !isString {
			return errors.New(".spec.cache.parameters should be string")
		}
	}
	return nil
}

func validateMethods(spec map[string]any) error {
	v, ok := spec["methods"]
	if !ok {
		return nil
	}
	methods, isList := v.([]any)
	if !isList {
		return errors.New(".spec.methods should be array")
	}
	seen := make(map[string]struct{}, len(methods))
	for i, method := range methods {
		s, isString := method.(string)
		if !isString {
			return fmt.Errorf(".spec.methods[%d] should be string", i)
		}
		if _, dup := seen[s]; dup {
			return errors.New(".spec.methods should NOT have duplicate items")
		}
		seen[s] = struct{}{}
	}
	return nil
}

func validateEdgePorts(spec map[string]any) error {
	edgePorts, isList := spec["edgePorts"].([]any)
	if !isList {
		return errors.New(".spec.edgePorts should be array")
	}
	for i, v := range edgePorts {
		edgePort, isMap := v.(map[string]any)
		if !isMap {
			return fmt.Errorf(".spec.edgePorts[%d] should be object", i)
		}
		if _, isString := edgePort["address"].(string); !isString {
			return fmt.Errorf(".spec.edgePorts[%d] should have required property 'address'", i)
		}
	}
	return nil
}

func validLogLevel(level string) bool {
	switch level {
	case "debug", "info", "warn", "error":
		return true
	}
	return false
}

// numberOf reads a number as YAML and JSON decoders yield it.
func numberOf(v any) (float64, bool) {
	switch n := v.(type) {
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case uint64:
		return float64(n), true
	case float64:
		return n, true
	}
	return 0, false
}
