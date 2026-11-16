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

// The recording modes of spec.recording.mode.
const (
	// RecordingModeFlagged records the calls a processor flags
	RecordingModeFlagged = "flagged"
	// RecordingModeAll records every call
	RecordingModeAll = "all"
)

// RecordingSpec is spec.recording of dispatcher.yaml and spec.dispatcher.recording
// of routr.yaml: one JSONL file per call, read with rctl trace
// (mods/dispatcher/src/config/schema.ts).
type RecordingSpec struct {
	Enabled bool `yaml:"enabled"`
	// Path is the directory the files are written to
	Path string `yaml:"path"`
	// Mode is flagged (default) or all
	Mode string `yaml:"mode"`
	// MaxRecordsPerCall stops writing a call after this many records (default 1000)
	MaxRecordsPerCall int `yaml:"maxRecordsPerCall"`
	// MaxCalls stops starting new recordings when this many are active (default 10000)
	MaxCalls int `yaml:"maxCalls"`
	// IdleTimeoutSeconds forgets a call after this long without messages (default 7200)
	IdleTimeoutSeconds int `yaml:"idleTimeoutSeconds"`
	// Redact replaces credentials with REDACTED before writing (default true).
	// Turn it off only on a test stack whose recordings feed the corpus.
	Redact *bool `yaml:"redact"`
	// Lint evaluates rules on every record as it is written; absent is off
	Lint *RecordingLint `yaml:"lint"`
}

// RecordingLint is spec.recording.lint.
type RecordingLint struct {
	// Profiles are the rule profiles to evaluate: sip, sip-connect
	Profiles []string `yaml:"profiles"`
	// Window is how many recent records of a call are kept for the rules that
	// look at the whole call (default 32)
	Window *int `yaml:"window"`
}

// validateRecording checks the recording block of a Dispatcher section with the
// rules of the Node recordingSchema, unknown keys included.
func validateRecording(section map[string]any, path string) error {
	recording, present, err := optionalObject(section, path, "recording")
	if err != nil || !present {
		return err
	}
	at := childPath(path, "recording")
	if err := knownKeys(recording, at, "enabled", "path", "mode", "maxRecordsPerCall", "maxCalls", "idleTimeoutSeconds", "redact", "lint"); err != nil {
		return err
	}
	if err := requiredKeys(recording, at, "enabled", "path"); err != nil {
		return err
	}
	for _, key := range []string{"enabled", "redact"} {
		if v, ok := recording[key]; ok {
			if _, isBool := v.(bool); !isBool {
				return fmt.Errorf("%s: should be boolean", childPath(at, key))
			}
		}
	}
	if err := optionalString(recording, at, "path", true); err != nil {
		return err
	}
	if err := optionalString(recording, at, "mode", false); err != nil {
		return err
	}
	if mode, ok := recording["mode"].(string); ok && mode != RecordingModeAll && mode != RecordingModeFlagged {
		return fmt.Errorf("%s: should be one of all, flagged", childPath(at, "mode"))
	}
	for _, key := range []string{"maxRecordsPerCall", "maxCalls", "idleTimeoutSeconds"} {
		if err := optionalInteger(recording, at, key, 1, 0); err != nil {
			return err
		}
	}
	return validateRecordingLint(recording, at)
}

func validateRecordingLint(recording map[string]any, path string) error {
	lint, present, err := optionalObject(recording, path, "lint")
	if err != nil || !present {
		return err
	}
	at := childPath(path, "lint")
	if err := knownKeys(lint, at, "profiles", "window"); err != nil {
		return err
	}
	if err := requiredKeys(lint, at, "profiles"); err != nil {
		return err
	}
	profiles, ok := lint["profiles"].([]any)
	if !ok {
		return errors.New(childPath(at, "profiles") + ": should be array")
	}
	for i, p := range profiles {
		if p != "sip" && p != "sip-connect" {
			return fmt.Errorf("%s[%d]: should be one of sip, sip-connect", childPath(at, "profiles"), i)
		}
	}
	return optionalInteger(lint, at, "window", 0, 0)
}
