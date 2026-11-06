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

// Command edgeport runs the experimental Go EdgePort. It reads the file named
// by CONFIG_PATH (edgeport.yaml) and the same environment as the Java EdgePort.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/edgeport"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	env := config.ReadEnv(nil)
	log := edgeport.SetupLogging(env.LogsLevel)

	cfg, err := config.Load(os.Getenv("CONFIG_PATH"))
	if err != nil {
		// The Java EdgePort prints the validation error and stops
		fmt.Println(err.Error())
		os.Exit(1)
	}

	ep, err := edgeport.New(cfg, edgeport.Options{
		Env:           env,
		Version:       version,
		UDPReadBuffer: cfg.Spec.UDPReadBuffer,
	})
	if err != nil {
		log.Error("unable to run edgeport: " + err.Error())
		os.Exit(1)
	}

	if env.EnableHealthchecks {
		go func() {
			if err := edgeport.ServeHealth(8080); err != nil {
				log.Error("health check stopped: " + err.Error())
			}
		}()
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := ep.Start(ctx); err != nil {
		log.Error("unable to run edgeport: " + err.Error())
		os.Exit(1)
	}
}
