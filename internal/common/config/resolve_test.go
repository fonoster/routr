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
	"reflect"
	"strings"
	"testing"
)

func TestResolveRunsPlaceholdersThenReferences(t *testing.T) {
	env := EnvFromMap(map[string]string{"RELEASE": "routr", "DB": "pg", "KEY": "secret://env/DB"})
	read := func(path string) (string, error) {
		if path == "/var/run/routr/secrets/routr-db/url" {
			return "postgres://x\n", nil
		}
		return "", os.ErrNotExist
	}
	input := map[string]any{
		"url":     "secret://k8s/${RELEASE}-db#url",
		"literal": "${DB}",
		"twice":   "${KEY}",
		"port":    5432,
	}
	out, err := Resolve(input, ResolveOptions{Env: env, ReadFile: read})
	if err != nil {
		t.Fatal(err)
	}
	// RoutrOne 2 ran the passes in this order, so a placeholder may build a
	// reference and a placeholder whose value is a reference resolves too:
	// ${KEY} -> secret://env/DB -> pg.
	want := map[string]any{"url": "postgres://x", "literal": "pg", "twice": "pg", "port": 5432}
	if !reflect.DeepEqual(out, want) {
		t.Errorf("%v", out)
	}
}

func TestResolveReportsEitherStage(t *testing.T) {
	_, err := Resolve(map[string]any{"a": "${NOPE}"}, ResolveOptions{Env: EnvFromMap(nil)})
	if err == nil || !strings.HasPrefix(err.Error(), "a: references undefined environment variable ${NOPE}") {
		t.Errorf("placeholder: %v", err)
	}
	_, err = Resolve(map[string]any{"a": "secret://env/NOPE"}, ResolveOptions{Env: EnvFromMap(nil)})
	if err == nil || err.Error() != "a: secret://env/NOPE: environment variable NOPE is not set" {
		t.Errorf("reference: %v", err)
	}
	_, err = Resolve(map[string]any{"a": "${X}"}, ResolveOptions{Env: EnvFromMap(map[string]string{"X": "1"}), AllowedPaths: []string{"b"}})
	if err == nil || !strings.HasPrefix(err.Error(), "a: ${...} is only allowed at b") {
		t.Errorf("allowed paths: %v", err)
	}
}
