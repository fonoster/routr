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

package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

func writeConfig(t *testing.T, text string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "routr.yaml")
	if err := os.WriteFile(path, []byte(text), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

const minimum = `
apiVersion: v3
kind: Routr
spec:
  edgeport:
    transport:
      - protocol: udp
        port: 5060
  data:
    backend: files
    path: ../../config/resources
`

func TestRunExitsNonZeroNamingTheKey(t *testing.T) {
	for name, tc := range map[string]struct {
		path  string
		code  int
		names string
	}{
		"no CONFIG_PATH": {"", 1, "CONFIG_PATH"},
		"missing file":   {"/nonexistent/routr.yaml", 1, "does not exist"},
		"no spec.data": {writeConfig(t, `
apiVersion: v3
kind: Routr
spec:
  edgeport:
    transport:
      - protocol: udp
        port: 5060
`), 1, "spec.data"},
		"unknown key":    {writeConfig(t, minimum+"  rtprelays: {}\n"), 1, "spec.rtprelays"},
		"bad resources":  {writeConfig(t, strings.Replace(minimum, "../../config/resources", "/nonexistent", 1)), 1, "spec.data.path"},
		"bad bindAddr":   {writeConfig(t, minimum+"  connect:\n    bindAddr: 51904\n"), 1, "spec.connect.bindAddr"},
		"bad logLevel":   {writeConfig(t, minimum+"logLevel: silly\n"), 1, "logLevel"},
		"secret missing": {writeConfig(t, strings.Replace(minimum, "backend: files", "backend: files\n    url: secret://env/DATABASE_URL", 1)), 1, "DATABASE_URL"},
	} {
		t.Run(name, func(t *testing.T) {
			var out bytes.Buffer
			code := run(config.EnvFromMap(map[string]string{"CONFIG_PATH": tc.path}), &out)
			if code != tc.code {
				t.Errorf("exit %d, want %d:\n%s", code, tc.code, out.String())
			}
			if !strings.Contains(out.String(), tc.names) {
				t.Errorf("the output names %q:\n%s", tc.names, out.String())
			}
		})
	}
}
