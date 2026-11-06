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

func TestLoadsTheRepositoryConfigs(t *testing.T) {
	for _, name := range []string{"edgeport.yaml", "edgeport.alt.yaml"} {
		cfg, err := Load(filepath.Join("..", "..", "..", "config", name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if cfg.Spec.BindAddr != "0.0.0.0" || len(cfg.Spec.Transport) != 5 {
			t.Errorf("%s: %+v", name, cfg.Spec)
		}
		for _, tr := range cfg.Spec.Transport {
			if tr.BindAddr != "0.0.0.0" {
				t.Errorf("%s: each transport gets the global bindAddr: %+v", name, tr)
			}
		}
		if cfg.Spec.SecurityContext.Client.AuthType != "DisabledAll" {
			t.Errorf("%s: securityContext: %+v", name, cfg.Spec.SecurityContext)
		}
	}
}

const valid = `
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-01
spec:
  processor:
    addr: dispatcher:51901
  methods: [INVITE]
  transport:
    - protocol: udp
      port: 5060
`

func TestValidation(t *testing.T) {
	cases := map[string]string{
		"missing spec":            "kind: EdgePort\napiVersion: v2beta1\nref: x\n",
		"bad apiVersion":          strings.Replace(valid, "v2beta1", "v1", 1),
		"missing methods":         strings.Replace(valid, "  methods: [INVITE]\n", "", 1),
		"missing port":            strings.Replace(valid, "      port: 5060\n", "", 1),
		"bad unknownMethodAction": valid + "  unknownMethodAction: Drop\n",
		"zero udpReadBuffer":      valid + "  udpReadBuffer: 0\n",
		"text udpReadBuffer":      valid + "  udpReadBuffer: 4MiB\n",
		"duplicated protocol":     valid + "    - protocol: udp\n      port: 5070\n",
		"tls sharing a port":      valid + "    - protocol: tls\n      port: 5060\n",
		"tls without security":    valid + "    - protocol: tls\n      port: 5061\n",
		"not yaml":                "{{{",
	}
	for name, text := range cases {
		if _, err := Parse([]byte(text)); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	if _, err := Parse([]byte(valid + "    - protocol: tcp\n      port: 5060\n")); err != nil {
		t.Errorf("udp and tcp may share a port: %v", err)
	}
	if cfg, err := Parse([]byte(valid + "  udpReadBuffer: 8388608\n")); err != nil || cfg.Spec.UDPReadBuffer != 8388608 {
		t.Errorf("udpReadBuffer is read: %v %+v", err, cfg)
	}
	if _, err := Parse([]byte(strings.Replace(valid, "kind: EdgePort", `{"kind":1}`, 1))); err == nil {
		t.Error("a JSON file is validated too")
	}
}

func TestLoadMissingFile(t *testing.T) {
	if _, err := Load(filepath.Join(t.TempDir(), "nope.yaml")); err == nil {
		t.Error("a missing file fails")
	}
	if _, err := Load(""); err == nil {
		t.Error("an unset CONFIG_PATH fails")
	}
	path := filepath.Join(t.TempDir(), "edgeport.json")
	_ = os.WriteFile(path, []byte(`{"kind":"EdgePort","apiVersion":"v2","ref":"r","spec":{"methods":[],"processor":{"addr":"a:1"},"transport":[{"protocol":"TCP","port":5060}]}}`), 0o600)
	cfg, err := Load(path)
	if err != nil || cfg.Spec.Transport[0].Protocol != "tcp" {
		t.Errorf("JSON is read and protocols lower-cased: %+v %v", cfg, err)
	}
}

func TestEnvWinsOverConfig(t *testing.T) {
	env := ReadEnv(func(key string) (string, bool) {
		v, ok := map[string]string{
			"EXTERNAL_ADDRS":                 "1.2.3.4, sip.example.com",
			"LOCALNETS":                      "",
			"ALIASES":                        ",",
			"IGNORE_LOOPBACK_FROM_LOCALNETS": "TRUE",
			"PROCESSOR_ADDR":                 "proc:1",
		}[key]
		return v, ok
	})
	if got := Pick(env.ExternalAddrs, []string{"cfg"}); strings.Join(got, ",") != "1.2.3.4,sip.example.com" {
		t.Errorf("externalAddrs: %v", got)
	}
	if got := Pick(env.Localnets, []string{"10.0.0.0/8"}); strings.Join(got, ",") != "10.0.0.0/8" {
		t.Errorf("an empty LOCALNETS keeps the config: %v", got)
	}
	if got := Pick(env.Aliases, nil); len(got) != 0 {
		t.Errorf("blank aliases are dropped: %v", got)
	}
	if !env.IgnoreLoopbackFromLocalnets || env.ProcessorAddr != "proc:1" || env.EnableHealthchecks {
		t.Errorf("%+v", env)
	}
}
