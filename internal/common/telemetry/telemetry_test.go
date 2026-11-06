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
package telemetry

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
)

func TestOffBuildsNothing(t *testing.T) {
	tel := Start(context.Background(), config.Telemetry{}, "test", "1", nil)
	defer tel.Shutdown()
	if Enabled() {
		t.Error("no endpoint is off")
	}
	if ServerOptions() != nil {
		t.Error("a server gets nothing")
	}
	dial := grpc.WithTransportCredentials(insecure.NewCredentials())
	if got := DialOptions(dial); len(got) != 1 {
		t.Errorf("a connection gets nothing: %d options", len(got))
	}
	log := slog.Default()
	if tel.Logger(log) != log {
		t.Error("the logger stays as it is")
	}
}

func TestOnExportsEverySignalAndFlushesOnShutdown(t *testing.T) {
	var mu sync.Mutex
	paths := map[string]bool{}
	collector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		paths[r.URL.Path] = true
		w.WriteHeader(http.StatusOK)
	}))
	defer collector.Close()

	tel := Start(context.Background(), config.Telemetry{OTLPEndpoint: collector.URL + "/"}, "test", "1", nil)
	if !Enabled() {
		t.Fatal("an endpoint is on")
	}
	if ServerOptions() == nil || len(DialOptions()) != 1 {
		t.Error("servers and connections get a stats handler")
	}

	_, span := otel.Tracer("test").Start(context.Background(), "span")
	span.End()
	counter, err := otel.Meter("test").Int64Counter("counter")
	if err != nil {
		t.Fatal(err)
	}
	counter.Add(context.Background(), 1, metric.WithAttributes())
	tel.Logger(slog.Default()).Info("a record")

	tel.Shutdown()
	tel.Shutdown() // the second one does nothing

	if Enabled() {
		t.Error("off after Shutdown")
	}
	mu.Lock()
	defer mu.Unlock()
	for _, path := range []string{"/v1/traces", "/v1/metrics", "/v1/logs"} {
		if !paths[path] {
			t.Errorf("nothing posted to %s: %v", path, paths)
		}
	}
}

func TestOpenReportsABadKeyAndIgnoresTheEnvironment(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:1")
	path := filepath.Join(t.TempDir(), "file.yaml")
	if err := os.WriteFile(path, []byte("kind: Location\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	tel, err := Open(path, config.ResolveOptions{}, "test", "1", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tel.Shutdown()
	if Enabled() {
		t.Error("the variable alone turns nothing on")
	}

	if err := os.WriteFile(path, []byte("telemetry:\n  otlpEndpoint: nope\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path, config.ResolveOptions{}, "test", "1", nil); err == nil || !strings.Contains(err.Error(), "telemetry.otlpEndpoint") {
		t.Errorf("names the key: %v", err)
	}
}

// recording is an slog handler that remembers its records.
type recording struct {
	slog.Handler
	out *bytes.Buffer
}

func (h recording) Enabled(context.Context, slog.Level) bool { return true }

func (h recording) Handle(_ context.Context, r slog.Record) error {
	h.out.WriteString(r.Message + "\n")
	return nil
}

func TestTeeFollowsTheConsoleLevel(t *testing.T) {
	var console, otlp bytes.Buffer
	log := slog.New(teeHandler{
		console: slog.NewTextHandler(&console, &slog.HandlerOptions{Level: slog.LevelWarn}),
		otlp:    recording{out: &otlp},
	})
	log.Info("hidden")
	log.Warn("shown")
	if strings.Contains(otlp.String(), "hidden") || !strings.Contains(otlp.String(), "shown") {
		t.Errorf("otlp: %q", otlp.String())
	}
	if !strings.Contains(console.String(), "shown") {
		t.Errorf("console: %q", console.String())
	}
}
