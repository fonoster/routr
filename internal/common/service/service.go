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

// Package service serves a Routr component over gRPC the one way every
// cmd and RoutrOne do it: a listener on its bindAddr, a server whose
// handlers cannot crash the process, the grpc.health.v1 service the chart's
// probes check, one "starting routr <name>" line, and a graceful stop when
// the context ends.
package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
)

// Server is a component's gRPC server, bound to its address by Listen and
// run by Serve.
type Server struct {
	name string
	log  *slog.Logger
	lis  net.Listener
	srv  *grpc.Server
}

// Listen binds bindAddr and builds the server: register adds the
// component's services to it; opts are extra server options (an
// interceptor of the caller's). The health service answers SERVING from
// the start, as the Node services did. Serve runs it; Close releases a
// server that never served.
func Listen(log *slog.Logger, name, bindAddr string, register func(grpc.ServiceRegistrar), opts ...grpc.ServerOption) (*Server, error) {
	if register == nil {
		return nil, fmt.Errorf("%s service: nothing to register", name)
	}
	if log == nil {
		log = slog.Default()
	}
	lis, err := net.Listen("tcp", bindAddr)
	if err != nil {
		return nil, fmt.Errorf("unable to listen for the %s service on %s: %w", name, bindAddr, err)
	}
	srv := grpc.NewServer(append([]grpc.ServerOption{grpc.ChainUnaryInterceptor(recoverToInternal(log, name))}, opts...)...)
	register(srv)
	healthpb.RegisterHealthServer(srv, health.NewServer())
	return &Server{name: name, log: log, lis: lis, srv: srv}, nil
}

// Name is the service's name, as Listen was given it.
func (s *Server) Name() string {
	return s.name
}

// Addr is where the server listens, resolved (":0" became a port).
func (s *Server) Addr() string {
	return s.lis.Addr().String()
}

// Serve runs the server until ctx ends, then stops it gracefully and
// returns nil. A server that fails on its own returns the failure.
func (s *Server) Serve(ctx context.Context) error {
	s.log.Info("starting routr "+s.name, "bindAddr", s.Addr())
	errc := make(chan error, 1)
	go func() { errc <- s.srv.Serve(s.lis) }()
	select {
	case <-ctx.Done():
		s.srv.GracefulStop()
		<-errc
		return nil
	case err := <-errc:
		if err == nil {
			err = errors.New("stopped")
		}
		return fmt.Errorf("%s service: %w", s.name, err)
	}
}

// Close releases a server that never served: the listener and the server.
func (s *Server) Close() {
	s.srv.Stop()
	_ = s.lis.Close()
}

// Serve is Listen then Serve: what a cmd does with its one component.
func Serve(ctx context.Context, log *slog.Logger, name, bindAddr string, register func(grpc.ServiceRegistrar), opts ...grpc.ServerOption) error {
	s, err := Listen(log, name, bindAddr, register, opts...)
	if err != nil {
		return err
	}
	return s.Serve(ctx)
}

// recoverToInternal turns a panic in a handler into an INTERNAL status for
// that one call, logged with the method, so a bad request never stops the
// process.
func recoverToInternal(log *slog.Logger, name string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error("recovered from a panic in a handler", "service", name, "method", info.FullMethod, "panic", r)
				resp, err = nil, status.Error(codes.Internal, "internal error")
			}
		}()
		return handler(ctx, req)
	}
}
