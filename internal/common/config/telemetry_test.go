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

func writeTelemetryFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "file.yaml")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLoadTelemetry(t *testing.T) {
	cases := []struct {
		name, file, endpoint string
		env                  map[string]string
		ratio                float64
	}{
		{name: "absent is off", file: "kind: Connect\n"},
		{name: "a literal", file: "telemetry:\n  otlpEndpoint: http://otel:4318\n", endpoint: "http://otel:4318"},
		{name: "a placeholder", file: "telemetry:\n  otlpEndpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}\n", endpoint: "https://otel:4318", env: map[string]string{"OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel:4318"}},
		{name: "a placeholder with an empty default is off", file: "telemetry:\n  otlpEndpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:-}\n"},
		{name: "a ratio", file: "telemetry:\n  otlpEndpoint: http://otel:4318\n  sampleRatio: 0.25\n", endpoint: "http://otel:4318", ratio: 0.25},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := LoadTelemetry(writeTelemetryFile(t, c.file), ResolveOptions{Env: EnvFromMap(c.env)})
			if err != nil {
				t.Fatal(err)
			}
			if got.OTLPEndpoint != c.endpoint {
				t.Errorf("endpoint = %q, want %q", got.OTLPEndpoint, c.endpoint)
			}
			if c.ratio != 0 && (got.SampleRatio == nil || *got.SampleRatio != c.ratio) {
				t.Errorf("ratio = %v, want %v", got.SampleRatio, c.ratio)
			}
		})
	}
}

func TestLoadTelemetryWithoutAFileIsOff(t *testing.T) {
	got, err := LoadTelemetry("", ResolveOptions{})
	if err != nil || got.OTLPEndpoint != "" {
		t.Errorf("got %+v, %v", got, err)
	}
}

func TestLoadTelemetryValidation(t *testing.T) {
	cases := map[string]string{
		"telemetry: on\n": "telemetry",
		"telemetry:\n  endpoint: http://otel:4318\n":      "telemetry.endpoint",
		"telemetry:\n  otlpEndpoint: 4318\n":              "telemetry.otlpEndpoint",
		"telemetry:\n  otlpEndpoint: otel:4318\n":         "telemetry.otlpEndpoint",
		"telemetry:\n  otlpEndpoint: ftp://otel\n":        "telemetry.otlpEndpoint",
		"telemetry:\n  sampleRatio: 2\n":                  "telemetry.sampleRatio",
		"telemetry:\n  sampleRatio: half\n":               "telemetry.sampleRatio",
		"telemetry:\n  otlpEndpoint: ${UNSET_FOR_TEST}\n": "telemetry.otlpEndpoint",
	}
	for file, key := range cases {
		_, err := LoadTelemetry(writeTelemetryFile(t, file), ResolveOptions{Env: EnvFromMap(nil)})
		if err == nil || !strings.Contains(err.Error(), key) {
			t.Errorf("%q: want an error naming %s, got %v", file, key, err)
		}
	}
}

func TestStrictFilesTakeTheTelemetryKey(t *testing.T) {
	connect := "apiVersion: v3\nkind: Connect\ntelemetry:\n  otlpEndpoint: http://otel:4318\nspec:\n  locationAddr: location:51902\n  apiAddr: api:51907\n"
	if _, err := ParseConnect([]byte(connect), ResolveOptions{}); err != nil {
		t.Errorf("connect.yaml: %v", err)
	}
	routr := "apiVersion: v3\nkind: Routr\ntelemetry:\n  otlpEndpoint: http://otel:4318\nspec:\n  edgeport:\n    transport:\n      - { protocol: tcp, port: 5060 }\n  data:\n    backend: files\n    path: /tmp\n"
	if _, err := ParseRoutr([]byte(routr), ResolveOptions{}); err != nil {
		t.Errorf("routr.yaml: %v", err)
	}
}
