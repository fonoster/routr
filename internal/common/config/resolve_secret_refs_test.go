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
	"reflect"
	"strings"
	"testing"
)

// The cases of mods/common/test/resolve_secret_refs.unit.test.ts.

// secretsDir writes the files the k8s and file cases read:
// <dir>/db/url and <dir>/plain, each with a trailing newline.
func secretsDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "db"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "db", "url"), []byte("postgres://u:p@db/x\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "plain"), []byte("s3cr3t\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestResolveSecretRefsEnv(t *testing.T) {
	out, err := ResolveSecretRefs(map[string]any{"key": "secret://env/DG_KEY"}, SecretOptions{Env: EnvFromMap(map[string]string{"DG_KEY": "dg"})})
	if err != nil || !reflect.DeepEqual(out, map[string]any{"key": "dg"}) {
		t.Errorf("%v %v", out, err)
	}

	_, err = ResolveSecretRefs(map[string]any{"providers": map[string]any{"dg": map[string]any{"key": "secret://env/MISSING"}}}, SecretOptions{Env: EnvFromMap(nil)})
	want := "providers.dg.key: secret://env/MISSING: environment variable MISSING is not set"
	if err == nil || err.Error() != want {
		t.Errorf("unset: %v", err)
	}
	_, err = ResolveSecretRefs("secret://env/EMPTY", SecretOptions{Env: EnvFromMap(map[string]string{"EMPTY": ""})})
	if err == nil || !strings.HasPrefix(err.Error(), "(root): secret://env/EMPTY: environment variable EMPTY is not set") {
		t.Errorf("empty counts as unset: %v", err)
	}

	t.Setenv("ROUTR_TEST_SECRET", "from-process")
	out, err = ResolveSecretRefs("secret://env/ROUTR_TEST_SECRET", SecretOptions{})
	if err != nil || out != "from-process" {
		t.Errorf("process env by default: %v %v", out, err)
	}
}

func TestResolveSecretRefsFile(t *testing.T) {
	dir := secretsDir(t)

	out, err := ResolveSecretRefs(map[string]any{"a": "secret://file" + filepath.Join(dir, "plain")}, SecretOptions{})
	if err != nil || !reflect.DeepEqual(out, map[string]any{"a": "s3cr3t"}) {
		t.Errorf("drops one trailing newline: %v %v", out, err)
	}

	ref := "secret://file" + filepath.Join(dir, "nope")
	_, err = ResolveSecretRefs(map[string]any{"a": ref}, SecretOptions{})
	want := "a: " + ref + ": cannot read " + filepath.Join(dir, "nope") + " (ENOENT)"
	if err == nil || err.Error() != want {
		t.Errorf("missing file: %v", err)
	}

	_, err = ResolveSecretRefs(map[string]any{"a": "secret://file" + dir}, SecretOptions{})
	if err == nil || !strings.HasSuffix(err.Error(), "(EISDIR)") {
		t.Errorf("a directory: %v", err)
	}

	_, err = ResolveSecretRefs("secret://file", SecretOptions{})
	if err == nil || err.Error() != "(root): secret://file: missing file path" {
		t.Errorf("no path: %v", err)
	}
	_, err = ResolveSecretRefs("secret://file/", SecretOptions{})
	if err == nil || err.Error() != "(root): secret://file/: missing file path" {
		t.Errorf("empty path: %v", err)
	}
}

func TestResolveSecretRefsNeverPutsContentInAnError(t *testing.T) {
	read := func(string) (string, error) { return "", errors.New("s3cr3t") }
	_, err := ResolveSecretRefs(map[string]any{"a": "secret://file/x"}, SecretOptions{ReadFile: read})
	if err == nil || err.Error() != "a: secret://file/x: cannot read /x" {
		t.Errorf("%v", err)
	}
}

func TestResolveSecretRefsK8s(t *testing.T) {
	dir := secretsDir(t)

	out, err := ResolveSecretRefs(map[string]any{"db": "secret://k8s/db#url"}, SecretOptions{SecretsDir: dir, Env: EnvFromMap(nil)})
	if err != nil || !reflect.DeepEqual(out, map[string]any{"db": "postgres://u:p@db/x"}) {
		t.Errorf("<secretsDir>/<secret>/<key>: %v %v", out, err)
	}

	var paths []string
	read := func(path string) (string, error) {
		paths = append(paths, path)
		return "v", nil
	}
	if _, err := ResolveSecretRefs("secret://k8s/db#url", SecretOptions{Env: EnvFromMap(map[string]string{"ROUTR_SECRETS_DIR": "/s"}), ReadFile: read}); err != nil {
		t.Fatal(err)
	}
	if _, err := ResolveSecretRefs("secret://k8s/db#url", SecretOptions{Env: EnvFromMap(nil), ReadFile: read}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(paths, []string{"/s/db/url", "/var/run/routr/secrets/db/url"}) {
		t.Errorf("default secretsDir: %v", paths)
	}

	env := EnvFromMap(map[string]string{"POD_NAMESPACE": "routr"})
	out, err = ResolveSecretRefs("secret://k8s/routr/db#url", SecretOptions{Env: env, SecretsDir: dir})
	if err != nil || out != "postgres://u:p@db/x" {
		t.Errorf("the pod's namespace: %v %v", out, err)
	}
	_, err = ResolveSecretRefs("secret://k8s/other/db#url", SecretOptions{Env: env, SecretsDir: dir})
	if err == nil || !strings.Contains(err.Error(), "namespace other") || strings.Contains(err.Error(), "u:p") {
		t.Errorf("another namespace: %v", err)
	}
	out, err = ResolveSecretRefs("secret://k8s/other/db#url", SecretOptions{Env: EnvFromMap(nil), SecretsDir: dir})
	if err != nil || out != "postgres://u:p@db/x" {
		t.Errorf("any namespace when the pod's is unknown: %v %v", out, err)
	}
}

func TestResolveSecretRefsWalksAndLeavesNonExactReferencesAlone(t *testing.T) {
	input := map[string]any{"a": map[string]any{"b": []any{"secret://env/ONE", "literal", map[string]any{"c": "x secret://env/ONE"}, 7, nil}}}
	out, err := ResolveSecretRefs(input, SecretOptions{Env: EnvFromMap(map[string]string{"ONE": "1"})})
	want := map[string]any{"a": map[string]any{"b": []any{"1", "literal", map[string]any{"c": "x secret://env/ONE"}, 7, nil}}}
	if err != nil || !reflect.DeepEqual(out, want) {
		t.Errorf("%v %v", out, err)
	}
	if input["a"].(map[string]any)["b"].([]any)[0] != "secret://env/ONE" {
		t.Error("mutated the input")
	}
	out, err = ResolveSecretRefs(map[any]any{"k": "secret://env/ONE"}, SecretOptions{Env: EnvFromMap(map[string]string{"ONE": "1"})})
	if err != nil || !reflect.DeepEqual(out, map[string]any{"k": "1"}) {
		t.Errorf("non-string YAML keys: %v %v", out, err)
	}
}

func TestResolveSecretRefsRejectsMalformedReferences(t *testing.T) {
	cases := map[string]string{
		"secret://vault/x":        "unsupported reference secret://vault/x (use secret://env/NAME, secret://file/<path> or secret://k8s/<secret>#<key>)",
		"secret://":               "unsupported reference secret:// (use",
		"secret://k8s/db":         "secret://k8s/db: missing #<key>",
		"secret://env/1BAD":       "invalid variable name in secret://env/1BAD",
		"secret://env/":           "invalid variable name in secret://env/",
		"secret://k8s/a/b/c#k":    "secret://k8s/a/b/c#k: expected secret://k8s/[<namespace>/]<secret>#<key>",
		"secret://k8s/Bad#k":      "secret://k8s/Bad#k: expected secret://k8s/[<namespace>/]<secret>#<key>",
		"secret://k8s/db#bad key": "secret://k8s/db#bad key: invalid key",
		"secret://k8s/db#":        "secret://k8s/db#: invalid key",
	}
	for ref, want := range cases {
		_, err := ResolveSecretRefs(ref, SecretOptions{Env: EnvFromMap(nil)})
		if err == nil || !strings.HasPrefix(err.Error(), "(root): "+want) {
			t.Errorf("%s: %v", ref, err)
		}
	}
}
