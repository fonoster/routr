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

// Command connect runs the Connect processor. It reads the file named by
// CONFIG_PATH (connect.yaml) and serves the Processor gRPC service on its
// bindAddr, 0.0.0.0:51904 by default.
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
	"github.com/fonoster/routr/internal/common/log"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/pb/verifier"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/common/telemetry"
	"github.com/fonoster/routr/internal/connect"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	cfg, err := config.LoadConnect(os.Getenv("CONFIG_PATH"), config.ResolveOptions{})
	if err != nil {
		// As the Node services did: the validation error, then stop
		fmt.Println(err.Error())
		os.Exit(1)
	}
	logger := log.New(cfg.LogLevel)

	tel, err := telemetry.Open(os.Getenv("CONFIG_PATH"), config.ResolveOptions{}, "connect", version, logger)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	defer tel.Shutdown()
	logger = tel.Logger(logger)

	// The peers are reached over gRPC; the connections are this command's
	dial := func(key, addr string) *grpc.ClientConn {
		conn, err := grpc.NewClient(addr, telemetry.DialOptions(grpc.WithTransportCredentials(insecure.NewCredentials()))...)
		if err != nil {
			logger.Error(fmt.Sprintf("unable to run connect: %s: %s", key, err))
			os.Exit(1)
		}
		return conn
	}
	locationConn := dial("spec.locationAddr", cfg.Spec.LocationAddr)
	defer locationConn.Close()
	apiConn := dial("spec.apiAddr", cfg.Spec.APIAddr)
	defer apiConn.Close()

	deps := connect.Dependencies{
		Location: location.NewLocationClient(locationConn),
		Agents:   agents.NewAgentsClient(apiConn),
		Domains:  domains.NewDomainsClient(apiConn),
		Trunks:   trunks.NewTrunksClient(apiConn),
		Numbers:  numbers.NewNumbersClient(apiConn),
		Peers:    peers.NewPeersClient(apiConn),
	}
	opts := connect.Options{Logger: logger, UntrustedHeaders: cfg.Spec.UntrustedHeadersToStrip}
	if cfg.Spec.VerifierAddr != "" {
		verifierConn := dial("spec.verifierAddr", cfg.Spec.VerifierAddr)
		defer verifierConn.Close()
		deps.Verifier = verifier.NewVerifierClient(verifierConn)
	}
	if cfg.Spec.VerifierPublicKeyPath != "" {
		key, err := os.ReadFile(cfg.Spec.VerifierPublicKeyPath)
		if err != nil {
			logger.Error("unable to run connect: spec.verifierPublicKeyPath: " + err.Error())
			os.Exit(1)
		}
		opts.VerifierPublicKey = key
	}

	processor, err := connect.New(cfg.Spec.ConnectSpec, trustOf(cfg.Spec), deps, opts)
	if err != nil {
		logger.Error("unable to run connect: " + err.Error())
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Info("routr connect", "version", version, "locationAddr", cfg.Spec.LocationAddr, "apiAddr", cfg.Spec.APIAddr)
	if err := service.Serve(ctx, logger, "connect", cfg.Spec.BindAddr, processor.Register); err != nil {
		logger.Error("unable to run connect: " + err.Error())
		tel.Shutdown()
		os.Exit(1)
	}
}

// trustOf is who Connect believes, from the file: every list reaches it, or the
// Registry's REGISTER or a peer EdgePort is challenged like a stranger.
func trustOf(spec config.ConnectFileSpec) connect.Trust {
	return connect.Trust{
		EdgePorts:         spec.TrustedEdgePorts,
		EdgePortAddresses: spec.TrustedEdgePortAddresses,
		RegistryAddresses: spec.TrustedRegistryAddresses,
	}
}
