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
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// loaded is what the loader tests decode into.
type loaded struct {
	Name string `yaml:"name"`
	Port int    `yaml:"port"`
	Spec struct {
		Addrs  []string `yaml:"addrs"`
		Nested struct {
			Flag bool `yaml:"flag"`
		} `yaml:"nested"`
	} `yaml:"spec"`
	finished int
}

func (l *loaded) finish() error {
	l.finished++
	if l.Name == "refused" {
		return errors.New("name: refused by finish")
	}
	return nil
}

func write(t *testing.T, name, text string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(text), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLoadReadsResolvesValidatesDecodesAndFinishes(t *testing.T) {
	path := write(t, "x.yaml", "name: ${NAME}\nport: 5060\nspec:\n  addrs: [secret://env/ADDR]\n  nested: {flag: true}\n")
	env := EnvFromMap(map[string]string{"NAME": "routr", "ADDR": "10.0.0.1"})
	validated := map[string]any(nil)
	var into loaded
	err := Load(path, func(tree map[string]any) error { validated = tree; return nil }, &into, ResolveOptions{Env: env})
	if err != nil {
		t.Fatal(err)
	}
	if validated["name"] != "routr" {
		t.Errorf("the validator sees the resolved tree: %v", validated)
	}
	if into.Name != "routr" || into.Port != 5060 || into.Spec.Addrs[0] != "10.0.0.1" || !into.Spec.Nested.Flag || into.finished != 1 {
		t.Errorf("decoded and finished: %+v", into)
	}
	// JSON is YAML
	var fromJSON loaded
	if err := Parse([]byte(`{"name":"j","port":1}`), nil, &fromJSON, noEnv); err != nil || fromJSON.Name != "j" {
		t.Errorf("JSON: %+v %v", fromJSON, err)
	}
}

func TestLoadErrorsNameTheFileAndTheKeyNeverAValue(t *testing.T) {
	dir := t.TempDir()
	ok := write(t, "ok.yaml", "name: a\n")
	cases := map[string]struct {
		path     string
		validate Validator
		env      map[string]string
		want     string
	}{
		"unset path":        {"", nil, nil, "CONFIG_PATH is not set"},
		"missing file":      {filepath.Join(dir, "nope.yaml"), nil, nil, "config file " + filepath.Join(dir, "nope.yaml") + " does not exist"},
		"a directory":       {dir, nil, nil, "config file " + dir + " does not exist"},
		"not yaml":          {write(t, "bad.yaml", "{{{"), nil, nil, ": file is not a valid JSON or YAML file"},
		"unset variable":    {write(t, "var.yaml", "name: ${NAME}\n"), nil, nil, ": name: references undefined environment variable ${NAME}"},
		"unset secret":      {write(t, "secret.yaml", "spec:\n  addrs: [secret://env/S3CR3T_VAR]\n"), nil, nil, ": spec.addrs[0]: secret://env/S3CR3T_VAR: environment variable S3CR3T_VAR is not set"},
		"validator":         {ok, func(map[string]any) error { return errors.New("name: should be shorter") }, nil, ": name: should be shorter"},
		"finish":            {write(t, "finish.yaml", "name: refused\n"), nil, nil, ": name: refused by finish"},
		"scalar mismatch":   {write(t, "port.yaml", "name: a\nport: s3cr3t\n"), nil, nil, ": port: should be integer"},
		"nested mismatch":   {write(t, "nested.yaml", "spec:\n  nested:\n    flag: s3cr3t\n"), nil, nil, ": spec.nested.flag: should be boolean"},
		"array mismatch":    {write(t, "addrs.yaml", "spec:\n  addrs: s3cr3t\n"), nil, nil, ": spec.addrs: should be array"},
		"item mismatch":     {write(t, "item.yaml", "spec:\n  addrs: [a, {b: s3cr3t}]\n"), nil, nil, ": spec.addrs[1]: should be string"},
		"object mismatch":   {write(t, "object.yaml", "spec: s3cr3t\n"), nil, nil, ": spec: does not match the schema"},
		"resolved variable": {write(t, "resolved.yaml", "name: ${NAME}\nport: ${NAME}\n"), nil, map[string]string{"NAME": "s3cr3t"}, ": port: should be integer"},
	}
	for name, c := range cases {
		var into loaded
		err := Load(c.path, c.validate, &into, ResolveOptions{Env: EnvFromMap(c.env)})
		if err == nil {
			t.Errorf("%s: accepted", name)
			continue
		}
		if !strings.Contains(err.Error(), c.want) {
			t.Errorf("%s: got %q, want %q", name, err, c.want)
		}
		if c.path != "" && !strings.HasPrefix(err.Error(), "config file "+c.path) {
			t.Errorf("%s: names the file: %q", name, err)
		}
		if strings.Contains(err.Error(), "s3cr3t") {
			t.Errorf("%s: the error carries a value: %q", name, err)
		}
	}
}

// Every file kind resolves ${VAR} and secret:// references, through one
// loader.
func TestEveryFileKindResolvesReferences(t *testing.T) {
	env := EnvFromMap(map[string]string{"ADDR": "127.0.0.1:1", "KEY": cloakKey})
	opts := ResolveOptions{Env: env}
	dir := t.TempDir()

	routr, err := LoadRoutr(write(t, "routr.yaml", strings.Replace(routrMinimum, "path: /etc/routr/resources", "path: "+dir+"\n    bindAddr: ${ADDR}", 1)), opts)
	if err != nil || routr.Spec.Data.BindAddr != "127.0.0.1:1" {
		t.Errorf("routr.yaml: %+v %v", routr, err)
	}
	location, err := LoadLocation(write(t, "location.yaml", strings.Replace(locationValid, "0.0.0.0:51902", "secret://env/ADDR", 1)), opts)
	if err != nil || location.Spec.BindAddr != "127.0.0.1:1" {
		t.Errorf("location.yaml: %+v %v", location, err)
	}
	connect, err := LoadConnect(write(t, "connect.yaml", "apiVersion: v3\nkind: Connect\nspec:\n  locationAddr: ${ADDR}\n  apiAddr: secret://env/ADDR\n"), opts)
	if err != nil || connect.Spec.LocationAddr != "127.0.0.1:1" || connect.Spec.APIAddr != "127.0.0.1:1" {
		t.Errorf("connect.yaml: %+v %v", connect, err)
	}
	dispatcher, err := LoadDispatcher(write(t, "dispatcher.yaml", strings.Replace(dispatcherValid, "connect:51904", "${ADDR}", 1)), opts)
	if err != nil || dispatcher.Spec.Processors[0].Addr != "127.0.0.1:1" {
		t.Errorf("dispatcher.yaml: %+v %v", dispatcher, err)
	}
	edgeport, err := LoadEdgePort(write(t, "edgeport.yaml", strings.Replace(valid, "dispatcher:51901", "secret://env/ADDR", 1)), opts)
	if err != nil || edgeport.Spec.Processor.Addr != "127.0.0.1:1" {
		t.Errorf("edgeport.yaml: %+v %v", edgeport, err)
	}
	data, err := LoadData(write(t, "data.yaml", "apiVersion: v3\nspec:\n  data: {backend: postgres, url: postgres://db, encryptionKey: '${KEY}'}\n"), opts)
	if err != nil || data.Spec.Data.EncryptionKey != cloakKey {
		t.Errorf("spec.data: %+v %v", data, err)
	}
}
