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

package registry

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	rec := httptest.NewRecorder()
	healthHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "OK" {
		t.Errorf("GET /healthz: %d %q", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	healthHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/other", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("GET /other: %d", rec.Code)
	}
}

func TestServeHealthStopsWithTheContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := ServeHealth(ctx, slog.New(slog.DiscardHandler), "127.0.0.1:0"); err != nil {
		t.Errorf("a cancelled context is a clean stop: %v", err)
	}
}

func TestServeHealthReportsAPortInUse(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	if err := ServeHealth(context.Background(), slog.New(slog.DiscardHandler), taken.Addr().String()); err == nil {
		t.Error("a port in use is an error")
	}
}
