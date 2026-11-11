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
package config_test

import (
	"os"
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/registry"
	"github.com/fonoster/routr/internal/requester"
)

// TestShippedConfigsLoad loads every standalone file Routr ships with its own
// loader and checks it says apiVersion v3.
func TestShippedConfigsLoad(t *testing.T) {
	opts := config.ResolveOptions{}
	edgeport := func(p string) error { _, err := config.LoadEdgePort(p, opts); return err }
	dispatcher := func(p string) error { _, err := config.LoadDispatcher(p, opts); return err }
	location := func(p string) error { _, err := config.LoadLocation(p, opts); return err }
	connect := func(p string) error { _, err := config.LoadConnect(p, opts); return err }
	registryFile := func(p string) error { _, err := registry.LoadFile(p, opts); return err }
	requesterFile := func(p string) error { _, err := requester.LoadConfig(p); return err }
	rtprelay := func(p string) error { _, err := config.LoadRTPRelay(p, opts); return err }

	files := map[string]func(string) error{
		"config/edgeport.yaml":          edgeport,
		"config/edgeport.alt.yaml":      edgeport,
		"etc/edgeport.yaml":             edgeport,
		"config/dispatcher.yaml":        dispatcher,
		"config/dispatcher.dev.yaml":    dispatcher,
		"config/dispatcher.relay.yaml":  dispatcher,
		"config/compat/dispatcher.yaml": dispatcher,
		"config/location.yaml":          location,
		"config/location.dev.yaml":      location,
		"config/compat/location.yaml":   location,
		"config/connect.yaml":           connect,
		"config/connect.dev.yaml":       connect,
		"config/compat/connect.yaml":    connect,
		"config/registry.yaml":          registryFile,
		"config/registry.dev.yaml":      registryFile,
		"config/requester.yaml":         requesterFile,
		"config/requester.dev.yaml":     requesterFile,
		"config/rtprelay.yaml":          rtprelay,
	}
	for file, load := range files {
		path := "../../../" + file
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(data), "\napiVersion: v3\n") && !strings.HasPrefix(string(data), "apiVersion: v3\n") {
			t.Errorf("%s doesn't say apiVersion: v3", file)
		}
		if err := load(path); err != nil {
			t.Errorf("%s: %v", file, err)
		}
	}
}
