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
	"net/url"
)

// Telemetry is the top-level telemetry key of routr.yaml and of every
// standalone file. An empty OTLPEndpoint turns telemetry off.
type Telemetry struct {
	// OTLPEndpoint is the OTLP/HTTP base URL every signal goes to, under
	// /v1/traces, /v1/metrics and /v1/logs. Only this key turns telemetry on:
	// OTEL_EXPORTER_OTLP_ENDPOINT counts only through a placeholder here,
	// ${OTEL_EXPORTER_OTLP_ENDPOINT:-} to stay off when it is unset.
	OTLPEndpoint string `yaml:"otlpEndpoint"`
	// SampleRatio is the fraction of new traces kept, from 0 to 1; a trace
	// already started keeps its parent's decision. Absent is 1, Routr 2's
	// default (parentbased_always_on). It replaces OTEL_TRACES_SAMPLER and
	// OTEL_TRACES_SAMPLER_ARG (ROUTR3.md § 7).
	SampleRatio *float64 `yaml:"sampleRatio"`
}

// LoadTelemetry reads the telemetry key of the configuration file at path, any
// file a Routr binary reads. The binary's own loader reads the rest of the
// file; every other key is ignored here. An empty path is no file, as the
// Requester allows: telemetry off.
func LoadTelemetry(path string, opts ResolveOptions) (Telemetry, error) {
	var file struct {
		Telemetry Telemetry `yaml:"telemetry"`
	}
	if path == "" {
		return file.Telemetry, nil
	}
	if err := Load(path, validateTelemetry, &file, opts); err != nil {
		return Telemetry{}, err
	}
	return file.Telemetry, nil
}

// validateTelemetry checks the optional telemetry key of a resolved tree.
func validateTelemetry(raw map[string]any) error {
	section, present, err := optionalObject(raw, "", "telemetry")
	if err != nil || !present {
		return err
	}
	if err := knownKeys(section, "telemetry", "otlpEndpoint", "sampleRatio"); err != nil {
		return err
	}
	if err := optionalString(section, "telemetry", "otlpEndpoint", false); err != nil {
		return err
	}
	if endpoint, _ := section["otlpEndpoint"].(string); endpoint != "" {
		u, err := url.Parse(endpoint)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return fmt.Errorf("telemetry.otlpEndpoint: should be an http or https URL")
		}
	}
	if v, ok := section["sampleRatio"]; ok {
		ratio, isNumber := numberValue(v)
		if !isNumber || ratio < 0 || ratio > 1 {
			return fmt.Errorf("telemetry.sampleRatio: should be a number from 0 to 1")
		}
	}
	return nil
}
