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

// Command data runs the Data API on its own: the seven Connect gRPC services
// on Routr 2's apiserver port (51907), over the files or the postgres
// backend. It reads spec.data of the file named by CONFIG_PATH (routr.yaml,
// ROUTR3.md § 3.7); nothing else comes from the environment.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/profiling"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/common/telemetry"
	"github.com/fonoster/routr/internal/data"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	cfg, err := config.LoadData(os.Getenv("CONFIG_PATH"), config.ResolveOptions{})
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	if cfg.Spec.Data.BindAddr == "" {
		fmt.Println("spec.data.bindAddr: is empty, nothing to serve")
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)
	profiling.Start(os.LookupEnv, logger)

	tel, err := telemetry.Open(os.Getenv("CONFIG_PATH"), config.ResolveOptions{}, "data", version, logger)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	defer tel.Shutdown()
	logger = tel.Logger(logger)

	// Before anything opens: a Data API that would be exposed doesn't start
	guarded, err := service.Secure(logger, service.Guard{
		Name:     "data",
		Section:  "spec.data",
		BindAddr: cfg.Spec.Data.BindAddr,
		Auth:     cfg.Spec.Data.ServerAuth,
		Exposes:  service.ExposesData,
		Required: true,
	})
	if err != nil {
		logger.Error("unable to run the data api: " + err.Error())
		tel.Shutdown()
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	store, err := data.OpenStoreWithLogger(ctx, cfg.Spec.Data, logger)
	if err != nil {
		logger.Error("unable to open the data backend: " + err.Error())
		os.Exit(1)
	}
	defer store.Close()

	api, err := data.New(store, data.Options{Logger: logger, AllowNonE164Numbers: !cfg.Spec.Data.EnforcesE164Numbers()})
	if err != nil {
		logger.Error("unable to run the data api: " + err.Error())
		os.Exit(1)
	}

	logger.Info("routr data", "version", version, "backend", cfg.Spec.Data.Backend)
	if err := service.Serve(ctx, logger, "data", cfg.Spec.Data.BindAddr, api.Register, guarded...); err != nil {
		logger.Error("unable to run the data api: " + err.Error())
		tel.Shutdown()
		os.Exit(1)
	}
}
