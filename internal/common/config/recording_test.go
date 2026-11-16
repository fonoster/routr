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
	"strings"
	"testing"
)

const dispatcherWithRecording = `kind: MessageDispatcher
apiVersion: v2beta1
ref: dispatcher-01
spec:
  processors:
    - ref: connect
      addr: connect:51904
      matchFunc: "req => true"
      methods: [INVITE]
  recording:
`

func TestRecordingIsOptional(t *testing.T) {
	cfg, err := ParseDispatcher([]byte(strings.TrimSuffix(dispatcherWithRecording, "  recording:\n")), ResolveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.Recording != nil {
		t.Errorf("recording: %+v", cfg.Spec.Recording)
	}
}

func TestRecordingIsRead(t *testing.T) {
	text := dispatcherWithRecording + `    enabled: true
    path: /var/routr/traces
    mode: all
    maxRecordsPerCall: 5
    maxCalls: 6
    idleTimeoutSeconds: 7
    redact: false
    lint:
      profiles: [sip, sip-connect]
      window: 0
`
	cfg, err := ParseDispatcher([]byte(text), ResolveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	r := cfg.Spec.Recording
	if r == nil || !r.Enabled || r.Path != "/var/routr/traces" || r.Mode != RecordingModeAll {
		t.Fatalf("recording: %+v", r)
	}
	if r.MaxRecordsPerCall != 5 || r.MaxCalls != 6 || r.IdleTimeoutSeconds != 7 {
		t.Errorf("limits: %+v", r)
	}
	if r.Redact == nil || *r.Redact {
		t.Errorf("redact: %v", r.Redact)
	}
	if r.Lint == nil || len(r.Lint.Profiles) != 2 || r.Lint.Window == nil || *r.Lint.Window != 0 {
		t.Errorf("lint: %+v", r.Lint)
	}
}

func TestRecordingIsValidated(t *testing.T) {
	cases := map[string]struct{ block, want string }{
		"no enabled":   {"    path: /tmp\n", "spec.recording.enabled: is required"},
		"no path":      {"    enabled: true\n", "spec.recording.path: is required"},
		"empty path":   {"    enabled: true\n    path: \"\"\n", "spec.recording.path: should NOT be shorter"},
		"bad enabled":  {"    enabled: 1\n    path: /tmp\n", "spec.recording.enabled: should be boolean"},
		"bad mode":     {"    enabled: true\n    path: /tmp\n    mode: sometimes\n", "spec.recording.mode: should be one of"},
		"bad limit":    {"    enabled: true\n    path: /tmp\n    maxCalls: 0\n", "spec.recording.maxCalls: should be >= 1"},
		"bad redact":   {"    enabled: true\n    path: /tmp\n    redact: maybe\n", "spec.recording.redact: should be boolean"},
		"unknown key":  {"    enabled: true\n    path: /tmp\n    nope: 1\n", "spec.recording.nope: unknown key"},
		"no profiles":  {"    enabled: true\n    path: /tmp\n    lint: {}\n", "spec.recording.lint.profiles: is required"},
		"bad profile":  {"    enabled: true\n    path: /tmp\n    lint: {profiles: [nope]}\n", "spec.recording.lint.profiles[0]: should be one of"},
		"bad window":   {"    enabled: true\n    path: /tmp\n    lint: {profiles: [sip], window: -1}\n", "spec.recording.lint.window: should be >= 0"},
		"lint unknown": {"    enabled: true\n    path: /tmp\n    lint: {profiles: [], nope: 1}\n", "spec.recording.lint.nope: unknown key"},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := ParseDispatcher([]byte(dispatcherWithRecording+c.block), ResolveOptions{})
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Errorf("got %v, want %q", err, c.want)
			}
		})
	}
}

func TestRoutrReadsTheDispatchersRecording(t *testing.T) {
	text := routrMinimum + "  dispatcher:\n    recording: {enabled: true, path: /var/routr/traces}\n"
	cfg, err := ParseRoutr([]byte(text), ResolveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if r := cfg.Spec.Dispatcher.Recording; r == nil || !r.Enabled || r.Path != "/var/routr/traces" {
		t.Errorf("recording: %+v", r)
	}
	bad := routrMinimum + "  dispatcher:\n    recording: {enabled: true}\n"
	if _, err := ParseRoutr([]byte(bad), ResolveOptions{}); err == nil || !strings.Contains(err.Error(), "spec.dispatcher.recording.path: is required") {
		t.Errorf("got %v", err)
	}
}
