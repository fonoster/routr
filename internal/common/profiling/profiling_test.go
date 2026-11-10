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

package profiling

import (
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"
)

func lookupOf(env map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) { v, ok := env[k]; return v, ok }
}

func TestStartIsOffWithoutTheVariable(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if Start(lookupOf(nil), logger) {
		t.Fatal("started without ROUTR_PPROF_ADDR")
	}
	if Start(lookupOf(map[string]string{EnvAddr: ""}), logger) {
		t.Fatal("started with an empty ROUTR_PPROF_ADDR")
	}
}

func TestStartServesTheAddress(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if !Start(lookupOf(map[string]string{EnvAddr: "127.0.0.1:0"}), logger) {
		t.Fatal("did not start with ROUTR_PPROF_ADDR set")
	}
}

func TestMuxServesTheIndex(t *testing.T) {
	srv := httptest.NewServer(Mux())
	defer srv.Close()
	res, err := srv.Client().Get(srv.URL + "/debug/pprof/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
}
