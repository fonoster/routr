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

package one

import (
	"context"
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

// RoutrOne's listeners are guarded like a standalone component's; its in-process
// calls don't go through them, so Connect keeps reading the Data API.
func TestNewRefusesAnExposedDataAPI(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Data.BindAddr = "0.0.0.0:0"
	_, err := New(context.Background(), cfg, Options{})
	if err == nil || !strings.Contains(err.Error(), "spec.data.apiKeys") {
		t.Fatalf("names what to set: %v", err)
	}

	cfg = parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Data.BindAddr = "0.0.0.0:0"
	cfg.Spec.Data.Insecure = true
	o, err := New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	_ = o.Close()

	cfg = parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Data.BindAddr = "0.0.0.0:0"
	cfg.Spec.Data.APIKeys = []string{"k"}
	o, err = New(context.Background(), cfg, Options{})
	if err != nil {
		t.Fatal(err)
	}
	_ = o.Close()
}

func TestNewRefusesAnExposedRequester(t *testing.T) {
	cfg := parseRoutr(t, routrYAML(freeUDPPort(t), sampleResources))
	cfg.Spec.Requester.BindAddr = "0.0.0.0:0"
	cfg.Spec.Registry = &config.RegistrySpec{EdgePorts: []config.RegistryEdgePort{{Address: "127.0.0.1:5060"}}}
	_, err := New(context.Background(), cfg, Options{})
	if err == nil || !strings.Contains(err.Error(), "spec.requester.apiKeys") {
		t.Fatalf("names what to set: %v", err)
	}
}
