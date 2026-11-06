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
// CONFIG_PATH (dispatcher.yaml, the same file the Node dispatcher read) and
// serves the Processor service on spec.bindAddr (0.0.0.0:51901 by default).
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/fonoster/routr/internal/dispatcher"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg, err := dispatcher.LoadConfig(os.Getenv("CONFIG_PATH"))
	if err != nil {
		// The Node dispatcher prints the validation error and stops
		fmt.Println(err.Error())
		os.Exit(1)
	}

	d, err := dispatcher.New(cfg, dispatcher.Options{Logger: log})
	if err != nil {
		log.Error("unable to run dispatcher: " + err.Error())
		os.Exit(1)
	}
	defer d.Close()

	lis, err := net.Listen("tcp", cfg.Spec.BindAddr)
	if err != nil {
		log.Error("unable to run dispatcher: " + err.Error())
		os.Exit(1)
	}

	srv := grpc.NewServer()
	d.Register(srv)
	// The chart's liveness probe is a gRPC health check on the service port
	healthpb.RegisterHealthServer(srv, health.NewServer())

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		srv.GracefulStop()
	}()

	log.Info(fmt.Sprintf("starting dispatcher ref = %s version = %s at %s", cfg.Ref, version, cfg.Spec.BindAddr))
	if err := srv.Serve(lis); err != nil {
		log.Error("unable to run dispatcher: " + err.Error())
		os.Exit(1)
	}
}
