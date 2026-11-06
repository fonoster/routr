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
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/service"
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

	// The backends are reached over gRPC; the connections are this command's
	backends, err := dispatcher.Dial(cfg.Spec, nil)
	if err != nil {
		logger.Error("unable to run dispatcher: " + err.Error())
		os.Exit(1)
	}
	defer backends.Close()

	// The recorder's writer is this command's; it stops after the server did
	recorder, err := dispatcher.NewRecorder(dispatcher.RecorderOptions{
		Ref:     cfg.Ref,
		Version: version,
		Spec:    cfg.Spec.Recording,
		Logger:  logger,
	})
	if err != nil {
		logger.Error("unable to run dispatcher: " + err.Error())
		os.Exit(1)
	}
	defer recorder.Close()

	d, err := dispatcher.New(dispatcher.Options{
		Logger:      logger,
		Processors:  backends.Processors,
		Middlewares: backends.Middlewares,
		Recorder:    recorder,
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
		os.Exit(1)
	}
}
