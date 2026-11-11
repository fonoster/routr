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
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

const connectValid = `
apiVersion: v2beta1
kind: Connect
spec:
  locationAddr: location:51902
  apiAddr: apiserver:51907
`

func TestLoadsTheRepositoryConnectConfig(t *testing.T) {
	cfg, err := LoadConnect(filepath.Join("..", "..", "..", "config", "connect.yaml"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	want := ConnectFileSpec{
		ConnectSpec:              ConnectSpec{BindAddr: "0.0.0.0:51904", NonceMaxAge: 300, RegisterDefaultExpires: 3600},
		LocationAddr:             "location:51902",
		APIAddr:                  "apiserver:51907",
		TrustedEdgePorts:         []string{},
		TrustedEdgePortAddresses: []string{},
		TrustedRegistryAddresses: []string{"requester"},
	}
	if !reflect.DeepEqual(cfg.Spec, want) || cfg.LogLevel != "info" {
		t.Errorf("%+v", cfg)
	}
}

func TestParseConnectDefaults(t *testing.T) {
	cfg, err := ParseConnect([]byte(connectValid), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Spec.ConnectSpec, defaultConnectSpec()) || cfg.Spec.TrustedEdgePorts != nil || cfg.LogLevel != "info" {
		t.Errorf("defaults: %+v", cfg)
	}

	cfg, err = ParseConnect([]byte(connectValid+`  bindAddr: 127.0.0.1:51904
  nonceMaxAge: 0
  registerDefaultExpires: 600
  trustedEdgePorts: [edgeport-02]
  trustedEdgePortAddresses: [10.0.0.0/24]
  trustedRegistryAddresses: [10.0.0.9]
  verifierPublicKeyPath: /etc/routr/verifier.pem
  verifierIssuer: https://issuer
  verifierAudience: routr
logLevel: warn
`), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Spec.ConnectSpec, ConnectSpec{BindAddr: "127.0.0.1:51904", NonceMaxAge: 0, RegisterDefaultExpires: 600, VerifierPublicKeyPath: "/etc/routr/verifier.pem", VerifierIssuer: "https://issuer", VerifierAudience: "routr"}) || cfg.LogLevel != "warn" {
		t.Errorf("explicit values, 0 included: %+v", cfg)
	}
	if len(cfg.Spec.TrustedEdgePorts) != 1 || len(cfg.Spec.TrustedEdgePortAddresses) != 1 || len(cfg.Spec.TrustedRegistryAddresses) != 1 {
		t.Errorf("trust: %+v", cfg.Spec)
	}
}

func TestParseConnectValidation(t *testing.T) {
	with := func(old, new string) string { return strings.Replace(connectValid, old, new, 1) }
	cases := map[string]struct{ text, want string }{
		"not yaml":          {"{{", "file is not a valid JSON or YAML file"},
		"no spec":           {"apiVersion: v3\nkind: Connect\n", "spec: is required"},
		"spec not object":   {"apiVersion: v3\nkind: Connect\nspec: 1\n", "spec: should be object"},
		"wrong kind":        {with("Connect", "EdgePort"), "kind: should be equal to constant Connect"},
		"no locationAddr":   {with("  locationAddr: location:51902\n", ""), "spec.locationAddr: is required"},
		"no apiAddr":        {with("  apiAddr: apiserver:51907\n", ""), "spec.apiAddr: is required"},
		"empty apiAddr":     {with("apiserver:51907", "''"), "spec.apiAddr: should NOT be shorter than 1 characters"},
		"empty bindAddr":    {connectValid + "  bindAddr: ''\n", "spec.bindAddr: should NOT be shorter than 1 characters"},
		"negative nonce":    {connectValid + "  nonceMaxAge: -1\n", "spec.nonceMaxAge: should be >= 0"},
		"zero expires":      {connectValid + "  registerDefaultExpires: 0\n", "spec.registerDefaultExpires: should be >= 1"},
		"bad trust":         {connectValid + "  trustedEdgePortAddresses: 10.0.0.0/24\n", "spec.trustedEdgePortAddresses should be array"},
		"bad registry":      {connectValid + "  trustedRegistryAddresses: 10.0.0.9\n", "spec.trustedRegistryAddresses should be array"},
		"empty issuer":      {connectValid + "  verifierIssuer: ''\n", "spec.verifierIssuer: should NOT be shorter than 1 characters"},
		"unknown key":       {connectValid + "  verifier: {}\n", "spec.verifier: unknown key"},
		"unknown root key":  {connectValid + "env: {}\n", "env: unknown key"},
		"bad logLevel":      {connectValid + "logLevel: silly\n", "logLevel: should be equal to one of the allowed values"},
		"unset placeholder": {with("location:51902", "${LOCATION}"), "spec.locationAddr: references undefined environment variable ${LOCATION}"},
	}
	for name, c := range cases {
		_, err := ParseConnect([]byte(c.text), noEnv)
		if err == nil {
			t.Errorf("%s: accepted", name)
			continue
		}
		if !strings.HasPrefix(err.Error(), c.want) {
			t.Errorf("%s: got %q, want prefix %q", name, err, c.want)
		}
	}
}

func TestLoadConnect(t *testing.T) {
	for name, path := range map[string]string{"unset": "", "missing": filepath.Join(t.TempDir(), "nope.yaml")} {
		if _, err := LoadConnect(path, noEnv); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestParseConnectVerifierSettings(t *testing.T) {
	cfg, err := ParseConnect([]byte(connectValid+"  verifierAddr: verifier:51905\n  untrustedHeadersToStrip: []\n"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.VerifierAddr != "verifier:51905" {
		t.Errorf("verifierAddr = %q", cfg.Spec.VerifierAddr)
	}
	// Empty strips nothing, absent is the default list: they must stay apart
	if cfg.Spec.UntrustedHeadersToStrip == nil || len(cfg.Spec.UntrustedHeadersToStrip) != 0 {
		t.Errorf("untrustedHeadersToStrip = %#v, want empty, not nil", cfg.Spec.UntrustedHeadersToStrip)
	}

	cfg, err = ParseConnect([]byte(connectValid+"  verifierPublicKeyPath: /etc/routr/key.pem\n  untrustedHeadersToStrip: [X-A]\n"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.VerifierPublicKeyPath != "/etc/routr/key.pem" || !reflect.DeepEqual(cfg.Spec.UntrustedHeadersToStrip, []string{"X-A"}) {
		t.Errorf("%+v", cfg.Spec)
	}

	for name, tc := range map[string]struct{ text, want string }{
		"both":        {"  verifierAddr: a:1\n  verifierPublicKeyPath: /k\n", "only one of"},
		"empty addr":  {"  verifierAddr: ''\n", "spec.verifierAddr"},
		"bad headers": {"  untrustedHeadersToStrip: X-A\n", "untrustedHeadersToStrip"},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseConnect([]byte(connectValid+tc.text), noEnv); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Errorf("error = %v, want it to name %q", err, tc.want)
			}
		})
	}
}
