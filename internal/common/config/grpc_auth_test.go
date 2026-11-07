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
	"reflect"
	"strings"
	"testing"
)

const dataHead = "apiVersion: v3\nkind: Routr\nspec:\n  data:\n    backend: files\n    path: /r\n"

func TestServerAuthReadsItsKeys(t *testing.T) {
	opts := ResolveOptions{Env: EnvFromMap(map[string]string{"API_KEY": "from-the-env"})}
	cfg, err := ParseData([]byte(dataHead+`    insecure: true
    apiKeys: ["secret://env/API_KEY", literal]
    tls: { certFile: /c, keyFile: /k, clientCAFile: /ca }
`), opts)
	if err != nil {
		t.Fatal(err)
	}
	want := ServerAuth{
		Insecure: true,
		APIKeys:  []string{"from-the-env", "literal"},
		TLS:      &ServerTLS{CertFile: "/c", KeyFile: "/k", ClientCAFile: "/ca"},
	}
	if !reflect.DeepEqual(cfg.Spec.Data.ServerAuth, want) {
		t.Errorf("got %+v, want %+v", cfg.Spec.Data.ServerAuth, want)
	}
}

func TestServerAuthAuthenticated(t *testing.T) {
	for name, tc := range map[string]struct {
		auth ServerAuth
		want bool
	}{
		"nothing":     {ServerAuth{}, false},
		"insecure":    {ServerAuth{Insecure: true}, false},
		"TLS alone":   {ServerAuth{TLS: &ServerTLS{CertFile: "/c", KeyFile: "/k"}}, false},
		"an API key":  {ServerAuth{APIKeys: []string{"k"}}, true},
		"a client CA": {ServerAuth{TLS: &ServerTLS{CertFile: "/c", KeyFile: "/k", ClientCAFile: "/ca"}}, true},
	} {
		if got := tc.auth.Authenticated(); got != tc.want {
			t.Errorf("%s: %v, want %v", name, got, tc.want)
		}
	}
}

func TestServerAuthRefusesBadKeys(t *testing.T) {
	for name, tc := range map[string]struct{ text, names string }{
		"insecure":  {"    insecure: yes please\n", "spec.data.insecure"},
		"keys":      {"    apiKeys: one\n", "spec.data.apiKeys"},
		"empty key": {"    apiKeys: ['']\n", "spec.data.apiKeys[0]"},
		"tls":       {"    tls: on\n", "spec.data.tls"},
		"no cert":   {"    tls: { keyFile: /k }\n", "spec.data.tls.certFile"},
		"no key":    {"    tls: { certFile: /c }\n", "spec.data.tls.keyFile"},
		"unknown":   {"    tls: { certFile: /c, keyFile: /k, caFile: /ca }\n", "spec.data.tls.caFile"},
	} {
		_, err := ParseData([]byte(dataHead+tc.text), noEnv)
		if err == nil || !strings.Contains(err.Error(), tc.names) {
			t.Errorf("%s: names %s: %v", name, tc.names, err)
		}
	}
}

func TestASecretIsNotInTheError(t *testing.T) {
	opts := ResolveOptions{Env: EnvFromMap(map[string]string{"API_KEY": "the-secret-value"})}
	_, err := ParseData([]byte(dataHead+"    insecure: secret://env/API_KEY\n"), opts)
	if err == nil || strings.Contains(err.Error(), "the-secret-value") {
		t.Errorf("names the key, not the value: %v", err)
	}
}

func TestClientAuthKeys(t *testing.T) {
	head := "kind: Connect\nspec:\n  locationAddr: l:1\n  apiAddr: a:1\n"
	cfg, err := ParseConnect([]byte(head+`  apiAuth:
    apiKey: k1
    tls: { caFile: /ca, certFile: /c, keyFile: /k, serverName: api }
  locationAuth: { apiKey: k2 }
  verifierAuth: { apiKey: k3 }
  apiKeys: [k4]
`), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Spec.APIAuth.APIKey != "k1" || cfg.Spec.APIAuth.TLS.ServerName != "api" || cfg.Spec.LocationAuth.APIKey != "k2" || cfg.Spec.VerifierAuth.APIKey != "k3" || cfg.Spec.APIKeys[0] != "k4" {
		t.Errorf("got %+v", cfg.Spec)
	}
	for name, tc := range map[string]struct{ text, names string }{
		"unknown":       {"  apiAuth: { key: k }\n", "spec.apiAuth.key"},
		"empty key":     {"  apiAuth: { apiKey: '' }\n", "spec.apiAuth.apiKey"},
		"cert no key":   {"  apiAuth: { tls: { certFile: /c } }\n", "certFile and keyFile"},
		"not an object": {"  locationAuth: yes\n", "spec.locationAuth"},
	} {
		_, err := ParseConnect([]byte(head+tc.text), noEnv)
		if err == nil || !strings.Contains(err.Error(), tc.names) {
			t.Errorf("%s: names %s: %v", name, tc.names, err)
		}
	}
}

func TestEveryComponentTakesTheServerKeys(t *testing.T) {
	keys := "  apiKeys: [k]\n  insecure: true\n"
	cfgConnect, err := ParseConnect([]byte("kind: Connect\nspec:\n  locationAddr: l:1\n  apiAddr: a:1\n"+keys), noEnv)
	if err != nil || cfgConnect.Spec.APIKeys[0] != "k" {
		t.Errorf("connect.yaml: %v", err)
	}
	cfgDispatcher, err := ParseDispatcher([]byte("kind: D\napiVersion: v2\nref: r\nspec:\n  processors:\n    - { ref: p, addr: a:1, methods: [INVITE], matchFunc: 'req => true' }\n  backendAuth: { apiKey: b }\n"+keys), noEnv)
	if err != nil || cfgDispatcher.Spec.APIKeys[0] != "k" || cfgDispatcher.Spec.BackendAuth.APIKey != "b" {
		t.Errorf("dispatcher.yaml: %v", err)
	}
	cfg, err := ParseRoutr([]byte("apiVersion: v3\nkind: Routr\nspec:\n  edgeport:\n    transport:\n      - { protocol: udp, port: 5060 }\n  data: { backend: files, path: /r, apiKeys: [d] }\n  connect: { apiKeys: [c], verifierAuth: { apiKey: v } }\n  location: { apiKeys: [l] }\n  dispatcher: { apiKeys: [p] }\n  requester: { apiKeys: [q] }\n"), noEnv)
	if err != nil {
		t.Fatalf("routr.yaml: %v", err)
	}
	got := []string{cfg.Spec.Data.APIKeys[0], cfg.Spec.Connect.APIKeys[0], cfg.Spec.Location.APIKeys[0], cfg.Spec.Dispatcher.APIKeys[0], cfg.Spec.Requester.APIKeys[0], cfg.Spec.Connect.VerifierAuth.APIKey}
	if !reflect.DeepEqual(got, []string{"d", "c", "l", "p", "q", "v"}) {
		t.Errorf("routr.yaml: %v", got)
	}
}
