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

// Command rtprelay runs the RTPRelay, a Dispatcher middleware that drives
// RTPEngine. It reads the file named by CONFIG_PATH (rtprelay.yaml) and serves
// the Processor gRPC service on its bindAddr, 0.0.0.0:51903 by default.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/rtprelay"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	cfg, err := config.LoadRTPRelay(os.Getenv("CONFIG_PATH"), config.ResolveOptions{})
	if err != nil {
		// A relay that is up but never listens looks healthy to the orchestrator
		// while every call fails: the error, then stop
		fmt.Println(err.Error())
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)

	engine, err := rtprelay.NewClient(cfg.Spec.RTPEngine.Host, cfg.Spec.RTPEngine.Port,
		time.Duration(cfg.Spec.RTPEngine.TimeoutMs)*time.Millisecond, logger)
	if err != nil {
		logger.Error("unable to run rtprelay: " + err.Error())
		os.Exit(1)
	}
	defer engine.Close()

	relay, err := rtprelay.New(engine, rtprelay.MergeProfiles(cfg.Spec.Profiles), logger)
	if err != nil {
		logger.Error("unable to run rtprelay: " + err.Error())
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Info("routr rtprelay", "version", version, "rtpengine", fmt.Sprintf("%s:%d", cfg.Spec.RTPEngine.Host, cfg.Spec.RTPEngine.Port))
	if err := service.Serve(ctx, logger, "rtprelay", cfg.Spec.BindAddr, relay.Register); err != nil {
		logger.Error("unable to run rtprelay: " + err.Error())
		os.Exit(1)
	}
}
