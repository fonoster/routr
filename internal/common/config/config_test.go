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

// The keys that replace the standalone EdgePort's Routr 2 variables (#574):
// read with their defaults, and refused by name when malformed.
func TestEdgePortKeysReplaceTheEnvironment(t *testing.T) {
	cfg, err := ParseEdgePort([]byte(valid+`  ignoreLoopbackFromLocalnets: true
  stripSessionProgressSdp: true
  sipTrace: true
  events:
    console: true
    nats: {}
  health: {}
`), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	spec := cfg.Spec
	if !spec.IgnoreLoopbackFromLocalnets || !spec.StripSessionProgressSdp || !spec.SipTrace || !spec.Events.Console {
		t.Errorf("the booleans are read: %+v", spec)
	}
	if spec.Events.NATS.URL != DefaultNATSURL || spec.Events.NATS.Subject != DefaultNATSSubject {
		t.Errorf("nats defaults: %+v", spec.Events.NATS)
	}
	if spec.Health.BindAddr != DefaultHealthBindAddr {
		t.Errorf("health defaults: %+v", spec.Health)
	}

	cfg, err = ParseEdgePort([]byte(valid+"  events:\n    nats:\n      url: nats://events:4222\n      subject: calls\n  health:\n    bindAddr: 127.0.0.1:9090\n"), noEnv)
	if err != nil || cfg.Spec.Events.NATS.URL != "nats://events:4222" || cfg.Spec.Events.NATS.Subject != "calls" || cfg.Spec.Health.BindAddr != "127.0.0.1:9090" {
		t.Errorf("nats and health are read: %v %+v", err, cfg.Spec)
	}
	if cfg, err := ParseEdgePort([]byte(valid), noEnv); err != nil || cfg.Spec.Events != nil || cfg.Spec.Health != nil || cfg.Spec.SipTrace {
		t.Errorf("absent is off: %v %+v", err, cfg.Spec)
	}

	cases := map[string]string{
		"spec.sipTrace should be boolean":                    valid + "  sipTrace: yes please\n",
		"spec.stripSessionProgressSdp should be boolean":     valid + "  stripSessionProgressSdp: 1\n",
		"spec.ignoreLoopbackFromLocalnets should be boolean": valid + "  ignoreLoopbackFromLocalnets: \"true\"\n",
		"spec.events.console should be boolean":              valid + "  events:\n    console: on\n",
		"spec.events.nats.url":                               valid + "  events:\n    nats:\n      url: 4222\n",
		"spec.events.nats.enabled: unknown key":              valid + "  events:\n    nats:\n      enabled: true\n",
		"spec.health.bindAddr":                               valid + "  health:\n    bindAddr: \"\"\n",
	}
	for want, text := range cases {
		_, err := ParseEdgePort([]byte(text), noEnv)
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("%q: %v", want, err)
		}
	}
}

// routr.yaml has spec.health; spec.edgeport.health would be a second one.
func TestRoutrRefusesHealthUnderEdgePort(t *testing.T) {
	spec := map[string]any{"transport": []any{}, "health": map[string]any{}}
	err := validateEdgePortSpec(spec, "spec.edgeport", []string{"transport"}, true)
	if err == nil || !strings.Contains(err.Error(), "spec.edgeport.health") {
		t.Errorf("named: %v", err)
	}
}

func TestEdgePortConnectionLimits(t *testing.T) {
	cfg, err := ParseEdgePort([]byte(valid+"  connectionIdleTimeout: 1\n  maxConnections: 2\n"), noEnv)
	if err != nil || cfg.Spec.ConnectionIdleTimeout != 1 || cfg.Spec.MaxConnections != 2 {
		t.Fatalf("read: %v %+v", err, cfg)
	}
	for line, want := range map[string]string{
		"connectionIdleTimeout: 0":  "connectionIdleTimeout should be a positive integer (seconds)",
		"maxConnections: \"many\"":  "maxConnections should be a positive integer",
		"connectionIdleTimeout: -5": "connectionIdleTimeout should be a positive integer (seconds)",
	} {
		if _, err := ParseEdgePort([]byte(valid+"  "+line+"\n"), noEnv); err == nil || err.Error() != "spec."+want && err.Error() != ".spec."+want {
			t.Errorf("edgeport.yaml %s: %v", line, err)
		}
		routr := "apiVersion: v3\nkind: Routr\nspec:\n  data: {backend: files, path: /r}\n  edgeport:\n    transport: [{protocol: udp, port: 5060}]\n    " + line + "\n"
		if _, err := ParseRoutr([]byte(routr), noEnv); err == nil || !strings.HasSuffix(err.Error(), "spec.edgeport."+want) {
			t.Errorf("routr.yaml %s: %v", line, err)
		}
	}
}

