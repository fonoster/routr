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

package dispatcher

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const validConfig = `
kind: MessageDispatcher
apiVersion: v2beta1
ref: message-dispatcher
spec:
  bindAddr: 0.0.0.0:51901
  middlewares:
    - ref: rtprelay
      addr: rtprelay:51903
      postProcessor: true
  processors:
    - ref: connect-processor
      addr: connect:51904
      matchFunc: req => true
      methods: [REGISTER, INVITE]
`

// "gets configuration from file"
func TestLoadConfigReadsTheRepositoryFile(t *testing.T) {
	cfg, err := LoadConfig(filepath.Join("..", "..", "config", "dispatcher.yaml"))
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.Spec.BindAddr != "0.0.0.0:51901" {
		t.Fatalf("bindAddr = %s", cfg.Spec.BindAddr)
	}
	if cfg.Spec.Processors[0].Ref != "connect-processor" {
		t.Fatalf("processors[0].ref = %s", cfg.Spec.Processors[0].Ref)
	}
	if cfg.Spec.Processors[0].MatchFunc != "req => true" {
		t.Fatalf("processors[0].matchFunc = %q", cfg.Spec.Processors[0].MatchFunc)
	}
}

func TestLoadConfigFailures(t *testing.T) {
	dir := t.TempDir()
	if _, err := LoadConfig(""); err == nil || err.Error() != "CONFIG_PATH is not set" {
		t.Fatalf("empty path: %v", err)
	}
	if _, err := LoadConfig(filepath.Join(dir, "missing.yaml")); err == nil || !strings.Contains(err.Error(), "does not exist") {
		t.Fatalf("missing file: %v", err)
	}
	if _, err := LoadConfig(dir); err == nil || !strings.Contains(err.Error(), "does not exist") {
		t.Fatalf("directory: %v", err)
	}
	path := filepath.Join(dir, "dispatcher.yaml")
	if err := os.WriteFile(path, []byte(validConfig), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if !cfg.Spec.Middlewares[0].PostProcessor {
		t.Fatal("postProcessor not read")
	}
}

func TestParseConfigDefaultsTheBindAddr(t *testing.T) {
	cfg, err := ParseConfig([]byte(strings.Replace(validConfig, "  bindAddr: 0.0.0.0:51901\n", "", 1)))
	if err != nil {
		t.Fatalf("ParseConfig: %v", err)
	}
	if cfg.Spec.BindAddr != DefaultBindAddr {
		t.Fatalf("bindAddr = %s, want %s", cfg.Spec.BindAddr, DefaultBindAddr)
	}
}

func TestParseConfigAcceptsJSON(t *testing.T) {
	cfg, err := ParseConfig([]byte(`{"kind":"MessageDispatcher","apiVersion":"v2beta1","ref":"d","spec":{"processors":[{"ref":"p","addr":"a:1","methods":["INVITE"],"matchFunc":"req => true"}]}}`))
	if err != nil {
		t.Fatalf("ParseConfig: %v", err)
	}
	if cfg.Spec.Processors[0].Addr != "a:1" {
		t.Fatalf("addr = %s", cfg.Spec.Processors[0].Addr)
	}
}

func TestParseConfigFailures(t *testing.T) {
	without := func(line string) string {
		if !strings.Contains(validConfig, line) {
			t.Fatalf("test bug: %q not in the config", line)
		}
		return strings.Replace(validConfig, line, "", 1)
	}
	cases := []struct {
		name string
		yaml string
		want string
	}{
		{"not yaml", "kind: [", "not a valid JSON or YAML"},
		{"no kind", without("kind: MessageDispatcher\n"), "required property 'kind'"},
		{"no apiVersion", without("apiVersion: v2beta1\n"), "required property 'apiVersion'"},
		{"no ref", without("ref: message-dispatcher\n"), "required property 'ref'"},
		{"no processors", "kind: a\napiVersion: b\nref: c\nspec: {}\n", "at least one processor"},
		{"processor without ref", strings.Replace(validConfig, "    - ref: connect-processor\n      addr", "    - addr", 1), "spec.processors[0] must have required property 'ref'"},
		{"processor without addr", without("      addr: connect:51904\n"), "(ref = connect-processor) must have required property 'addr'"},
		{"processor without methods", without("      methods: [REGISTER, INVITE]\n"), "required property 'methods'"},
		{"processor without matchFunc", without("      matchFunc: req => true\n"), "required property 'matchFunc'"},
		{"blank matchFunc", strings.Replace(validConfig, "req => true", `"  "`, 1), "required property 'matchFunc'"},
		{"unknown method", strings.Replace(validConfig, "INVITE", "INVIT", 1), `unknown method "INVIT"`},
		{"middleware without ref", strings.Replace(validConfig, "    - ref: rtprelay\n      addr", "    - addr", 1), "spec.middlewares[0] must have required property 'ref'"},
		{"middleware without addr", without("      addr: rtprelay:51903\n"), "(ref = rtprelay) must have required property 'addr'"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := ParseConfig([]byte(c.yaml))
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("error = %v, want one containing %q", err, c.want)
			}
		})
	}
}
