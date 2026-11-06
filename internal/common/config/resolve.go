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

// ResolveOptions are the injectable parts of Resolve. The zero value reads
// the process environment and the file system.
type ResolveOptions struct {
	// Env resolves ${VAR}, secret://env and the resolver's own settings
	// (ROUTR_SECRETS_DIR, POD_NAMESPACE); os.LookupEnv when nil.
	Env EnvLookup
	// ReadFile reads secret://file and secret://k8s targets; os.ReadFile
	// when nil.
	ReadFile FileReader
	// SecretsDir is where Kubernetes Secrets are mounted; when empty,
	// ROUTR_SECRETS_DIR, then /var/run/routr/secrets.
	SecretsDir string
	// AllowedPaths, when not nil, lists the key paths where ${...} may appear
	// (see InterpolateEnv). nil allows it everywhere.
	AllowedPaths []string
}

// Resolve returns a copy of a decoded config tree with its ${VAR}
// placeholders and then its secret:// references resolved, the order
// RoutrOne 2 used for one.yaml (mods/one/src/config/load_one_config.ts), so
// a placeholder may build a reference (`secret://k8s/${RELEASE}-db#url`).
// It runs before validation; errors name the key path and the reference,
// never a value.
func Resolve(input any, opts ResolveOptions) (any, error) {
	interpolated, err := InterpolateEnv(input, opts.Env, opts.AllowedPaths)
	if err != nil {
		return nil, err
	}
	return ResolveSecretRefs(interpolated, SecretOptions{
		Env:        opts.Env,
		ReadFile:   opts.ReadFile,
		SecretsDir: opts.SecretsDir,
	})
}
