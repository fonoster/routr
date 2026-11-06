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
// (routr.yaml, § 3.7) and serves the Location, Data API and Connect gRPC
// services on their Routr 2 ports unless a flag moves or turns one off.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/edgeport"
	"github.com/fonoster/routr/internal/one"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	os.Exit(run(os.Args[1:], os.LookupEnv, os.Stdout))
}

// run is main with its inputs injected: the flags, the environment and
// where a configuration error is printed. It returns the exit code: 1 on a
// bad routr.yaml (the message names the key) or a failure to start, 2 on a
// bad flag, 0 on a clean stop.
func run(args []string, lookup func(string) (string, bool), out io.Writer) int {
	flags := flag.NewFlagSet("routr-one", flag.ContinueOnError)
	flags.SetOutput(out)
	listeners := one.DefaultListeners()
	flags.StringVar(&listeners.Location, "location-addr", listeners.Location, "where the Location service listens; empty turns it off")
	flags.StringVar(&listeners.Data, "data-addr", listeners.Data, "where the Data API listens; empty turns it off")
	flags.StringVar(&listeners.Connect, "connect-addr", listeners.Connect, "where the Connect processor listens; empty turns it off")
	if err := flags.Parse(args); err != nil {
		return 2
	}

	env := config.ReadEnv(lookup)
	log := edgeport.SetupLogging(env.LogsLevel)
	slog.SetDefault(log)

	path, _ := lookup("CONFIG_PATH")
	cfg, err := config.LoadRoutrWith(path, config.ResolveOptions{Env: lookup})
	if err != nil {
		// As the Node services did: the validation error, then stop
		fmt.Fprintln(out, err.Error())
		return 1
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	o, err := one.New(ctx, cfg, one.Options{
		Logger:    log,
		Env:       env,
		Version:   version,
		Listeners: &listeners,
	})
	if err != nil {
		fmt.Fprintln(out, err.Error())
		return 1
	}

	log.Info("starting routr", "ref", cfg.Ref, "version", version)
	if err := o.Run(ctx); err != nil {
		log.Error("routr stopped: " + err.Error())
		return 1
	}
	log.Info("routr stopped")
	return 0
}
