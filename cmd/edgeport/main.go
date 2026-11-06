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

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
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

	// The Dispatcher is reached over gRPC: spec.processor.addr, or
	// PROCESSOR_ADDR, which wins as it did in the Java EdgePort
	addr := ""
	if cfg.Spec.Processor != nil {
		addr = cfg.Spec.Processor.Addr
	}
	if env.ProcessorAddr != "" {
		addr = env.ProcessorAddr
	}
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Error(fmt.Sprintf("unable to reach the processor at %s: %s", addr, err))
		os.Exit(1)
	}
	defer conn.Close()

	ep, err := edgeport.New(cfg, edgeport.Options{
		Processor:     ppb.NewProcessorClient(conn),
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
