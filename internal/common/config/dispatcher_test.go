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
	"strings"
	"testing"
)

const dispatcherValid = `
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
func TestLoadsTheRepositoryDispatcherConfig(t *testing.T) {
	cfg, err := LoadDispatcher(filepath.Join("..", "..", "..", "config", "dispatcher.yaml"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.BindAddr != "0.0.0.0:51901" || cfg.LogLevel != "info" {
		t.Errorf("%+v", cfg)
	}
	p := cfg.Spec.Processors[0]
	if p.Ref != "connect-processor" || p.Addr != "connect:51904" || p.MatchFunc != "req => true" || len(p.Methods) != 8 {
		t.Errorf("processors[0]: %+v", p)
	}
}

func TestParseDispatcher(t *testing.T) {
	cfg, err := ParseDispatcher([]byte(dispatcherValid), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if m := cfg.Spec.Middlewares[0]; m.Ref != "rtprelay" || m.Addr != "rtprelay:51903" || !m.PostProcessor {
		t.Errorf("middlewares[0]: %+v", m)
	}
	cfg, err = ParseDispatcher([]byte(strings.Replace(dispatcherValid, "  bindAddr: 0.0.0.0:51901\n", "", 1)+"logLevel: error\n"), noEnv)
	if err != nil || cfg.Spec.BindAddr != DefaultDispatcherBindAddr || cfg.LogLevel != "error" {
		t.Errorf("the default bindAddr and the logLevel: %+v %v", cfg, err)
	}
	cfg, err = ParseDispatcher([]byte(`{"kind":"MessageDispatcher","apiVersion":"v2beta1","ref":"d","spec":{"processors":[{"ref":"p","addr":"a:1","methods":["INVITE"],"matchFunc":"req => true"}]}}`), noEnv)
	if err != nil || cfg.Spec.Processors[0].Addr != "a:1" {
		t.Errorf("JSON: %+v %v", cfg, err)
	}
}

func TestParseDispatcherValidation(t *testing.T) {
	without := func(line string) string {
		if !strings.Contains(dispatcherValid, line) {
			t.Fatalf("test bug: %q not in the config", line)
		}
		return strings.Replace(dispatcherValid, line, "", 1)
	}
	cases := map[string]struct{ text, want string }{
		"not yaml":                     {"kind: [", "file is not a valid JSON or YAML file"},
		"no kind":                      {without("kind: MessageDispatcher\n"), "must have required property 'kind'"},
		"no apiVersion":                {without("apiVersion: v2beta1\n"), "must have required property 'apiVersion'"},
		"no ref":                       {without("ref: message-dispatcher\n"), "must have required property 'ref'"},
		"no spec":                      {"kind: a\napiVersion: b\nref: c\n", "spec: should be object"},
		"no processors":                {"kind: a\napiVersion: b\nref: c\nspec: {}\n", "spec.processors must have at least one processor"},
		"empty bindAddr":               {strings.Replace(dispatcherValid, "0.0.0.0:51901", "''", 1), "spec.bindAddr: should NOT be shorter than 1 characters"},
		"processor without ref":        {strings.Replace(dispatcherValid, "    - ref: connect-processor\n      addr", "    - addr", 1), "spec.processors[0] must have required property 'ref'"},
		"processor without addr":       {without("      addr: connect:51904\n"), "spec.processors[0] (ref = connect-processor) must have required property 'addr'"},
		"processor without methods":    {without("      methods: [REGISTER, INVITE]\n"), "spec.processors[0] (ref = connect-processor) must have required property 'methods'"},
		"processor without matchFunc":  {without("      matchFunc: req => true\n"), "spec.processors[0] (ref = connect-processor) must have required property 'matchFunc'"},
		"blank matchFunc":              {strings.Replace(dispatcherValid, "req => true", `"  "`, 1), "spec.processors[0] (ref = connect-processor) must have required property 'matchFunc'"},
		"unknown method":               {strings.Replace(dispatcherValid, "INVITE", "INVIT", 1), `spec.processors[0] (ref = connect-processor) has an unknown method "INVIT"`},
		"middleware without ref":       {strings.Replace(dispatcherValid, "    - ref: rtprelay\n      addr", "    - addr", 1), "spec.middlewares[0] must have required property 'ref'"},
		"middleware without addr":      {without("      addr: rtprelay:51903\n"), "spec.middlewares[0] (ref = rtprelay) must have required property 'addr'"},
		"middleware bad postProcessor": {strings.Replace(dispatcherValid, "postProcessor: true", "postProcessor: yes", 1), "spec.middlewares[0] (ref = rtprelay).postProcessor should be boolean"},
		"bad logLevel":                 {dispatcherValid + "logLevel: verbose\n", "logLevel: should be equal to one of the allowed values"},
		"unset placeholder":            {strings.Replace(dispatcherValid, "connect:51904", "${CONNECT}", 1), "spec.processors[0].addr: references undefined environment variable ${CONNECT}"},
	}
	for name, c := range cases {
		_, err := ParseDispatcher([]byte(c.text), noEnv)
		if err == nil {
			t.Errorf("%s: accepted", name)
			continue
		}
		if !strings.HasPrefix(err.Error(), c.want) {
			t.Errorf("%s: got %q, want prefix %q", name, err, c.want)
		}
	}
}

func TestLoadDispatcher(t *testing.T) {
	dir := t.TempDir()
	for name, path := range map[string]string{"unset": "", "missing": filepath.Join(dir, "nope.yaml"), "a directory": dir} {
		if _, err := LoadDispatcher(path, noEnv); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestMethodNames(t *testing.T) {
	names := MethodNames()
	if len(names) < 10 || names[0] != "UNKNOWN" {
		t.Errorf("every method of the enum, in order: %v", names)
	}
	for _, name := range []string{"INVITE", "REGISTER", "PUBLISH"} {
		if !strings.Contains(strings.Join(names, ","), name) {
			t.Errorf("%s is missing from %v", name, names)
		}
	}
}
