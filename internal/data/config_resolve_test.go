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

package data

import (
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

func TestParseConfigResolvesReferences(t *testing.T) {
	env := func(key string) (string, bool) {
		v, ok := map[string]string{"DATABASE_URL": "postgres://u:p@db/routr", "KEY": "k1.aesgcm256.x"}[key]
		return v, ok
	}
	cfg, err := ParseConfigWith([]byte(`
spec:
  data:
    backend: postgres
    url: secret://env/DATABASE_URL
    encryptionKey: ${KEY}
`), config.ResolveOptions{Env: env})
	if err != nil {
		t.Fatalf("resolved config rejected: %v", err)
	}
	if cfg.URL != "postgres://u:p@db/routr" || cfg.EncryptionKey != "k1.aesgcm256.x" {
		t.Errorf("references not resolved: %+v", cfg)
	}
}

func TestParseConfigRejectsAMissingReference(t *testing.T) {
	_, err := ParseConfigWith([]byte(`
spec:
  data:
    backend: postgres
    url: secret://env/NOPE
`), config.ResolveOptions{Env: func(string) (string, bool) { return "", false }})
	if err == nil || strings.Contains(err.Error(), "postgres://") {
		t.Errorf("expected an error naming the reference and no value, got %v", err)
	}
}
