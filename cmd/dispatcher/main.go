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

// Command dispatcher runs the Message Dispatcher. It reads the file named by
// CONFIG_PATH (dispatcher.yaml, the same file the Node dispatcher read),
// connects to the processors and middlewares it names and serves the
// Processor service on spec.bindAddr (0.0.0.0:51901 by default).
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/common/telemetry"
	"github.com/fonoster/routr/internal/dispatcher"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	cfg, err := config.LoadDispatcher(os.Getenv("CONFIG_PATH"), config.ResolveOptions{})
	if err != nil {
		// The Node dispatcher prints the validation error and stops
		fmt.Println(err.Error())
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)

	tel, err := telemetry.Open(os.Getenv("CONFIG_PATH"), config.ResolveOptions{}, "dispatcher", version, logger)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	defer tel.Shutdown()
	logger = tel.Logger(logger)

	// The backends are reached over gRPC; the connections are this command's
	backends, err := dispatcher.Dial(cfg.Spec, dialBackend)
	if err != nil {
		logger.Error("unable to run dispatcher: " + err.Error())
		os.Exit(1)
	}
	defer backends.Close()

	d, err := dispatcher.New(dispatcher.Options{
		Logger:      logger,
		Processors:  backends.Processors,
		Middlewares: backends.Middlewares,
	})
	if err != nil {
		logger.Error("unable to run dispatcher: " + err.Error())
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Info("routr dispatcher", "ref", cfg.Ref, "version", version)
	if err := service.Serve(ctx, logger, "dispatcher", cfg.Spec.BindAddr, d.Register); err != nil {
		logger.Error("unable to run dispatcher: " + err.Error())
		tel.Shutdown()
		os.Exit(1)
	}
}

// dialBackend is dispatcher.DialBackend on a connection that carries the trace
// context when telemetry is on.
func dialBackend(addr string) (dispatcher.Backend, error) {
	conn, err := grpc.NewClient(addr, telemetry.DialOptions(grpc.WithTransportCredentials(insecure.NewCredentials()))...)
	if err != nil {
		return nil, fmt.Errorf("unable to reach the backend at %s: %w", addr, err)
	}
	return struct {
		processor.ProcessorClient
		io.Closer
	}{processor.NewProcessorClient(conn), conn}, nil
}
