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

// Package profiling serves Go's pprof endpoints when an operator asks for
// them, so a running service can be profiled without a rebuild.
package profiling

import (
	"log/slog"
	"net/http"
	"net/http/pprof"
)

// EnvAddr is the variable that turns profiling on: the address to serve
// /debug/pprof on, like 127.0.0.1:6060. Unset or empty serves nothing.
const EnvAddr = "ROUTR_PPROF_ADDR"

// Mux is the handler with the pprof endpoints, on a mux of its own so
// nothing else registered on http.DefaultServeMux is exposed.
func Mux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/debug/pprof/", pprof.Index)
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)
	return mux
}

// Start serves the pprof endpoints on the address in ROUTR_PPROF_ADDR, in
// the background, and tells whether it did. A server that stops is logged;
// the service keeps running.
func Start(lookup func(string) (string, bool), logger *slog.Logger) bool {
	addr, ok := lookup(EnvAddr)
	if !ok || addr == "" {
		return false
	}
	go func() {
		if err := http.ListenAndServe(addr, Mux()); err != nil {
			logger.Error("pprof stopped", "addr", addr, "error", err.Error())
		}
	}()
	logger.Info("pprof serving", "addr", addr)
	return true
}
