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

// Command location runs the Location Service on its own. It reads the file
// named by CONFIG_PATH (location.yaml, the file the Node service read) and
// serves gRPC on spec.bindAddr, 0.0.0.0:51902 by default.
package main

import (
	"context"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/location"
	"google.golang.org/grpc"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg, err := location.Load(os.Getenv("CONFIG_PATH"))
	if err != nil {
		log.Error("unable to load the configuration: " + err.Error())
		os.Exit(1)
	}

	store, err := location.OpenStore(*cfg.Spec.Cache)
	if err != nil {
		log.Error("unable to open the cache: " + err.Error())
		os.Exit(1)
	}
	defer func() { _ = store.Close() }()

	lis, err := net.Listen("tcp", cfg.Spec.BindAddr)
	if err != nil {
		log.Error("unable to listen on " + cfg.Spec.BindAddr + ": " + err.Error())
		os.Exit(1)
	}

	server := grpc.NewServer()
	location.New(store).Register(server)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		server.GracefulStop()
	}()

	log.Info("starting location service", "version", version, "bindAddr", cfg.Spec.BindAddr, "cache", cfg.Spec.Cache.Provider)
	if err := server.Serve(lis); err != nil {
		log.Error("location service stopped: " + err.Error())
		os.Exit(1)
	}
}
