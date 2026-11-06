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

package connect

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const validConfig = `
apiVersion: v2beta1
kind: Connect
spec:
  locationAddr: location:51902
  apiAddr: apiserver:51907
`

func TestParse(t *testing.T) {
	tests := []struct {
		name    string
		yaml    string
		wantErr string
		check   func(t *testing.T, cfg *Config)
	}{
		{
			name: "fills in the defaults",
			yaml: validConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.Spec.BindAddr != DefaultBindAddr {
					t.Errorf("bindAddr = %q, want %q", cfg.Spec.BindAddr, DefaultBindAddr)
				}
				if *cfg.Spec.NonceMaxAge != 300 {
					t.Errorf("nonceMaxAge = %d, want 300", *cfg.Spec.NonceMaxAge)
				}
				if *cfg.Spec.RegisterDefaultExpires != 3600 {
					t.Errorf("registerDefaultExpires = %d, want 3600", *cfg.Spec.RegisterDefaultExpires)
				}
				if len(cfg.Spec.TrustedEdgePortAddresses) != 0 {
					t.Errorf("trustedEdgePortAddresses = %v, want none", cfg.Spec.TrustedEdgePortAddresses)
				}
			},
		},
		{
			name: "keeps the values given",
			yaml: validConfig + `
  bindAddr: 127.0.0.1:51904
  nonceMaxAge: 0
  registerDefaultExpires: 600
  trustedEdgePorts: [edgeport-02]
  trustedEdgePortAddresses: [10.0.0.0/24]
`,
			check: func(t *testing.T, cfg *Config) {
				if cfg.Spec.BindAddr != "127.0.0.1:51904" || *cfg.Spec.NonceMaxAge != 0 || *cfg.Spec.RegisterDefaultExpires != 600 {
					t.Errorf("spec = %+v", cfg.Spec)
				}
				if len(cfg.Spec.TrustedEdgePorts) != 1 || len(cfg.Spec.TrustedEdgePortAddresses) != 1 {
					t.Errorf("trust = %v %v", cfg.Spec.TrustedEdgePorts, cfg.Spec.TrustedEdgePortAddresses)
				}
			},
		},
		{name: "not yaml", yaml: "{{", wantErr: "not a valid YAML"},
		{name: "no spec", yaml: "kind: Connect\n", wantErr: "spec is required"},
		{name: "wrong kind", yaml: strings.Replace(validConfig, "Connect", "EdgePort", 1), wantErr: "kind must be Connect"},
		{name: "no locationAddr", yaml: "spec:\n  apiAddr: a:1\n", wantErr: "spec.locationAddr is required"},
		{name: "no apiAddr", yaml: "spec:\n  locationAddr: a:1\n", wantErr: "spec.apiAddr is required"},
		{name: "negative nonceMaxAge", yaml: validConfig + "  nonceMaxAge: -1\n", wantErr: "nonceMaxAge must be a non-negative integer"},
		{name: "zero registerDefaultExpires", yaml: validConfig + "  registerDefaultExpires: 0\n", wantErr: "registerDefaultExpires must be a positive integer"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := Parse([]byte(tt.yaml))
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("Parse() error = %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Parse() error = %v", err)
			}
			tt.check(t, cfg)
		})
	}
}

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "connect.yaml")
	if err := os.WriteFile(path, []byte(validConfig), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load(path)
	if err != nil || cfg.Spec.LocationAddr != "location:51902" {
		t.Fatalf("Load() = %+v, %v", cfg, err)
	}
	for name, p := range map[string]string{"unset": "", "missing": filepath.Join(dir, "nope.yaml"), "a directory": dir} {
		if _, err := Load(p); err == nil {
			t.Errorf("Load(%s) expected an error", name)
		}
	}
}
