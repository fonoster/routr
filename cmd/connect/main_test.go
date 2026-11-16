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
	"reflect"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/connect"
)

func TestTrustOfPassesEveryList(t *testing.T) {
	got := trustOf(config.ConnectFileSpec{
		TrustedEdgePorts:         []string{"edgeport-02"},
		TrustedEdgePortAddresses: []string{"10.0.0.2"},
		TrustedRegistryAddresses: []string{"10.0.0.9"},
	})
	want := connect.Trust{
		EdgePorts:         []string{"edgeport-02"},
		EdgePortAddresses: []string{"10.0.0.2"},
		RegistryAddresses: []string{"10.0.0.9"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("trust = %+v, want %+v", got, want)
	}
}