// spec.cache is where the EdgePort keeps its dialog table (#578): memory unless
// it says redis, with the Location's parameters string.
func TestEdgePortCache(t *testing.T) {
	cfg, err := ParseEdgePort([]byte(valid), noEnv)
	if err != nil || cfg.Spec.Cache.Provider != "memory" || cfg.Spec.Cache.Parameters != "" {
		t.Fatalf("memory is the default: %v %+v", err, cfg.Spec.Cache)
	}
	cfg, err = ParseEdgePort([]byte(valid+"  cache:\n    provider: Redis\n"), noEnv)
	if err != nil || cfg.Spec.Cache.Provider != "redis" || cfg.Spec.Cache.Parameters != DefaultRedisParameters {
		t.Fatalf("redis, lower-cased, with the default parameters: %v %+v", err, cfg.Spec.Cache)
	}
	cfg, err = ParseEdgePort([]byte(valid+"  cache:\n    provider: redis\n    parameters: ${REDIS}\n"),
		ResolveOptions{Env: EnvFromMap(map[string]string{"REDIS": "host=redis,port=6380"})})
	if err != nil || cfg.Spec.Cache.Parameters != "host=redis,port=6380" {
		t.Fatalf("${VAR} resolved: %v %+v", err, cfg.Spec.Cache)
	}
	routr := "apiVersion: v3\nkind: Routr\nspec:\n  data: {backend: files, path: /r}\n  edgeport:\n    transport: [{protocol: udp, port: 5060}]\n"
	one, err := ParseRoutr([]byte(routr+"    cache: {provider: redis, parameters: 'host=redis'}\n"), noEnv)
	if err != nil || one.EdgePortConfig().Spec.Cache.Provider != "redis" || one.EdgePortConfig().Spec.Cache.Parameters != "host=redis" {
		t.Fatalf("routr.yaml takes it under spec.edgeport: %v", err)
	}
	if one, err = ParseRoutr([]byte(routr), noEnv); err != nil || one.Spec.EdgePort.Cache.Provider != "memory" {
		t.Fatalf("routr.yaml defaults to memory: %v", err)
	}

	for lines, want := range map[string]string{
		"cache: redis":                                   "cache should be object",
		"cache: {parameters: 'host=x'}":                  "cache should have required property 'provider'",
		"cache: {provider: disk}":                        "cache.provider should be equal to one of the allowed values",
		"cache: {provider: redis, parameters: [a]}":      "cache.parameters should be string",
		"cache: {provider: redis, parameters: 'x'}":      "cache.parameters: invalid parameters string; should be something like 'host=localhost,port=6379'",
		"cache: {provider: redis, parameters: 'port=1'}": "cache.parameters: invalid parameters string: host is required; should be something like 'host=localhost,port=6379'",
	} {
		if _, err := ParseEdgePort([]byte(valid+"  "+lines+"\n"), noEnv); err == nil || !strings.HasSuffix(err.Error(), "spec."+want) {
			t.Errorf("edgeport.yaml %s: %v", lines, err)
		}
		if _, err := ParseRoutr([]byte(routr+"    "+lines+"\n"), noEnv); err == nil || !strings.HasSuffix(err.Error(), "spec.edgeport."+want) {
			t.Errorf("routr.yaml %s: %v", lines, err)
		}
	}
	if _, err := ParseRoutr([]byte(routr+"    cache: {provider: redis, host: x}\n"), noEnv); err == nil || !strings.HasSuffix(err.Error(), "spec.edgeport.cache.host: unknown key") {
		t.Errorf("routr.yaml refuses an unknown key: %v", err)
	}
}
