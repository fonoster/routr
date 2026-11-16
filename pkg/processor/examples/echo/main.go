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

// Echo is the simplest processor the Go SDK can serve: it answers every SIP
// message with 200 OK, as the Node example mods/echo does.
//
//	cd pkg/processor && go run ./examples/echo
//
// It listens on BIND_ADDR, 0.0.0.0:51904 when unset, which is where a
// Dispatcher's processors entry points.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/pkg/processor"
)

// version is what the echo announces to the Dispatcher with every answer.
const version = "0.1.0"

func main() {
	bindAddr := os.Getenv("BIND_ADDR") // "0.0.0.0:51904" when empty
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	log := slog.Default()
	err := processor.ListenAndServe(ctx, processor.Options{BindAddr: bindAddr, Name: "echo", Version: version, Logger: log}, echo(log))
	if err != nil {
		log.Error("the echo processor stopped", "error", err)
		os.Exit(1)
	}
}

// echo answers every message with 200 OK, as mods/echo does, logging the request at debug level.
func echo(log *slog.Logger) processor.Handler {
	return func(ctx context.Context, req *processor.MessageRequest) (*processor.MessageResponse, error) {
		log.DebugContext(ctx, "got new request", "request", req)
		return processor.OK(), nil
	}
}
