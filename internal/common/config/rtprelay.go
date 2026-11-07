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
	"errors"
	"fmt"
)

// The defaults of mods/rtprelay/src/envs.ts.
const (
	DefaultRTPRelayBindAddr   = "0.0.0.0:51903"
	DefaultRTPEnginePort      = 22222
	DefaultRTPEngineTimeoutMs = 5000
)

// RTPRelayProfileNames are the profiles a file can change: one per direction,
// plus the secure-callee variant of the two that end on a phone leg.
var RTPRelayProfileNames = []string{
	"web-to-web",
	"web-to-phone",
	"phone-to-web",
	"phone-to-phone",
	"web-to-secure-phone",
	"phone-to-secure-phone",
}

// RTPRelayProfiles are RTPEngine NG keys by profile, each value a string or a
// list of strings. The keys are open so a new RTPEngine flag needs no code
// change; rtprelay.MergeProfiles lays them over the shipped profiles.
type RTPRelayProfiles map[string]map[string]any

// RTPEngineSpec is spec.rtpengine of rtprelay.yaml: the RTPEngine to drive.
type RTPEngineSpec struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	// TimeoutMs is how long a command waits for its answer, the
	// RTPENGINE_TIMEOUT of Routr 2.
	TimeoutMs int `yaml:"timeoutMs"`
}

// RTPRelayFileSpec is the spec of rtprelay.yaml.
type RTPRelayFileSpec struct {
	BindAddr  string           `yaml:"bindAddr"`
	RTPEngine RTPEngineSpec    `yaml:"rtpengine"`
	Profiles  RTPRelayProfiles `yaml:"profiles"`
	// ServerAuth is who may call it.
	ServerAuth `yaml:",inline"`
}

// RTPRelayFile is rtprelay.yaml, what a standalone RTPRelay reads.
type RTPRelayFile struct {
	Kind       string           `yaml:"kind"`
	APIVersion string           `yaml:"apiVersion"`
	LogLevel   string           `yaml:"logLevel"`
	Spec       RTPRelayFileSpec `yaml:"spec"`
}

// LoadRTPRelay reads rtprelay.yaml. Unlike Routr 2's the file is required: the
// RTPEngine host has nowhere else to come from.
func LoadRTPRelay(path string, opts ResolveOptions) (*RTPRelayFile, error) {
	cfg := newRTPRelayFile()
	if err := Load(path, validateRTPRelayFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseRTPRelay is LoadRTPRelay on the content of the file.
func ParseRTPRelay(data []byte, opts ResolveOptions) (*RTPRelayFile, error) {
	cfg := newRTPRelayFile()
	if err := Parse(data, validateRTPRelayFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

func newRTPRelayFile() *RTPRelayFile {
	return &RTPRelayFile{
		LogLevel: DefaultLogLevel,
		Spec: RTPRelayFileSpec{
			BindAddr:  DefaultRTPRelayBindAddr,
			RTPEngine: RTPEngineSpec{Port: DefaultRTPEnginePort, TimeoutMs: DefaultRTPEngineTimeoutMs},
		},
	}
}

// validateRTPRelayFile checks mods/rtprelay/src/config/schema.ts: strict in the
// spec, open at the root, the profile keys open and their values checked, so a
// typo in a profile name fails at startup. It also requires the host, which
// the Node runner checked after reading the file.
func validateRTPRelayFile(raw map[string]any) error {
	if raw == nil {
		return errors.New("(root): should be object")
	}
	for _, key := range []string{"kind", "apiVersion", "spec"} {
		if _, ok := raw[key]; !ok {
			return fmt.Errorf("must have required property '%s'", key)
		}
	}
	if v, _ := raw["kind"].(string); v != "RTPRelay" {
		return errors.New("kind: should be equal to one of the allowed values (RTPRelay)")
	}
	if _, isString := raw["apiVersion"].(string); !isString {
		return errors.New("apiVersion: should be string")
	}
	if err := validateLogLevel(raw); err != nil {
		return err
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return errors.New("spec: should be object")
	}
	if err := knownKeys(spec, "spec", withServerAuth("bindAddr", "rtpengine", "profiles")...); err != nil {
		return err
	}
	if err := optionalString(spec, "spec", "bindAddr", true); err != nil {
		return err
	}
	if err := ValidateServerAuth(spec, "spec"); err != nil {
		return err
	}
	engine, present, err := optionalObject(spec, "spec", "rtpengine")
	if err != nil {
		return err
	}
	if !present {
		return errors.New("spec.rtpengine.host: is required")
	}
	if err := knownKeys(engine, "spec.rtpengine", "host", "port", "timeoutMs"); err != nil {
		return err
	}
	if err := requiredKeys(engine, "spec.rtpengine", "host"); err != nil {
		return err
	}
	if err := optionalString(engine, "spec.rtpengine", "host", true); err != nil {
		return err
	}
	if err := optionalInteger(engine, "spec.rtpengine", "port", 1, 65535); err != nil {
		return err
	}
	if err := optionalInteger(engine, "spec.rtpengine", "timeoutMs", 1, 0); err != nil {
		return err
	}
	return validateRTPRelayProfiles(spec, "spec")
}

// validateRTPRelayProfiles checks the optional profiles key at path: known
// profile names, each value a string or a list of strings.
func validateRTPRelayProfiles(section map[string]any, path string) error {
	profiles, present, err := optionalObject(section, path, "profiles")
	if err != nil || !present {
		return err
	}
	at := childPath(path, "profiles")
	if err := knownKeys(profiles, at, RTPRelayProfileNames...); err != nil {
		return err
	}
	for _, name := range sortedKeys(profiles) {
		profile, _, err := optionalObject(profiles, at, name)
		if err != nil {
			return err
		}
		for _, key := range sortedKeys(profile) {
			if !isStringOrStrings(profile[key]) {
				return fmt.Errorf("%s: should be string or array of strings", childPath(childPath(at, name), key))
			}
		}
	}
	return nil
}

func isStringOrStrings(v any) bool {
	switch value := v.(type) {
	case string:
		return true
	case []any:
		for _, item := range value {
			if _, isString := item.(string); !isString {
				return false
			}
		}
		return true
	}
	return false
}
