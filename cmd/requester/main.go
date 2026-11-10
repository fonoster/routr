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

// Command requester runs the Requester. It serves gRPC on spec.bindAddr of the
// file named by CONFIG_PATH (requester.yaml), 0.0.0.0:51909 by default or with
// no file, as the Java Requester did. Health is the grpc.health.v1 service.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/profiling"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/common/telemetry"
	"github.com/fonoster/routr/internal/requester"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	cfg, err := requester.LoadConfig(os.Getenv("CONFIG_PATH"))
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)
	profiling.Start(os.LookupEnv, logger)

	tel, err := telemetry.Open(os.Getenv("CONFIG_PATH"), config.ResolveOptions{}, "requester", version, logger)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	defer tel.Shutdown()
	logger = tel.Logger(logger)

	// Before the SIP stack opens: a Requester that would be exposed doesn't start
	guarded, err := service.Secure(logger, service.Guard{
		Name:     "requester",
		Section:  "spec",
		BindAddr: cfg.Spec.BindAddr,
		Auth:     cfg.Spec.ServerAuth,
		Exposes:  service.ExposesRequester,
		Required: true,
	})
	if err != nil {
		logger.Error("unable to run requester: " + err.Error())
		tel.Shutdown()
		os.Exit(1)
	}

	// sipgo's package-level settings, set before the stack starts: JAIN-SIP
	// sends any size over UDP; sipgo refuses past 1300 bytes by default
	sip.UDPMTUSize = 65535
	sip.TransportBufferReadSize = 65535
	sip.SetDefaultLogger(logger.WithGroup("sipgo"))

	signals, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	ctx, fail := context.WithCancelCause(signals)
	defer fail(nil)

	r, err := requester.New(requester.Options{Logger: logger, SIPHost: cfg.Spec.SIPHost, OnFailure: fail})
	if err != nil {
		logger.Error("unable to run requester: " + err.Error())
		os.Exit(1)
	}
	defer r.Close()
	// The calls still waiting on the SIP stack would hold the graceful stop
	context.AfterFunc(ctx, r.Close)

	logger.Info("routr requester", "version", version)
	if err := service.Serve(ctx, logger, "requester", cfg.Spec.BindAddr, r.Register, guarded...); err != nil {
		logger.Error("requester service stopped: " + err.Error())
		r.Close()
		tel.Shutdown()
		os.Exit(1)
	}
	if cause := context.Cause(ctx); cause != nil && !errors.Is(cause, context.Canceled) {
		r.Close()
		tel.Shutdown()
		os.Exit(1)
	}
}
