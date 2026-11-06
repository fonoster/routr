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

// The rules of routr.yaml, worded the way RoutrOne 2 worded its one.yaml
// errors (mods/one/src/config/load_one_config.ts formatErrors): "<path>:
// unknown key", "<path>: is required", "<path>: should be ...". The checks
// come from the Node schemas of each section: mods/edgeport (on main),
// mods/location, mods/rtprelay and mods/one's connect and data rules.

// validateRoutrSchema checks a resolved routr.yaml tree.
func validateRoutrSchema(raw map[string]any) error {
	if raw == nil {
		return fmt.Errorf("(root): should be object")
	}
	if err := knownKeys(raw, "", "apiVersion", "kind", "ref", "metadata", "logLevel", "spec"); err != nil {
		return err
	}
	if err := requiredKeys(raw, "", "apiVersion", "kind", "spec"); err != nil {
		return err
	}
	if v, _ := raw["apiVersion"].(string); v != "v3" {
		return fmt.Errorf("apiVersion: should be equal to constant v3")
	}
	if v, _ := raw["kind"].(string); v != "Routr" {
		return fmt.Errorf("kind: should be equal to constant Routr")
	}
	if err := optionalString(raw, "", "ref", true); err != nil {
		return err
	}
	if err := validateLogLevel(raw); err != nil {
		return err
	}
	if md, ok := raw["metadata"]; ok {
		m, isMap := md.(map[string]any)
		if !isMap {
			return fmt.Errorf("metadata: should be object")
		}
		for _, key := range sortedKeys(m) {
			if _, isString := m[key].(string); !isString {
				return fmt.Errorf("metadata.%s: should be string", key)
			}
		}
	}

	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return fmt.Errorf("spec: should be object")
	}
	if err := knownKeys(spec, "spec", "edgeport", "dispatcher", "connect", "location", "data", "rtprelay", "requester", "registry"); err != nil {
		return err
	}
	if err := requiredKeys(spec, "spec", "edgeport", "data"); err != nil {
		return err
	}

	edgeport, ok := spec["edgeport"].(map[string]any)
	if !ok {
		return fmt.Errorf("spec.edgeport: should be object")
	}
	if err := validateEdgePortSpec(edgeport, "spec.edgeport", []string{"transport"}, true); err != nil {
		return err
	}
	if transports, _ := edgeport["transport"].([]any); len(transports) == 0 {
		return fmt.Errorf("spec.edgeport.transport: should NOT have fewer than 1 items")
	}

	if err := validateDispatcherSpec(spec); err != nil {
		return err
	}
	if err := validateConnectSpec(spec); err != nil {
		return err
	}
	if err := validateLocationSpec(spec); err != nil {
		return err
	}
	if err := validateDataSpec(spec); err != nil {
		return err
	}
	if err := validateRTPRelaySpec(spec); err != nil {
		return err
	}
	if err := validateRequesterSpec(spec); err != nil {
		return err
	}
	return validateRegistrySpec(spec)
}

func validateRequesterSpec(spec map[string]any) error {
	section, present, err := optionalObject(spec, "spec", "requester")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, "spec.requester", "bindAddr", "sipHost"); err != nil {
		return err
	}
	if err := optionalString(section, "spec.requester", "bindAddr", false); err != nil {
		return err
	}
	return optionalString(section, "spec.requester", "sipHost", true)
}

func validateRegistrySpec(spec map[string]any) error {
	section, present, err := optionalObject(spec, "spec", "registry")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, "spec.registry", "registerInterval", "methods", "edgePorts"); err != nil {
		return err
	}
	if err := requiredKeys(section, "spec.registry", "edgePorts"); err != nil {
		return err
	}
	if v, ok := section["registerInterval"]; ok {
		n, isNumber := numberValue(v)
		if !isNumber {
			return fmt.Errorf("spec.registry.registerInterval: should be number")
		}
		if n <= 0 {
			return fmt.Errorf("spec.registry.registerInterval: should be > 0")
		}
	}
	if err := validateStringArray(section, "spec.registry", "methods"); err != nil {
		return err
	}
	edgePorts, isList := section["edgePorts"].([]any)
	if !isList {
		return fmt.Errorf("spec.registry.edgePorts: should be array")
	}
	if len(edgePorts) == 0 {
		return fmt.Errorf("spec.registry.edgePorts: should NOT have fewer than 1 items")
	}
	for i, v := range edgePorts {
		path := fmt.Sprintf("spec.registry.edgePorts[%d]", i)
		edgePort, isMap := v.(map[string]any)
		if !isMap {
			return fmt.Errorf("%s: should be object", path)
		}
		if err := knownKeys(edgePort, path, "address", "region"); err != nil {
			return err
		}
		if err := requiredKeys(edgePort, path, "address"); err != nil {
			return err
		}
		if err := optionalString(edgePort, path, "address", true); err != nil {
			return err
		}
		if err := optionalString(edgePort, path, "region", false); err != nil {
			return err
		}
	}
	return nil
}

