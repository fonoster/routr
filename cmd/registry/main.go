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

// Command registry sends the periodic REGISTER of the Trunks. It reads the file
// named by CONFIG_PATH (registry.yaml). It serves no gRPC, only the chart's
// liveness probe (GET /healthz, port 8080) unless spec.enableHealthchecks is
// false.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/profiling"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/common/telemetry"
	"github.com/fonoster/routr/internal/registry"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	cfg, err := registry.LoadFile(os.Getenv("CONFIG_PATH"), config.ResolveOptions{})
	if err != nil {
		// As the Node services did: the validation error, then stop
		fmt.Println(err.Error())
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)
	profiling.Start(os.LookupEnv, logger)

	tel, err := telemetry.Open(os.Getenv("CONFIG_PATH"), config.ResolveOptions{}, "registry", version, logger)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	defer tel.Shutdown()
	logger = tel.Logger(logger)

	// The peers are reached over gRPC; the connections are this command's
	dial := func(key, addr string, auth config.ClientAuth) *grpc.ClientConn {
		creds, err := service.DialCredentials(auth)
		if err != nil {
			logger.Error(fmt.Sprintf("unable to run registry: %s: %s", key, err))
			os.Exit(1)
		}
		conn, err := grpc.NewClient(addr, telemetry.DialOptions(creds...)...)
		if err != nil {
			logger.Error(fmt.Sprintf("unable to run registry: %s: %s", key, err))
			os.Exit(1)
		}
		return conn
	}
	requesterConn := dial("spec.requesterAddr", cfg.Spec.RequesterAddr, cfg.Spec.RequesterAuth)
	defer requesterConn.Close()
	apiConn := dial("spec.apiAddr", cfg.Spec.APIAddr, cfg.Spec.APIAuth)
	defer apiConn.Close()

	reg, err := registry.New(cfg.Spec, registry.Dependencies{
		Requester: requester.NewRequesterClient(requesterConn),
		Trunks:    trunks.NewTrunksClient(apiConn),
	}, registry.Options{Logger: logger})
	if err != nil {
		logger.Error("unable to run registry: " + err.Error())
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// A probe that can't bind stops the service
	var healthErr error
	healthDone := make(chan struct{})
	go func() {
		defer close(healthDone)
		if !cfg.Spec.EnableHealthchecks {
			return
		}
		if err := registry.ServeHealth(ctx, logger, registry.HealthAddr); err != nil {
			healthErr = err
			cancel()
		}
	}()

	logger.Info("routr registry", "version", version, "requesterAddr", cfg.Spec.RequesterAddr, "apiAddr", cfg.Spec.APIAddr)
	reg.Run(ctx)

	cancel()
	<-healthDone
	if healthErr != nil {
		logger.Error("unable to run registry: " + healthErr.Error())
		tel.Shutdown()
		os.Exit(1)
	}
}
