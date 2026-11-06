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
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
)

// EnvLookup reads one environment variable; the second value is false when
// it is not set. os.LookupEnv is one.
type EnvLookup func(name string) (string, bool)

// EnvFromMap is an EnvLookup over a fixed map, for tests and for callers that
// hold the environment as a map.
func EnvFromMap(env map[string]string) EnvLookup {
	return func(name string) (string, bool) {
		v, ok := env[name]
		return v, ok
	}
}

// Shell / docker-compose style variable interpolation for config files, the
// port of mods/common/src/config/interpolate_env.ts.
//
// Supported forms inside any string value:
//
//	${VAR}          -> value of VAR; an error if VAR is unset or empty
//	${VAR:-default} -> value of VAR, or `default` when VAR is unset or empty
//
// Anything that is not a `${...}` reference is left untouched, so plain
// literals (`http://asterisk:8088`, `$5.00`, ...) pass through unchanged.
var (
	varPattern   = regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)(:-([^}]*))?\}`)
	hasReference = regexp.MustCompile(`\$\{[^}]*\}`)
)

// InterpolateEnv returns a copy of a decoded config tree (map[string]any,
// []any, scalars) with `${VAR}` and `${VAR:-default}` references in its
// strings resolved through env (os.LookupEnv when nil). allowedPaths, when
// not nil, lists the key paths where a reference may appear: `db.*` matches
// `db` and everything below it, `*` matches every key. The input is not
// mutated. Errors name the key path where they happened, never a value.
func InterpolateEnv(input any, env EnvLookup, allowedPaths []string) (any, error) {
	if env == nil {
		env = os.LookupEnv
	}
	return walkInterpolate(input, env, allowedPaths, "")
}

func interpolateString(value string, env EnvLookup) (string, error) {
	var firstErr error
	out := varPattern.ReplaceAllStringFunc(value, func(match string) string {
		groups := varPattern.FindStringSubmatch(match)
		name, hasDefault, fallback := groups[1], groups[2] != "", groups[3]
		if current, ok := env(name); ok && current != "" {
			return current
		}
		if hasDefault {
			return fallback
		}
		if firstErr == nil {
			firstErr = fmt.Errorf("references undefined environment variable ${%s} and no default was given", name)
		}
		return match
	})
	if firstErr != nil {
		return "", firstErr
	}
	return out, nil
}

// isAllowed tells whether `${...}` may appear at a key path.
func isAllowed(path string, allowedPaths []string) bool {
	for _, pattern := range allowedPaths {
		if pattern == "*" {
			return true
		}
		if !strings.HasSuffix(pattern, ".*") {
			if path == pattern {
				return true
			}
			continue
		}
		prefix := strings.TrimSuffix(pattern, ".*")
		if path == prefix || strings.HasPrefix(path, prefix+".") {
			return true
		}
	}
	return false
}

func walkInterpolate(input any, env EnvLookup, allowedPaths []string, path string) (any, error) {
	switch v := input.(type) {
	case string:
		if !hasReference.MatchString(v) {
			return v, nil
		}
		where := pathOrRoot(path)
		if allowedPaths != nil && !isAllowed(path, allowedPaths) {
			list := strings.Join(allowedPaths, ", ")
			if list == "" {
				list = "no key path here"
			}
			return nil, fmt.Errorf("%s: ${...} is only allowed at %s", where, list)
		}
		out, err := interpolateString(v, env)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", where, err)
		}
		return out, nil
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			resolved, err := walkInterpolate(item, env, allowedPaths, fmt.Sprintf("%s[%d]", path, i))
			if err != nil {
				return nil, err
			}
			out[i] = resolved
		}
		return out, nil
	case map[string]any:
		out := make(map[string]any, len(v))
		for _, key := range sortedKeys(v) {
			resolved, err := walkInterpolate(v[key], env, allowedPaths, childPath(path, key))
			if err != nil {
				return nil, err
			}
			out[key] = resolved
		}
		return out, nil
	case map[any]any:
		return walkInterpolate(stringKeys(v), env, allowedPaths, path)
	}
	return input, nil
}

func pathOrRoot(path string) string {
	if path == "" {
		return "(root)"
	}
	return path
}

func childPath(path, key string) string {
	if path == "" {
		return key
	}
	return path + "." + key
}

// sortedKeys walks a map in a fixed order so the first error is always the
// same one (Object.entries keeps insertion order in Node; Go maps do not).
func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// stringKeys turns a YAML mapping with non-string keys (yaml.v3 decodes it as
// map[any]any) into the map[string]any the walkers handle.
func stringKeys(m map[any]any) map[string]any {
	out := make(map[string]any, len(m))
	for key, value := range m {
		out[fmt.Sprint(key)] = value
	}
	return out
}
