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

// The keys of an EdgePort spec and its objects (mods/edgeport/src/config/
// schema.ts on main). edgeport.yaml takes unknown keys as Ajv did there;
// routr.yaml rejects them.
var (
	edgePortSpecKeys        = []string{"bindAddr", "externalAddrs", "localnets", "aliases", "methods", "unknownMethodAction", "transport", "processor", "processorAuth", "securityContext", "udpReadBuffer", "ignoreLoopbackFromLocalnets", "stripSessionProgressSdp", "sipTrace", "events", "health"}
	edgePortTransportKeys   = []string{"protocol", "bindAddr", "port"}
	edgePortProcessorKeys   = []string{"addr"}
	edgePortSecurityKeys    = []string{"debugging", "keyStore", "keyStorePassword", "keyStoreType", "trustStore", "trustStorePassword", "client"}
	edgePortClientKeys      = []string{"authType", "protocols", "cipherSuites"}
	edgePortRequiredInFile  = []string{"methods", "transport", "processor"}
	edgePortSecurityStrings = []string{"keyStore", "keyStorePassword", "keyStoreType", "trustStore", "trustStorePassword"}
)

// validateSchema checks the rules of mods/edgeport/src/config/schema.ts, with
// errors worded the way Ajv words them ("<path> should have required property").
func validateSchema(raw map[string]any) error {
	if err := ValidateAPIVersion(raw); err != nil {
		return err
	}
	for _, key := range []string{"kind", "ref", "spec"} {
		if _, ok := raw[key]; !ok {
			return fmt.Errorf("should have required property '%s'", key)
		}
	}
	for _, key := range []string{"kind", "ref"} {
		if _, ok := raw[key].(string); !ok {
			return fmt.Errorf(".%s should be string", key)
		}
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
	return validateEdgePortSpec(spec, ".spec", edgePortRequiredInFile, false)
}

// validateEdgePortSpec checks an EdgePort spec at path (".spec" in
// edgeport.yaml, "spec.edgeport" in routr.yaml). required lists the keys the
// file demands; strict rejects unknown keys.
func validateEdgePortSpec(spec map[string]any, path string, required []string, strict bool) error {
	if strict {
		if err := knownKeys(spec, path, edgePortSpecKeys...); err != nil {
			return err
		}
	}
	for _, key := range required {
		if _, ok := spec[key]; !ok {
			return fmt.Errorf("%s should have required property '%s'", path, key)
		}
	}
	if v, ok := spec["bindAddr"]; ok {
		if _, isString := v.(string); !isString {
			return fmt.Errorf("%s.bindAddr should be string", path)
		}
	}
	for _, key := range []string{"externalAddrs", "localnets", "aliases", "methods"} {
		if err := validateStringArray(spec, path, key); err != nil {
			return err
		}
	}
	if err := ValidateClientAuth(spec, path, "processorAuth"); err != nil {
		return err
	}
	if v, ok := spec["udpReadBuffer"]; ok && !isPositiveInteger(v) {
		return fmt.Errorf("%s.udpReadBuffer should be a positive integer (bytes)", path)
	}
	for _, key := range []string{"ignoreLoopbackFromLocalnets", "stripSessionProgressSdp", "sipTrace"} {
		if v, ok := spec[key]; ok {
			if _, isBool := v.(bool); !isBool {
				return fmt.Errorf("%s.%s should be boolean", path, key)
			}
		}
	}
	if err := validateEvents(spec, path); err != nil {
		return err
	}
	if _, ok := spec["health"]; ok && strict {
		return fmt.Errorf("%s.health: the health check of routr.yaml is spec.health", path)
	}
	if err := validateHealth(spec, path); err != nil {
		return err
	}

	if v, ok := spec["unknownMethodAction"]; ok {
		if s, _ := v.(string); s != "Discard" && s != "Respond" {
			return fmt.Errorf("%s.unknownMethodAction should be equal to one of the allowed values", path)
		}
	}

	if v, ok := spec["transport"]; ok {
		transports, ok := v.([]any)
		if !ok {
			return fmt.Errorf("%s.transport should be array", path)
		}
		for i, t := range transports {
			at := fmt.Sprintf("%s.transport[%d]", path, i)
			entry, ok := t.(map[string]any)
			if !ok {
				return fmt.Errorf("%s should be object", at)
			}
			if strict {
				if err := knownKeys(entry, at, edgePortTransportKeys...); err != nil {
					return err
				}
			}
			for _, key := range []string{"port", "protocol"} {
				if _, ok := entry[key]; !ok {
					return fmt.Errorf("%s should have required property '%s'", at, key)
				}
			}
			if _, ok := entry["protocol"].(string); !ok {
				return fmt.Errorf("%s.protocol should be string", at)
			}
			if !isInteger(entry["port"]) {
				return fmt.Errorf("%s.port should be integer", at)
			}
			if v, ok := entry["bindAddr"]; ok {
				if _, isString := v.(string); !isString {
					return fmt.Errorf("%s.bindAddr should be string", at)
				}
			}
		}
	}

	if v, ok := spec["processor"]; ok {
		processor, ok := v.(map[string]any)
		if !ok {
			return fmt.Errorf("%s.processor should be object", path)
		}
		if strict {
			if err := knownKeys(processor, path+".processor", edgePortProcessorKeys...); err != nil {
				return err
			}
		}
		if v, ok := processor["addr"]; ok {
			if _, isString := v.(string); !isString {
				return fmt.Errorf("%s.processor.addr should be string", path)
			}
		}
	}

	if v, ok := spec["securityContext"]; ok {
		sc, isMap := v.(map[string]any)
		if !isMap {
			return fmt.Errorf("%s.securityContext should be object", path)
		}
		if strict {
			if err := validateSecurityContextKeys(sc, path+".securityContext"); err != nil {
				return err
			}
		}
	}
	return nil
}

// validateEvents checks spec.events: console, and nats with its url and
// subject.
func validateEvents(spec map[string]any, path string) error {
	events, present, err := optionalObject(spec, path, "events")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(events, path+".events", "console", "nats"); err != nil {
		return err
	}
	if v, ok := events["console"]; ok {
		if _, isBool := v.(bool); !isBool {
			return fmt.Errorf("%s.events.console should be boolean", path)
		}
	}
	nats, present, err := optionalObject(events, path+".events", "nats")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(nats, path+".events.nats", "url", "subject"); err != nil {
		return err
	}
	for _, key := range []string{"url", "subject"} {
		if err := optionalString(nats, path+".events.nats", key, true); err != nil {
			return err
		}
	}
	return nil
}

// validateHealth checks spec.health of edgeport.yaml, the shape of
// routr.yaml's.
func validateHealth(spec map[string]any, path string) error {
	section, present, err := optionalObject(spec, path, "health")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, path+".health", "bindAddr"); err != nil {
		return err
	}
	return optionalString(section, path+".health", "bindAddr", true)
}

