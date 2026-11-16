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
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
)

// `secret://` references in config values, the port of
// mods/common/src/config/resolve_secret_refs.ts. A string value that is
// exactly a reference is replaced by the secret it names, so YAML never holds
// the raw secret:
//
//	secret://env/NAME                 the environment variable NAME
//	secret://file/<absolute path>     a file's contents
//	secret://k8s/<secret>#<key>       a Kubernetes Secret mounted as a volume,
//	secret://k8s/<ns>/<secret>#<key>  read from <secretsDir>/<secret>/<key>
//	                                  (default ROUTR_SECRETS_DIR or
//	                                  /var/run/routr/secrets). The namespace,
//	                                  when given, must be the pod's
//	                                  (POD_NAMESPACE) if that is known.
//
// File contents lose one trailing newline. Errors name the key path and the
// reference, never a value. Values that only contain `secret://` somewhere
// else are left alone.
const (
	secretPrefix      = "secret://"
	defaultSecretsDir = "/var/run/routr/secrets"
)

var (
	envNameRegex = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
	k8sNameRegex = regexp.MustCompile(`^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$`)
	k8sKeyRegex  = regexp.MustCompile(`^[-._a-zA-Z0-9]+$`)
)

// FileReader reads one file as text. os.ReadFile wrapped in ReadFileString
// is the default; tests inject their own so they need no real files.
type FileReader func(path string) (string, error)

// ReadFileString is the default FileReader.
func ReadFileString(path string) (string, error) {
	data, err := os.ReadFile(path)
	return string(data), err
}

// SecretOptions are the injectable parts of ResolveSecretRefs.
type SecretOptions struct {
	// Env resolves secret://env and the ROUTR_SECRETS_DIR and POD_NAMESPACE
	// settings; os.LookupEnv when nil.
	Env EnvLookup
	// ReadFile reads secret://file and secret://k8s targets; ReadFileString
	// when nil.
	ReadFile FileReader
	// SecretsDir is where Kubernetes Secrets are mounted; when empty,
	// ROUTR_SECRETS_DIR, then /var/run/routr/secrets.
	SecretsDir string
}

func (o SecretOptions) withDefaults() SecretOptions {
	if o.Env == nil {
		o.Env = os.LookupEnv
	}
	if o.ReadFile == nil {
		o.ReadFile = ReadFileString
	}
	return o
}

// ResolveSecretRefs returns a copy of a decoded config tree with every
// `secret://` value resolved. The input is not mutated. Errors name the key
// path and the reference (`db.url: secret://env/DB: environment variable DB
// is not set`), never a value.
func ResolveSecretRefs(input any, opts SecretOptions) (any, error) {
	return walkSecrets(input, opts.withDefaults(), "")
}

func isSecretRef(value any) (string, bool) {
	s, ok := value.(string)
	if !ok || !strings.HasPrefix(s, secretPrefix) {
		return "", false
	}
	return s, true
}

// errorCode names the OS error the way Node does (ENOENT, EACCES, EISDIR),
// so an operator reads the same message from both versions.
func errorCode(err error) string {
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return "ENOENT"
	case errors.Is(err, fs.ErrPermission):
		return "EACCES"
	case errors.Is(err, syscall.EISDIR):
		return "EISDIR"
	}
	return ""
}

// readSecretFile reads a secret file, dropping one trailing newline. The
// reader's error is never repeated: it could carry content.
func readSecretFile(ref, path string, opts SecretOptions) (string, error) {
	content, err := opts.ReadFile(path)
	if err != nil {
		if code := errorCode(err); code != "" {
			return "", fmt.Errorf("%s: cannot read %s (%s)", ref, path, code)
		}
		return "", fmt.Errorf("%s: cannot read %s", ref, path)
	}
	content = strings.TrimSuffix(content, "\n")
	return strings.TrimSuffix(content, "\r"), nil
}

// resolveSecretRef resolves one `secret://` reference. Its error never
// contains the secret.
func resolveSecretRef(ref string, opts SecretOptions) (string, error) {
	rest := strings.TrimPrefix(ref, secretPrefix)
	kind, target, _ := strings.Cut(rest, "/")

	switch kind {
	case "env":
		if !envNameRegex.MatchString(target) {
			return "", fmt.Errorf("invalid variable name in %s", ref)
		}
		value, ok := opts.Env(target)
		if !ok || value == "" {
			return "", fmt.Errorf("%s: environment variable %s is not set", ref, target)
		}
		return value, nil

	case "file":
		if target == "" {
			return "", fmt.Errorf("%s: missing file path", ref)
		}
		return readSecretFile(ref, filepath.Join("/", target), opts)

	case "k8s":
		names, key, found := strings.Cut(target, "#")
		if !found {
			return "", fmt.Errorf("%s: missing #<key>", ref)
		}
		parts := strings.Split(names, "/")
		if len(parts) > 2 || !allMatch(parts, k8sNameRegex) {
			return "", fmt.Errorf("%s: expected secret://k8s/[<namespace>/]<secret>#<key>", ref)
		}
		if !k8sKeyRegex.MatchString(key) {
			return "", fmt.Errorf("%s: invalid key", ref)
		}
		namespace, name := "", parts[0]
		if len(parts) == 2 {
			namespace, name = parts[0], parts[1]
		}
		if podNamespace, _ := opts.Env("POD_NAMESPACE"); namespace != "" && podNamespace != "" && namespace != podNamespace {
			return "", fmt.Errorf("%s: Secrets of namespace %s are not mounted here (%s)", ref, namespace, podNamespace)
		}
		dir := opts.SecretsDir
		if dir == "" {
			if fromEnv, ok := opts.Env("ROUTR_SECRETS_DIR"); ok {
				dir = fromEnv
			}
		}
		if dir == "" {
			dir = defaultSecretsDir
		}
		base, err := filepath.Abs(dir)
		if err != nil {
			return "", fmt.Errorf("%s: cannot resolve secrets directory", ref)
		}
		return readSecretFile(ref, filepath.Join(base, name, key), opts)
	}

	return "", fmt.Errorf("unsupported reference %s (use secret://env/NAME, secret://file/<path> or secret://k8s/<secret>#<key>)", ref)
}

func allMatch(parts []string, re *regexp.Regexp) bool {
	for _, p := range parts {
		if !re.MatchString(p) {
			return false
		}
	}
	return true
}

func walkSecrets(input any, opts SecretOptions, path string) (any, error) {
	if ref, ok := isSecretRef(input); ok {
		value, err := resolveSecretRef(ref, opts)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", pathOrRoot(path), err)
		}
		return value, nil
	}
	switch v := input.(type) {
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			resolved, err := walkSecrets(item, opts, fmt.Sprintf("%s[%d]", path, i))
			if err != nil {
				return nil, err
			}
			out[i] = resolved
		}
		return out, nil
	case map[string]any:
		out := make(map[string]any, len(v))
		for _, key := range sortedKeys(v) {
			resolved, err := walkSecrets(v[key], opts, childPath(path, key))
			if err != nil {
				return nil, err
			}
			out[key] = resolved
		}
		return out, nil
	case map[any]any:
		return walkSecrets(stringKeys(v), opts, path)
	}
	return input, nil
}