func validateDispatcherSpec(spec map[string]any) error {
	section, present, err := optionalObject(spec, "spec", "dispatcher")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, "spec.dispatcher", "bindAddr"); err != nil {
		return err
	}
	return optionalString(section, "spec.dispatcher", "bindAddr", false)
}

func validateConnectSpec(spec map[string]any) error {
	section, present, err := optionalObject(spec, "spec", "connect")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, "spec.connect", "bindAddr", "nonceMaxAge", "registerDefaultExpires", "verifierAddr", "verifierPublicKeyPath", "verifierIssuer", "verifierAudience", "untrustedHeadersToStrip"); err != nil {
		return err
	}
	if err := optionalString(section, "spec.connect", "bindAddr", false); err != nil {
		return err
	}
	return validateConnectSettings(section, "spec.connect")
}

func validateLocationSpec(spec map[string]any) error {
	section, present, err := optionalObject(spec, "spec", "location")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, "spec.location", "bindAddr", "cache"); err != nil {
		return err
	}
	if err := optionalString(section, "spec.location", "bindAddr", false); err != nil {
		return err
	}
	cache, present, err := optionalObject(section, "spec.location", "cache")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(cache, "spec.location.cache", "provider", "parameters"); err != nil {
		return err
	}
	if v, ok := cache["provider"]; ok {
		if p, _ := v.(string); lowerProvider(p) != "memory" && lowerProvider(p) != "redis" {
			return fmt.Errorf("spec.location.cache.provider: should be equal to one of the allowed values")
		}
	}
	return optionalString(cache, "spec.location.cache", "parameters", true)
}

func validateRTPRelaySpec(spec map[string]any) error {
	section, present, err := optionalObject(spec, "spec", "rtprelay")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, "spec.rtprelay", "host", "port"); err != nil {
		return err
	}
	if err := requiredKeys(section, "spec.rtprelay", "host", "port"); err != nil {
		return err
	}
	if err := optionalString(section, "spec.rtprelay", "host", true); err != nil {
		return err
	}
	return optionalInteger(section, "spec.rtprelay", "port", 1, 65535)
}

// knownKeys rejects a key that is not in allowed, naming it.
func knownKeys(m map[string]any, path string, allowed ...string) error {
	set := make(map[string]bool, len(allowed))
	for _, key := range allowed {
		set[key] = true
	}
	for _, key := range sortedKeys(m) {
		if !set[key] {
			return fmt.Errorf("%s: unknown key", childPath(path, key))
		}
	}
	return nil
}

func requiredKeys(m map[string]any, path string, keys ...string) error {
	for _, key := range keys {
		if _, ok := m[key]; !ok {
			return fmt.Errorf("%s: is required", childPath(path, key))
		}
	}
	return nil
}

// optionalObject returns the object at key, present=false when absent.
func optionalObject(m map[string]any, path, key string) (map[string]any, bool, error) {
	v, ok := m[key]
	if !ok {
		return nil, false, nil
	}
	section, isMap := v.(map[string]any)
	if !isMap {
		return nil, true, fmt.Errorf("%s: should be object", childPath(path, key))
	}
	return section, true, nil
}

// optionalString checks the value at key, when present, is a string and,
// with nonEmpty, not "".
func optionalString(m map[string]any, path, key string, nonEmpty bool) error {
	v, ok := m[key]
	if !ok {
		return nil
	}
	s, isString := v.(string)
	if !isString {
		return fmt.Errorf("%s: should be string", childPath(path, key))
	}
	if nonEmpty && s == "" {
		return fmt.Errorf("%s: should NOT be shorter than 1 characters", childPath(path, key))
	}
	return nil
}

// optionalInteger checks the value at key, when present, is an integer at
// least min and, when max is not 0, at most max.
func optionalInteger(m map[string]any, path, key string, min, max int64) error {
	v, ok := m[key]
	if !ok {
		return nil
	}
	n, isInt := integerValue(v)
	if !isInt {
		return fmt.Errorf("%s: should be integer", childPath(path, key))
	}
	if n < min {
		return fmt.Errorf("%s: should be >= %d", childPath(path, key), min)
	}
	if max != 0 && n > max {
		return fmt.Errorf("%s: should be <= %d", childPath(path, key), max)
	}
	return nil
}

// numberValue reads a number as the YAML and JSON decoders yield it.
func numberValue(v any) (float64, bool) {
	if f, isFloat := v.(float64); isFloat {
		return f, true
	}
	n, isInt := integerValue(v)
	return float64(n), isInt
}

func integerValue(v any) (int64, bool) {
	switch n := v.(type) {
	case int:
		return int64(n), true
	case int64:
		return n, true
	case uint64:
		return int64(n), true
	case float64:
		if n == float64(int64(n)) {
			return int64(n), true
		}
	}
	return 0, false
}
