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

func TestParseData(t *testing.T) {
	cfg, err := ParseData([]byte("apiVersion: v3\nkind: Routr\nspec:\n  edgeport: {transport: []}\n  data:\n    backend: files\n    path: /etc/routr/resources\n"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Spec.Data, DataSpec{BindAddr: DefaultDataBindAddr, Backend: BackendFiles, Path: "/etc/routr/resources"}) || cfg.LogLevel != "info" {
		t.Errorf("the other sections are another component's; defaults filled: %+v", cfg)
	}
	cfg, err = ParseData([]byte("apiVersion: v3\nlogLevel: debug\nspec:\n  data:\n    backend: postgres\n    url: postgresql://routr:secret@db/routr\n    bindAddr: 127.0.0.1:51907\n"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Spec.Data, DataSpec{BindAddr: "127.0.0.1:51907", Backend: BackendPostgres, URL: "postgresql://routr:secret@db/routr"}) || cfg.LogLevel != "debug" {
		t.Errorf("%+v", cfg)
	}
}

func TestParseDataValidation(t *testing.T) {
	cases := map[string]struct{ text, want string }{
		"not yaml":             {"spec: [", "file is not a valid JSON or YAML file"},
		"no spec":              {"kind: Routr\n", "spec: should be object"},
		"no data section":      {"spec:\n  edgeport: {}\n", "spec.data: is required"},
		"no backend":           {"spec:\n  data: {path: /x}\n", "spec.data.backend: is required"},
		"unknown backend":      {"spec:\n  data: {backend: redis}\n", "spec.data.backend: should be equal to one of the allowed values"},
		"files without path":   {"spec:\n  data: {backend: files}\n", "spec.data.path: is required"},
		"postgres without url": {"spec:\n  data: {backend: postgres}\n", "spec.data.url: is required"},
		"bad bindAddr":         {"spec:\n  data: {backend: files, path: /x, bindAddr: 1}\n", "spec.data.bindAddr: should be string"},
		"bad encryptionKey":    {"spec:\n  data: {backend: files, path: /x, encryptionKey: s3cr3t}\n", "spec.data.encryptionKey: should be a cloak key"},
		"bad logLevel":         {"logLevel: 1\nspec:\n  data: {backend: files, path: /x}\n", "logLevel: should be string"},
		"unset secret":         {"spec:\n  data: {backend: postgres, url: 'secret://env/DATABASE_URL'}\n", "spec.data.url: secret://env/DATABASE_URL: environment variable DATABASE_URL is not set"},
		"unset placeholder":    {"spec:\n  data: {backend: postgres, url: 'postgresql://x', encryptionKey: '${CLOAK_KEY}'}\n", "spec.data.encryptionKey: references undefined environment variable ${CLOAK_KEY}"},
	}
	for name, c := range cases {
		_, err := ParseData([]byte("apiVersion: v3\n"+c.text), noEnv)
		if err == nil {
			t.Errorf("%s: accepted", name)
			continue
		}
		if !strings.HasPrefix(err.Error(), c.want) {
			t.Errorf("%s: got %q, want prefix %q", name, err, c.want)
		}
		if strings.Contains(err.Error(), "s3cr3t") {
			t.Errorf("%s: the error carries a value: %q", name, err)
		}
	}
}

func TestLoadData(t *testing.T) {
	dir := t.TempDir()
	for name, path := range map[string]string{"unset": "", "missing": filepath.Join(dir, "nope.yaml"), "a directory": dir} {
		if _, err := LoadData(path, noEnv); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	path := write(t, "routr.yaml", "apiVersion: v3\nspec:\n  data:\n    backend: files\n    path: ${RESOURCES}\n")
	cfg, err := LoadData(path, ResolveOptions{Env: EnvFromMap(map[string]string{"RESOURCES": dir})})
	if err != nil || cfg.Spec.Data.Path != dir {
		t.Errorf("%+v %v", cfg, err)
	}
	if _, err := LoadData(path, noEnv); err == nil || !strings.HasPrefix(err.Error(), "config file "+path+": spec.data.path: ") {
		t.Errorf("names the file and the key: %v", err)
	}
}

func TestDataSpecEnforceE164Numbers(t *testing.T) {
	base := "apiVersion: v3\nspec:\n  data:\n    backend: files\n    path: /x\n"
	cfg, err := ParseData([]byte(base), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.Spec.Data.EnforcesE164Numbers() {
		t.Error("absent: want on by default")
	}
	for value, want := range map[string]bool{"true": true, "false": false} {
		cfg, err := ParseData([]byte(base+"    enforceE164Numbers: "+value+"\n"), noEnv)
		if err != nil {
			t.Fatalf("%s: %v", value, err)
		}
		if got := cfg.Spec.Data.EnforcesE164Numbers(); got != want {
			t.Errorf("%s: EnforcesE164Numbers() = %v", value, got)
		}
	}
	for _, value := range []string{`"yes"`, "1", "yes", `"true"`} {
		_, err := ParseData([]byte(base+"    enforceE164Numbers: "+value+"\n"), noEnv)
		if err == nil || !strings.Contains(err.Error(), "spec.data.enforceE164Numbers: should be boolean") {
			t.Errorf("%s: got %v, want the boolean error", value, err)
		}
	}
	if !(DataSpec{}).EnforcesE164Numbers() {
		t.Error("the zero DataSpec enforces E.164")
	}
}
