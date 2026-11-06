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
package edgeport

import (
	"fmt"
	"log/slog"
	"net/http"
)

// HealthHandler answers GET /healthz as io.routr.HealthCheck does.
func HealthHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{ "status": "OK"}`)
	})
	return mux
}

// ServeHealth serves the health check on the port (ENABLE_HEALTHCHECKS).
func ServeHealth(log *slog.Logger, port int) error {
	loggerOr(log).Info(fmt.Sprintf("starting health check on port %d and endpoint /healthz", port))
	return http.ListenAndServe(fmt.Sprintf(":%d", port), HealthHandler())
}
