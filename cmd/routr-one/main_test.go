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
		args  []string
		code  int
		names string
	}{
		"no CONFIG_PATH": {"", nil, 1, "CONFIG_PATH"},
		"missing file":   {"/nonexistent/routr.yaml", nil, 1, "does not exist"},
		"no spec.data": {writeConfig(t, `
apiVersion: v3
kind: Routr
spec:
  edgeport:
    transport:
      - protocol: udp
        port: 5060
`), nil, 1, "spec.data"},
		"unknown key":    {writeConfig(t, minimum+"  rtprelays: {}\n"), nil, 1, "spec.rtprelays"},
		"redis store":    {writeConfig(t, minimum+"  location:\n    cache: { provider: redis }\n"), nil, 1, "spec.location.cache.provider"},
		"rtprelay":       {writeConfig(t, minimum+"  rtprelay: { host: rtpengine, port: 22222 }\n"), nil, 1, "spec.rtprelay"},
		"bad resources":  {writeConfig(t, strings.Replace(minimum, "../../config/resources", "/nonexistent", 1)), nil, 1, "spec.data.path"},
		"unknown flag":   {writeConfig(t, minimum), []string{"-nope"}, 2, "flag provided but not defined"},
		"secret missing": {writeConfig(t, strings.Replace(minimum, "backend: files", "backend: files\n    url: secret://env/DATABASE_URL", 1)), nil, 1, "DATABASE_URL"},
	} {
		t.Run(name, func(t *testing.T) {
			var out bytes.Buffer
			code := run(tc.args, config.EnvFromMap(map[string]string{"CONFIG_PATH": tc.path}), &out)
			if code != tc.code {
				t.Errorf("exit %d, want %d:\n%s", code, tc.code, out.String())
			}
			if !strings.Contains(out.String(), tc.names) {
				t.Errorf("the output names %q:\n%s", tc.names, out.String())
			}
		})
	}
}
