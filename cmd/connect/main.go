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

// Command connect runs the Connect processor. It reads the file named by
// CONFIG_PATH (connect.yaml) and serves the Processor gRPC service on its
// bindAddr, 0.0.0.0:51904 by default.
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
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/connect"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(log)

	cfg, err := connect.Load(os.Getenv("CONFIG_PATH"))
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}

	dial := func(addr string) *grpc.ClientConn {
		conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.Error("unable to run connect: " + err.Error())
			os.Exit(1)
		}
		return conn
	}
	locationConn := dial(cfg.Spec.LocationAddr)
	defer locationConn.Close()
	apiConn := dial(cfg.Spec.APIAddr)
	defer apiConn.Close()

	processor, err := connect.New(cfg, connect.Dependencies{
		Location: location.NewLocationClient(locationConn),
		Agents:   agents.NewAgentsClient(apiConn),
		Domains:  domains.NewDomainsClient(apiConn),
		Trunks:   trunks.NewTrunksClient(apiConn),
	}, connect.Options{Logger: log})
	if err != nil {
		log.Error("unable to run connect: " + err.Error())
		os.Exit(1)
	}

	listener, err := net.Listen("tcp", cfg.Spec.BindAddr)
	if err != nil {
		log.Error("unable to run connect: " + err.Error())
		os.Exit(1)
	}
	server := grpc.NewServer()
	processor.Register(server)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		server.GracefulStop()
	}()

	log.Info("starting routr connect", "version", version, "bindAddr", cfg.Spec.BindAddr, "locationAddr", cfg.Spec.LocationAddr, "apiAddr", cfg.Spec.APIAddr)
	if err := server.Serve(listener); err != nil {
		log.Error("unable to run connect: " + err.Error())
		os.Exit(1)
	}
}
