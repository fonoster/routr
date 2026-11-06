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
	"errors"
	"log/slog"
	"net/http"
	"time"
)

// HealthAddr is where the chart's liveness probe looks: GET /healthz, port 8080.
const HealthAddr = ":8080"

// healthShutdownTimeout bounds how long a probe in flight can hold up the stop.
const healthShutdownTimeout = 5 * time.Second

// healthHandler answers the probe.
func healthHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("OK"))
	})
	return mux
}

// ServeHealth serves the probe on addr until ctx ends, then returns nil. It
// returns the error if the listener fails.
func ServeHealth(ctx context.Context, log *slog.Logger, addr string) error {
	server := &http.Server{Addr: addr, Handler: healthHandler(), ReadHeaderTimeout: healthShutdownTimeout}
	failed := make(chan error, 1)
	go func() {
		log.Info("health check endpoint listening", "addr", addr)
		failed <- server.ListenAndServe()
	}()
	select {
	case err := <-failed:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), healthShutdownTimeout)
	defer cancel()
	err := server.Shutdown(shutdownCtx)
	// The goroutine above ends once Shutdown closes the listener
	if serveErr := <-failed; serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
		return serveErr
	}
	return err
}
