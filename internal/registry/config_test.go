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

package registry

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

var testResolve = config.ResolveOptions{Env: config.EnvFromMap(nil)}

func TestLoadFileReadsTheRepositoryConfig(t *testing.T) {
	file, err := LoadFile(filepath.Join("..", "..", "config", "registry.yaml"), testResolve)
	if err != nil {
		t.Fatal(err)
	}
	spec := file.Spec
	if spec.Cache.Provider != "memory" {
		t.Errorf("cache: %+v", spec.Cache)
	}
	if len(spec.EdgePorts) != 2 {
		t.Fatalf("edgePorts: %+v", spec.EdgePorts)
	}
	if spec.EdgePorts[0].Address != "sip01.edgeport.net:5060" || spec.EdgePorts[0].Region != "us-east1" {
		t.Errorf("first edgePort: %+v", spec.EdgePorts[0])
	}
	if spec.EdgePorts[1].Address != "sip02.edgeport.net:6060" || spec.EdgePorts[1].Region != "" {
		t.Errorf("second edgePort: %+v", spec.EdgePorts[1])
	}
	if spec.RequesterAddr != "requester:51909" || spec.APIAddr != "apiserver:51907" || spec.RegisterInterval != 20 {
		t.Errorf("spec: %+v", spec)
	}
	if len(spec.Methods) != 2 || spec.Methods[0] != "INVITE" || spec.Methods[1] != "MESSAGE" {
		t.Errorf("methods: %v", spec.Methods)
	}
	if !spec.EnableHealthchecks {
		t.Error("health checks are on by default")
	}
}

func TestLoadFileFailsOnAMissingFile(t *testing.T) {
	if _, err := LoadFile(filepath.Join("testdata", "none.yaml"), testResolve); err == nil {
		t.Error("a missing file is an error")
	}
}

const minimalFile = `kind: Registry
apiVersion: v2beta1
spec:
  requesterAddr: requester:51909
  apiAddr: apiserver:51907
  edgePorts:
    - address: sip01.edgeport.net:5060
`

func TestParseFileDefaults(t *testing.T) {
	file, err := ParseFile([]byte(minimalFile), testResolve)
	if err != nil {
		t.Fatal(err)
	}
	if file.LogLevel != "info" || file.Spec.RegisterInterval != 60 || file.Spec.Cache.Provider != "memory" || !file.Spec.EnableHealthchecks {
		t.Errorf("defaults: %+v", file)
	}
}

func TestParseFileTakesTheOptionalKeys(t *testing.T) {
	data := minimalFile + `  registerInterval: 0.5
  enableHealthchecks: false
  cache:
    provider: redis
logLevel: debug
`
	file, err := ParseFile([]byte(data), testResolve)
	if err != nil {
		t.Fatal(err)
	}
	if file.LogLevel != "debug" || file.Spec.RegisterInterval != 0.5 || file.Spec.EnableHealthchecks {
		t.Errorf("file: %+v", file)
	}
	if file.Spec.Cache.Parameters != "host=localhost,port=6379" {
		t.Errorf("redis parameters default: %+v", file.Spec.Cache)
	}
}

func TestAPIVersion(t *testing.T) {
	for _, version := range []string{"v2beta1", "v2", "v3"} {
		data := strings.Replace(minimalFile, "v2beta1", version, 1)
		if _, err := ParseFile([]byte(data), testResolve); err != nil {
			t.Errorf("%s: %v", version, err)
		}
	}
	for name, data := range map[string]string{
		"b":       strings.Replace(minimalFile, "apiVersion: v2beta1", "apiVersion: b", 1),
		"missing": strings.Replace(minimalFile, "apiVersion: v2beta1\n", "", 1),
	} {
		_, err := ParseFile([]byte(data), testResolve)
		if err == nil || err.Error() != ".apiVersion should be equal to one of the allowed values (v2beta1, v2, v3)" {
			t.Errorf("%s: got %v", name, err)
		}
	}
}

func TestParseFileFailures(t *testing.T) {
	spec := func(extra string) string { return minimalFile + extra }
	for name, tc := range map[string]struct {
		data string
		want string
	}{
		"no kind":       {"apiVersion: v2beta1\nspec: {}\n", "required property 'kind'"},
		"no apiVersion": {"kind: Registry\nspec: {}\n", ".apiVersion"},
		"no spec":       {"kind: Registry\napiVersion: v2beta1\n", "required property 'spec'"},
		"bad kind":      {strings.Replace(minimalFile, "Registry", "Location", 1), ".kind"},
		"bad version":   {strings.Replace(minimalFile, "v2beta1", "v1", 1), ".apiVersion"},
		"bad metadata":  {spec("metadata: 1\n"), ".metadata"},
		"bad level":     {spec("logLevel: loud\n"), ".logLevel"},
		"spec no map":   {"kind: Registry\napiVersion: v2beta1\nspec: 1\n", ".spec should be object"},
		"no requester":  {strings.Replace(minimalFile, "  requesterAddr: requester:51909\n", "", 1), "'requesterAddr'"},
		"no api":        {strings.Replace(minimalFile, "  apiAddr: apiserver:51907\n", "", 1), "'apiAddr'"},
		"no edgePorts":  {"kind: Registry\napiVersion: v2beta1\nspec:\n  requesterAddr: a\n  apiAddr: b\n", "'edgePorts'"},
		"requester int": {strings.Replace(minimalFile, "requester:51909", "1", 1), ".spec.requesterAddr"},
		"interval text": {spec("  registerInterval: often\n"), ".spec.registerInterval should be number"},
		"interval zero": {spec("  registerInterval: 0\n"), ".spec.registerInterval should be > 0"},
		"health text":   {spec("  enableHealthchecks: maybe\n"), ".spec.enableHealthchecks"},
		"cache text":    {spec("  cache: memory\n"), ".spec.cache should be object"},
		"no provider":   {spec("  cache: {}\n"), "'provider'"},
		"bad provider":  {spec("  cache: {provider: disk}\n"), ".spec.cache.provider"},
		"bad params":    {spec("  cache: {provider: redis, parameters: 1}\n"), ".spec.cache.parameters"},
		"methods text":  {spec("  methods: INVITE\n"), ".spec.methods should be array"},
		"method int":    {spec("  methods: [1]\n"), ".spec.methods[0]"},
		"method twice":  {spec("  methods: [INVITE, INVITE]\n"), "duplicate"},
		"edge text":     {strings.Replace(minimalFile, "    - address: sip01.edgeport.net:5060\n", "    - sip01\n", 1), ".spec.edgePorts[0] should be object"},
		"edge address":  {strings.Replace(minimalFile, "address: sip01.edgeport.net:5060", "region: us-east1", 1), "'address'"},
		"edge no list":  {strings.Replace(minimalFile, "  edgePorts:\n    - address: sip01.edgeport.net:5060\n", "  edgePorts: sip01\n", 1), ".spec.edgePorts should be array"},
	} {
		if _, err := ParseFile([]byte(tc.data), testResolve); err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: %v", name, err)
		}
	}
}
