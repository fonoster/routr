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
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/common/telemetry"
	"github.com/fonoster/routr/internal/location"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	cfg, err := config.LoadLocation(os.Getenv("CONFIG_PATH"), config.ResolveOptions{})
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)

	tel, err := telemetry.Open(os.Getenv("CONFIG_PATH"), config.ResolveOptions{}, "location", version, logger)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	defer tel.Shutdown()
	logger = tel.Logger(logger)

	store, err := location.OpenStore(cfg.Spec.Cache)
	if err != nil {
		logger.Error("unable to open the cache: " + err.Error())
		os.Exit(1)
	}
	defer func() { _ = store.Close() }()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Info("routr location", "version", version, "cache", cfg.Spec.Cache.Provider)
	if err := service.Serve(ctx, logger, "location", cfg.Spec.BindAddr, location.New(store).Register); err != nil {
		logger.Error("location service stopped: " + err.Error())
		tel.Shutdown()
		os.Exit(1)
	}
}
