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

// Command edgeport runs the Go EdgePort on its own. It reads the file named
// by CONFIG_PATH (edgeport.yaml) and nothing else from the environment
// (ROUTR3.md § 7): a Routr 2 variable counts only through a placeholder in
// the file, such as ${EXTERNAL_ADDRS}.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/profiling"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/common/telemetry"
	"github.com/fonoster/routr/internal/edgeport"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

// loadConfig reads the file CONFIG_PATH names: the EdgePort's one source of
// settings. A Routr 2 variable counts only through a placeholder in it.
func loadConfig() (*config.Config, error) {
	return config.LoadEdgePort(os.Getenv("CONFIG_PATH"), config.ResolveOptions{})
}

// newEdgePort builds the EdgePort from cfg alone.
func newEdgePort(cfg *config.Config, client ppb.ProcessorClient, logger *slog.Logger) (*edgeport.EdgePort, error) {
	return edgeport.New(cfg, edgeport.Options{
		Processor:     client,
		Logger:        logger,
		Version:       version,
		UDPReadBuffer: cfg.Spec.UDPReadBuffer,
	})
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		// The Java EdgePort prints the validation error and stops
		fmt.Println(err.Error())
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)
	profiling.Start(os.LookupEnv, logger)

	tel, err := telemetry.Open(os.Getenv("CONFIG_PATH"), config.ResolveOptions{}, "routr-edgeport", version, logger)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	defer tel.Shutdown()
	logger = tel.Logger(logger)

	// The processor (Connect, or the Dispatcher) is reached over gRPC, at
	// spec.processor.addr, round robin over every address the name resolves to
	addr := cfg.Spec.Processor.Addr
	creds, err := service.DialCredentials(cfg.Spec.ProcessorAuth)
	if err != nil {
		logger.Error("unable to run edgeport: spec.processorAuth: " + err.Error())
		os.Exit(1)
	}
	conn, err := service.NewClient(addr, telemetry.DialOptions(creds...)...)
	if err != nil {
		logger.Error(fmt.Sprintf("unable to reach the processor at %s: %s", addr, err))
		os.Exit(1)
	}
	defer conn.Close()

	ep, err := newEdgePort(cfg, ppb.NewProcessorClient(conn), logger)
	if err != nil {
		logger.Error("unable to run edgeport: " + err.Error())
		os.Exit(1)
	}

	if health := cfg.Spec.Health; health != nil {
		go func() {
			if err := edgeport.ServeHealth(logger, health.BindAddr); err != nil {
				logger.Error("health check stopped: " + err.Error())
			}
		}()
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := ep.Start(ctx); err != nil {
		logger.Error("unable to run edgeport: " + err.Error())
		tel.Shutdown()
		os.Exit(1)
	}
}
