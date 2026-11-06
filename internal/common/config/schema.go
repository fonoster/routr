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

// validateSchema checks the rules of mods/edgeport/src/config/schema.ts, with
// errors worded the way Ajv words them ("<path> should have required property").
func validateSchema(raw map[string]any) error {
	for _, key := range []string{"kind", "ref", "spec", "apiVersion"} {
		if _, ok := raw[key]; !ok {
			return fmt.Errorf("should have required property '%s'", key)
		}
	}
	for _, key := range []string{"kind", "ref"} {
		if _, ok := raw[key].(string); !ok {
			return fmt.Errorf(".%s should be string", key)
		}
	}
	if v, _ := raw["apiVersion"].(string); v != "v2beta1" && v != "v2" {
		return fmt.Errorf(".apiVersion should be equal to one of the allowed values")
	}
	if md, ok := raw["metadata"]; ok {
		m, isMap := md.(map[string]any)
		if !isMap {
			return fmt.Errorf(".metadata should be object")
		}
		if region, ok := m["region"]; ok {
			if _, isString := region.(string); !isString {
				return fmt.Errorf(".metadata.region should be string")
			}
		}
	}

	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return fmt.Errorf(".spec should be object")
	}
	for _, key := range []string{"methods", "transport", "processor"} {
		if _, ok := spec[key]; !ok {
			return fmt.Errorf(".spec should have required property '%s'", key)
		}
	}
	if v, ok := spec["bindAddr"]; ok {
		if _, isString := v.(string); !isString {
			return fmt.Errorf(".spec.bindAddr should be string")
		}
	}
	for _, key := range []string{"externalAddrs", "localnets", "aliases", "methods"} {
		if err := validateStringArray(spec, key); err != nil {
			return err
		}
	}
	if v, ok := spec["unknownMethodAction"]; ok {
		if s, _ := v.(string); s != "Discard" && s != "Respond" {
			return fmt.Errorf(".spec.unknownMethodAction should be equal to one of the allowed values")
		}
	}

	transports, ok := spec["transport"].([]any)
	if !ok {
		return fmt.Errorf(".spec.transport should be array")
	}
	for i, t := range transports {
		entry, ok := t.(map[string]any)
		if !ok {
			return fmt.Errorf(".spec.transport[%d] should be object", i)
		}
		for _, key := range []string{"port", "protocol"} {
			if _, ok := entry[key]; !ok {
				return fmt.Errorf(".spec.transport[%d] should have required property '%s'", i, key)
			}
		}
		if _, ok := entry["protocol"].(string); !ok {
			return fmt.Errorf(".spec.transport[%d].protocol should be string", i)
		}
		if !isInteger(entry["port"]) {
			return fmt.Errorf(".spec.transport[%d].port should be integer", i)
		}
		if v, ok := entry["bindAddr"]; ok {
			if _, isString := v.(string); !isString {
				return fmt.Errorf(".spec.transport[%d].bindAddr should be string", i)
			}
		}
	}

	processor, ok := spec["processor"].(map[string]any)
	if !ok {
		return fmt.Errorf(".spec.processor should be object")
	}
	if v, ok := processor["addr"]; ok {
		if _, isString := v.(string); !isString {
			return fmt.Errorf(".spec.processor.addr should be string")
		}
	}

	if sc, ok := spec["securityContext"]; ok {
		if _, isMap := sc.(map[string]any); !isMap {
			return fmt.Errorf(".spec.securityContext should be object")
		}
	}
	return nil
}

func validateStringArray(spec map[string]any, key string) error {
	v, ok := spec[key]
	if !ok {
		return nil
	}
	items, ok := v.([]any)
	if !ok {
		return fmt.Errorf(".spec.%s should be array", key)
	}
	seen := map[string]bool{}
	for i, item := range items {
		s, ok := item.(string)
		if !ok {
			return fmt.Errorf(".spec.%s[%d] should be string", key, i)
		}
		if seen[s] {
			return fmt.Errorf(".spec.%s should NOT have duplicate items", key)
		}
		seen[s] = true
	}
	return nil
}

func isInteger(v any) bool {
	switch n := v.(type) {
	case int, int64, uint64:
		return true
	case float64:
		return n == float64(int64(n))
	}
	return false
}