// validateSecurityContextKeys is the strict (routr.yaml) check of
// spec.securityContext: known keys and string values where a path is
// expected.
func validateSecurityContextKeys(sc map[string]any, path string) error {
	if err := knownKeys(sc, path, edgePortSecurityKeys...); err != nil {
		return err
	}
	for _, key := range edgePortSecurityStrings {
		if err := optionalString(sc, path, key, false); err != nil {
			return err
		}
	}
	if v, ok := sc["debugging"]; ok {
		if _, isBool := v.(bool); !isBool {
			return fmt.Errorf("%s.debugging should be boolean", path)
		}
	}
	client, present, err := optionalObject(sc, path, "client")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(client, path+".client", edgePortClientKeys...); err != nil {
		return err
	}
	if err := optionalString(client, path+".client", "authType", false); err != nil {
		return err
	}
	for _, key := range []string{"protocols", "cipherSuites"} {
		if err := validateStringArray(client, path+".client", key); err != nil {
			return err
		}
	}
	return nil
}

func validateStringArray(spec map[string]any, path, key string) error {
	v, ok := spec[key]
	if !ok {
		return nil
	}
	items, ok := v.([]any)
	if !ok {
		return fmt.Errorf("%s.%s should be array", path, key)
	}
	seen := map[string]bool{}
	for i, item := range items {
		s, ok := item.(string)
		if !ok {
			return fmt.Errorf("%s.%s[%d] should be string", path, key, i)
		}
		if seen[s] {
			return fmt.Errorf("%s.%s should NOT have duplicate items", path, key)
		}
		seen[s] = true
	}
	return nil
}

func isInteger(v any) bool {
	_, ok := integerValue(v)
	return ok
}

// isPositiveInteger accepts the integer a YAML decoder yields and the float64 a
// JSON decoder yields for the same number.
func isPositiveInteger(v any) bool {
	switch n := v.(type) {
	case int:
		return n > 0
	case int64:
		return n > 0
	case float64:
		return n > 0 && n == float64(int64(n))
	}
	return false
}
