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
		cfg, err := LoadEdgePort(filepath.Join("..", "..", "..", "config", name), ResolveOptions{Env: EnvFromMap(nil)})
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
		if _, err := ParseEdgePort([]byte(text), noEnv); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	if _, err := ParseEdgePort([]byte(valid+"    - protocol: tcp\n      port: 5060\n"), noEnv); err != nil {
		t.Errorf("udp and tcp may share a port: %v", err)
	}
	cfg, err := ParseEdgePort([]byte(valid+"  udpReadBuffer: 8388608\nlogLevel: debug\n"), noEnv)
	if err != nil || cfg.Spec.UDPReadBuffer != 8388608 || cfg.LogLevel != "debug" {
		t.Errorf("udpReadBuffer and logLevel are read: %v %+v", err, cfg)
	}
	if cfg, err := ParseEdgePort([]byte(valid), noEnv); err != nil || cfg.LogLevel != "info" {
		t.Errorf("logLevel defaults to info: %v %+v", err, cfg)
	}
	if _, err := ParseEdgePort([]byte(valid+"logLevel: loud\n"), noEnv); err == nil || !strings.HasPrefix(err.Error(), "logLevel: ") {
		t.Errorf("an unknown logLevel is refused by name: %v", err)
	}
	if _, err := ParseEdgePort([]byte(strings.Replace(valid, "kind: EdgePort", `{"kind":1}`, 1)), noEnv); err == nil {
		t.Error("a JSON file is validated too")
	}
	// edgeport.yaml takes unknown keys, as Ajv did; a known key of the
	// wrong shape the schema does not check is still named, not shown
	_, err = ParseEdgePort([]byte(valid+"  securityContext:\n    keyStore: [s3cr3t]\n"), noEnv)
	if err == nil || err.Error() != "spec.securityContext.keyStore: should be string" {
		t.Errorf("a decode failure names the key: %v", err)
	}
}

var noEnv = ResolveOptions{Env: EnvFromMap(nil)}

func TestLoadEdgePort(t *testing.T) {
	if _, err := LoadEdgePort(filepath.Join(t.TempDir(), "nope.yaml"), noEnv); err == nil {
		t.Error("a missing file fails")
	}
	if _, err := LoadEdgePort("", noEnv); err == nil {
		t.Error("an unset CONFIG_PATH fails")
	}
	path := filepath.Join(t.TempDir(), "edgeport.json")
	_ = os.WriteFile(path, []byte(`{"kind":"EdgePort","apiVersion":"v2","ref":"r","spec":{"methods":[],"processor":{"addr":"${DISPATCHER}"},"transport":[{"protocol":"TCP","port":5060}]}}`), 0o600)
	cfg, err := LoadEdgePort(path, ResolveOptions{Env: EnvFromMap(map[string]string{"DISPATCHER": "dispatcher:51901"})})
	if err != nil || cfg.Spec.Transport[0].Protocol != "tcp" || cfg.Spec.Processor.Addr != "dispatcher:51901" {
		t.Errorf("JSON is read, protocols lower-cased and ${VAR} resolved: %+v %v", cfg, err)
	}
	_, err = LoadEdgePort(path, noEnv)
	if err == nil || !strings.HasPrefix(err.Error(), "config file "+path+": spec.processor.addr: references undefined environment variable ${DISPATCHER}") {
		t.Errorf("the error names the file and the key: %v", err)
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
