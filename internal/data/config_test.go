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
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseConfig(t *testing.T) {
	cfg, err := ParseConfig([]byte("apiVersion: v3\nkind: Routr\nspec:\n  data:\n    backend: files\n    path: /etc/routr/resources\n"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Backend != BackendFiles || cfg.Path != "/etc/routr/resources" || cfg.BindAddr != DefaultBindAddr {
		t.Errorf("cfg = %+v", cfg)
	}
	cfg, err = ParseConfig([]byte("spec:\n  data:\n    backend: postgres\n    url: postgresql://routr:secret@db/routr\n    bindAddr: 127.0.0.1:51907\n"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Backend != BackendPostgres || cfg.URL != "postgresql://routr:secret@db/routr" || cfg.BindAddr != "127.0.0.1:51907" {
		t.Errorf("cfg = %+v", cfg)
	}
}

func TestParseConfigFailures(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    string
	}{
		{"not yaml", "spec: [", "not valid YAML"},
		{"no data section", "spec:\n  edgeport: {}\n", "no spec.data section"},
		{"no backend", "spec:\n  data: {path: /x}\n", "backend is required"},
		{"unknown backend", "spec:\n  data: {backend: redis}\n", "must be files or postgres"},
		{"files without path", "spec:\n  data: {backend: files}\n", "path is required"},
		{"postgres without url", "spec:\n  data: {backend: postgres}\n", "url is required"},
		{"unresolved secret", "spec:\n  data: {backend: postgres, url: 'secret://env/DATABASE_URL'}\n", "spec.data.url holds an unresolved reference"},
		{"unresolved placeholder", "spec:\n  data: {backend: postgres, url: 'postgresql://x', encryptionKey: '${CLOAK_KEY}'}\n", "spec.data.encryptionKey holds an unresolved reference"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseConfig([]byte(tt.content))
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("err = %v, want %q", err, tt.want)
			}
		})
	}
}

func TestLoadConfig(t *testing.T) {
	if _, err := LoadConfig(""); err == nil || !strings.Contains(err.Error(), "CONFIG_PATH") {
		t.Errorf("empty path: %v", err)
	}
	dir := t.TempDir()
	if _, err := LoadConfig(dir); err == nil || !strings.Contains(err.Error(), "does not exist") {
		t.Errorf("directory: %v", err)
	}
	if _, err := LoadConfig(filepath.Join(dir, "missing.yaml")); err == nil {
		t.Error("missing file should fail")
	}
	path := filepath.Join(dir, "routr.yaml")
	if err := os.WriteFile(path, []byte("spec:\n  data:\n    backend: files\n    path: "+dir+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg, err := LoadConfig(path)
	if err != nil || cfg.Path != dir {
		t.Errorf("cfg = %+v, %v", cfg, err)
	}
}
