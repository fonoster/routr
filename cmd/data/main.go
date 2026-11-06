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
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/data"
)

// version is set at build time (-ldflags "-X main.version=...")
var version = "unknown"

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg, err := data.LoadConfig(os.Getenv("CONFIG_PATH"))
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	store, err := openStore(ctx, cfg)
	if err != nil {
		log.Error("unable to open the data backend: " + err.Error())
		os.Exit(1)
	}
	defer store.Close()

	api, err := data.New(store, data.Options{Logger: log})
	if err != nil {
		log.Error("unable to run the data api: " + err.Error())
		os.Exit(1)
	}

	lis, err := net.Listen("tcp", cfg.BindAddr)
	if err != nil {
		log.Error("unable to listen: " + err.Error())
		os.Exit(1)
	}
	server := grpc.NewServer()
	api.Register(server)

	log.Info("starting routr service", "name", "data", "version", version, "backend", cfg.Backend, "bindAddr", cfg.BindAddr)
	errc := make(chan error, 1)
	go func() { errc <- server.Serve(lis) }()

	select {
	case <-ctx.Done():
		log.Info("stopping routr service", "name", "data")
		server.GracefulStop()
	case err := <-errc:
		if err != nil {
			log.Error("data api stopped: " + err.Error())
			os.Exit(1)
		}
	}
}

// openStore builds the backend spec.data names.
func openStore(ctx context.Context, cfg *data.Config) (data.Store, error) {
	switch cfg.Backend {
	case data.BackendFiles:
		return data.NewFiles(cfg.Path)
	case data.BackendPostgres:
		if cfg.EncryptionKey != "" {
			// The cloak cipher is the config slice's; until RoutrOne wires it
			// a standalone Data API would serve the ciphertext as the password
			return nil, fmt.Errorf("spec.data.encryptionKey is not supported by the standalone data api yet")
		}
		return data.OpenPostgres(ctx, cfg.URL, data.Identity{})
	}
	return nil, fmt.Errorf("unknown backend %q", cfg.Backend)
}
