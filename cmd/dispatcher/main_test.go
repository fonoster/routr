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
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/dispatcher"
)

func TestBackendDialerRefusesAKeyInClearPerAddress(t *testing.T) {
	auth := config.ClientAuth{APIKey: "a-key-only-this-test-knows"}
	spec := func(remote string) config.DispatcherFileSpec {
		return config.DispatcherFileSpec{Processors: []config.DispatcherProcessor{
			{Ref: "connect", Addr: "127.0.0.1:51904"},
			{Ref: "other", Addr: remote},
		}}
	}

	_, err := dispatcher.Dial(spec("10.0.0.5:51904"), backendDialer(auth))
	if err == nil {
		t.Fatal("a key in clear to 10.0.0.5:51904 was not refused")
	}
	for _, want := range []string{"spec.backendAuth: ", "10.0.0.5:51904", "insecure: true"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("names %q: %v", want, err)
		}
	}
	if strings.Contains(err.Error(), auth.APIKey) {
		t.Errorf("the error carries the key: %v", err)
	}

	// grpc.NewClient is lazy: nothing listens there
	backends, err := dispatcher.Dial(spec("localhost:51905"), backendDialer(auth))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = backends.Close() }()
	if len(backends.Processors) != 2 {
		t.Errorf("got %d processors, want 2", len(backends.Processors))
	}

	auth.Insecure = true
	accepted, err := dispatcher.Dial(spec("10.0.0.5:51904"), backendDialer(auth))
	if err != nil {
		t.Fatalf("with insecure: true: %v", err)
	}
	_ = accepted.Close()
}
