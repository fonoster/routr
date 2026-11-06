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
	"regexp"
	"strings"
	"testing"
)

// The cases of mods/common/test/interpolate_env.unit.test.ts.

func TestInterpolateEnvReplacesReferences(t *testing.T) {
	env := EnvFromMap(map[string]string{"FOO": "1", "ONE": "1", "TWO": "2", "HOST": "db", "PORT": "5432"})

	out, err := InterpolateEnv(map[string]any{"a": "x-${FOO}"}, env, nil)
	if err != nil || !reflect.DeepEqual(out, map[string]any{"a": "x-1"}) {
		t.Errorf("inside a string: %v %v", out, err)
	}

	out, err = InterpolateEnv(map[string]any{"a": map[string]any{"b": []any{"${ONE}", "literal", map[string]any{"c": "${TWO}"}}}}, env, nil)
	want := map[string]any{"a": map[string]any{"b": []any{"1", "literal", map[string]any{"c": "2"}}}}
	if err != nil || !reflect.DeepEqual(out, want) {
		t.Errorf("nested objects and arrays: %v %v", out, err)
	}

	out, err = InterpolateEnv("${HOST}:${PORT}", env, nil)
	if err != nil || out != "db:5432" {
		t.Errorf("multiple references: %v %v", out, err)
	}

	out, err = InterpolateEnv(map[any]any{"a": "${FOO}", 5060: "x"}, env, nil)
	if err != nil || !reflect.DeepEqual(out, map[string]any{"a": "1", "5060": "x"}) {
		t.Errorf("non-string YAML keys: %v %v", out, err)
	}
}

func TestInterpolateEnvLeavesLiteralsAndPrimitives(t *testing.T) {
	input := map[string]any{"price": "$5.00", "url": "http://asterisk:8088", "enabled": false, "count": 3, "nothing": nil, "odd": "${1BAD}"}
	out, err := InterpolateEnv(input, EnvFromMap(nil), nil)
	if err != nil || !reflect.DeepEqual(out, input) {
		t.Errorf("%v %v", out, err)
	}
}

func TestInterpolateEnvDoesNotMutateTheInput(t *testing.T) {
	input := map[string]any{"a": "${FOO}", "list": []any{"${FOO}"}}
	if _, err := InterpolateEnv(input, EnvFromMap(map[string]string{"FOO": "1"}), nil); err != nil {
		t.Fatal(err)
	}
	if input["a"] != "${FOO}" || input["list"].([]any)[0] != "${FOO}" {
		t.Errorf("mutated: %v", input)
	}
}

func TestInterpolateEnvDefaults(t *testing.T) {
	cases := []struct {
		input string
		env   map[string]string
		want  string
	}{
		{"${FOO:-d}", nil, "d"},
		{"${FOO:-d}", map[string]string{"FOO": ""}, "d"},
		{"${FOO:-}", nil, ""},
		{"${LEVEL:-info}", map[string]string{"LEVEL": "debug"}, "debug"},
	}
	for _, c := range cases {
		out, err := InterpolateEnv(c.input, EnvFromMap(c.env), nil)
		if err != nil || out != c.want {
			t.Errorf("%s with %v: got %v, %v", c.input, c.env, out, err)
		}
	}
}

func TestInterpolateEnvUnsetVariable(t *testing.T) {
	pattern := regexp.MustCompile(`^a: .*\$\{FOO\}`)
	for _, env := range []map[string]string{nil, {"FOO": ""}} {
		_, err := InterpolateEnv(map[string]any{"a": "${FOO}"}, EnvFromMap(env), nil)
		if err == nil || !pattern.MatchString(err.Error()) {
			t.Errorf("env %v: %v", env, err)
		}
	}
	_, err := InterpolateEnv("${FOO}", EnvFromMap(nil), nil)
	if err == nil || !strings.HasPrefix(err.Error(), "(root): references undefined environment variable ${FOO} and no default was given") {
		t.Errorf("root path: %v", err)
	}
	_, err = InterpolateEnv(map[string]any{"a": []any{"ok", "${FOO}"}}, EnvFromMap(nil), nil)
	if err == nil || !strings.HasPrefix(err.Error(), "a[1]: ") {
		t.Errorf("array path: %v", err)
	}
}

func TestInterpolateEnvAllowedPaths(t *testing.T) {
	env := EnvFromMap(map[string]string{"DB": "pg", "X": "info", "NATS": "n", "NAME": "x"})

	_, err := InterpolateEnv(map[string]any{"db": map[string]any{"url": "${DB}"}, "logs": map[string]any{"level": "${X}"}}, env, []string{"db.*"})
	if err == nil || !strings.HasPrefix(err.Error(), "logs.level: ${...} is only allowed at db.*") {
		t.Errorf("outside allowedPaths: %v", err)
	}

	out, err := InterpolateEnv(map[string]any{"db": "${DB}", "nats": map[string]any{"url": "${NATS}"}, "name": "${NAME}"}, env, []string{"db", "nats.*", "name"})
	want := map[string]any{"db": "pg", "nats": map[string]any{"url": "n"}, "name": "x"}
	if err != nil || !reflect.DeepEqual(out, want) {
		t.Errorf("named paths: %v %v", out, err)
	}

	if _, err := InterpolateEnv("${DB}", env, []string{"*"}); err != nil {
		t.Errorf("* allows everything: %v", err)
	}
	_, err = InterpolateEnv(map[string]any{"a": "${DB}"}, env, []string{})
	if err == nil || !strings.Contains(err.Error(), "no key path here") {
		t.Errorf("empty allowedPaths: %v", err)
	}
	if _, err := InterpolateEnv(map[string]any{"a": "plain"}, env, []string{}); err != nil {
		t.Errorf("a literal needs no permission: %v", err)
	}
}

func TestInterpolateEnvReadsTheProcessEnvironmentByDefault(t *testing.T) {
	t.Setenv("ROUTR_TEST_INTERPOLATE", "yes")
	out, err := InterpolateEnv("${ROUTR_TEST_INTERPOLATE}", nil, nil)
	if err != nil || out != "yes" {
		t.Errorf("%v %v", out, err)
	}
}
