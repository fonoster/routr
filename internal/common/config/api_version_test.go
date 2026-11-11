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
	"regexp"
	"testing"
)

var apiVersionLine = regexp.MustCompile(`(?m)^apiVersion: .*\n`)

// withAPIVersion returns a shipped file with its apiVersion line replaced, or
// removed when version is empty.
func withAPIVersion(t *testing.T, path, version string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !apiVersionLine.Match(data) {
		t.Fatalf("%s has no apiVersion line", path)
	}
	line := ""
	if version != "" {
		line = "apiVersion: " + version + "\n"
	}
	return apiVersionLine.ReplaceAll(data, []byte(line))
}

func TestAPIVersion(t *testing.T) {
	loaders := []struct {
		name  string
		file  string
		parse func([]byte) error
	}{
		{"edgeport", "../../../config/edgeport.yaml", func(b []byte) error { _, err := ParseEdgePort(b, ResolveOptions{}); return err }},
		{"location", "../../../config/location.yaml", func(b []byte) error { _, err := ParseLocation(b, ResolveOptions{}); return err }},
		{"dispatcher", "../../../config/dispatcher.yaml", func(b []byte) error { _, err := ParseDispatcher(b, ResolveOptions{}); return err }},
		{"rtprelay", "../../../config/rtprelay.yaml", func(b []byte) error { _, err := ParseRTPRelay(b, ResolveOptions{}); return err }},
		{"connect", "../../../config/connect.yaml", func(b []byte) error { _, err := ParseConnect(b, ResolveOptions{}); return err }},
		{"data", "../../../config/data.yaml", func(b []byte) error { _, err := ParseData(b, ResolveOptions{}); return err }},
	}
	for _, l := range loaders {
		for _, v := range []string{"v2beta1", "v2", "v3"} {
			if err := l.parse(withAPIVersion(t, l.file, v)); err != nil {
				t.Errorf("%s with apiVersion %s: %v", l.name, v, err)
			}
		}
		for _, v := range []string{"b", ""} {
			err := l.parse(withAPIVersion(t, l.file, v))
			if err == nil || err.Error() != errAPIVersion.Error() {
				t.Errorf("%s with apiVersion %q: got %v, want %q", l.name, v, err, errAPIVersion)
			}
		}
	}
}
