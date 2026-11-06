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

// Command routr-one runs every component of Routr in one process
// (ROUTR3.md § 3.1): the EdgePort, the Dispatcher, Connect, the Location and
// the Data API, wired directly. It reads the file named by CONFIG_PATH
// (routr.yaml, § 3.7) and nothing else: the Location, Data API, Connect and
// Dispatcher gRPC services listen on each section's bindAddr, their Routr 2
// ports by default, and an empty bindAddr turns one off.
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/one"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	os.Exit(run(os.LookupEnv, os.Stdout))
}

// run is main with its inputs injected: the environment (CONFIG_PATH, and
// what routr.yaml's ${VAR} and secret://env references name) and where a
// configuration error is printed. It returns the exit code: 1 on a bad
// routr.yaml (the message names the key) or a failure to start, 0 on a
// clean stop.
func run(lookup func(string) (string, bool), out io.Writer) int {
	path, _ := lookup("CONFIG_PATH")
	cfg, err := config.LoadRoutr(path, config.ResolveOptions{Env: lookup})
	if err != nil {
		// As the Node services did: the validation error, then stop
		fmt.Fprintln(out, err.Error())
		return 1
	}
	logger := log.New(cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	o, err := one.New(ctx, cfg, one.Options{Logger: logger, Version: version})
	if err != nil {
		fmt.Fprintln(out, err.Error())
		return 1
	}

	logger.Info("starting routr", "ref", cfg.Ref, "version", version)
	if err := o.Run(ctx); err != nil {
		logger.Error("routr stopped: " + err.Error())
		return 1
	}
	logger.Info("routr stopped")
	return 0
}
