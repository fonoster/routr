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

package processor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	pb "github.com/fonoster/routr/pkg/processor/pb/processor"
)

// The message types and the client of the Processor contract, re-exported
// from pb/processor so a processor imports one package named processor.
type (
	// MessageRequest is a SIP message as the Dispatcher hands it to a processor.
	MessageRequest = pb.MessageRequest
	// MessageResponse is a processor's answer: a SIP response, or the request
	// to send on.
	MessageResponse = pb.MessageResponse
	// NetInterface is a host, a port and a transport.
	NetInterface = pb.NetInterface
	// Method is the SIP method of a MessageRequest.
	Method = pb.Method
	// ProcessorClient calls a processor, as the Dispatcher does.
	ProcessorClient = pb.ProcessorClient
)

// NewProcessorClient is a ProcessorClient over a gRPC connection.
func NewProcessorClient(cc grpc.ClientConnInterface) ProcessorClient {
	return pb.NewProcessorClient(cc)
}

// The SIP methods, under the names the generated code gives them.
const (
	Method_UNKNOWN   = pb.Method_UNKNOWN
	Method_REGISTER  = pb.Method_REGISTER
	Method_INVITE    = pb.Method_INVITE
	Method_MESSAGE   = pb.Method_MESSAGE
	Method_PUBLISH   = pb.Method_PUBLISH
	Method_NOTIFY    = pb.Method_NOTIFY
	Method_SUBSCRIBE = pb.Method_SUBSCRIBE
	Method_ACK       = pb.Method_ACK
	Method_BYE       = pb.Method_BYE
	Method_CANCEL    = pb.Method_CANCEL
	Method_OPTIONS   = pb.Method_OPTIONS
	Method_PRACK     = pb.Method_PRACK
	Method_INFO      = pb.Method_INFO
	Method_REFER     = pb.Method_REFER
	Method_UPDATE    = pb.Method_UPDATE
)

// defaultBindAddr is where a processor listens when Options.BindAddr is empty.
const defaultBindAddr = "0.0.0.0:51904"

// versionMetadataKey is the gRPC header under which a processor announces its
// version, so a Dispatcher that records messages can write which build
// touched them.
const versionMetadataKey = "routr-component-version"

// A round-robin client such as the Dispatcher only sees a new replica when it
// resolves the processor's name again, which a healthy connection never makes
// it do. Ending each connection after a few minutes (gRPC adds ±10% jitter)
// sends it back to DNS, so a scale-up gets its share. The grace lets the calls
// on the old connection finish. The values are those of Routr's own servers
// (internal/common/service).
const (
	maxConnectionAge      = 5 * time.Minute
	maxConnectionAgeGrace = 30 * time.Second
)

// keepaliveParams are the connection limits the server runs with.
func keepaliveParams() keepalive.ServerParameters {
	return keepalive.ServerParameters{
		MaxConnectionAge:      maxConnectionAge,
		MaxConnectionAgeGrace: maxConnectionAgeGrace,
	}
}

// Options is how a processor is served.
type Options struct {
	// BindAddr is the address to listen on; 0.0.0.0:51904 when empty.
	BindAddr string
	// Name is the processor's name: the log line "starting routr <name>" and
	// the name the health service answers for.
	Name string
	// Version is sent with every answer as the gRPC header
	// routr-component-version; empty sends nothing.
	Version string
	// Logger is where the server logs; slog.Default() when nil.
	Logger *slog.Logger
}

// Handler processes one SIP message. It answers with a response helper
// (OK, NotFound, Forward...). To reject a message it returns a response
// helper, never an error: an error becomes codes.Internal with the error's
// text (a gRPC status passes through), and on any status but Unavailable the
// Dispatcher logs a warning and forwards the request unchanged; Unavailable
// makes the EdgePort answer 503.
type Handler func(ctx context.Context, req *MessageRequest) (*MessageResponse, error)

// ListenAndServe serves the Processor contract and the grpc.health.v1
// service (SERVING from the start) on opts.BindAddr, over plaintext, which
// is what the Dispatcher dials, and hands every message to handler. It runs
// until ctx is done, then stops gracefully and returns nil. A bind failure
// and a server that fails on its own are returned.
//
// The server ends each connection after about 5 minutes and gives the calls
// in flight 30 seconds to finish, so that a round-robin client such as the
// Dispatcher finds new replicas. It only does when the processor's address
// resolves to one address per replica: on Kubernetes, a headless Service
// (clusterIP: None).
//
// A panic in handler is recovered into codes.Internal and logged; the server
// stays up.
func ListenAndServe(ctx context.Context, opts Options, handler Handler) error {
	return listenAndServe(ctx, opts, handler, keepaliveParams())
}

// listenAndServe is ListenAndServe with the connection limits as an argument,
// which a test shortens.
func listenAndServe(ctx context.Context, opts Options, handler Handler, limits keepalive.ServerParameters) error {
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	bindAddr := opts.BindAddr
	if bindAddr == "" {
		bindAddr = defaultBindAddr
	}
	lis, err := net.Listen("tcp", bindAddr)
	if err != nil {
		return fmt.Errorf("unable to listen for the %s service on %s: %w", opts.Name, bindAddr, err)
	}

	srv := grpc.NewServer(
		grpc.ChainUnaryInterceptor(recoverToInternal(log, opts.Name)),
		grpc.KeepaliveParams(limits),
	)
	pb.RegisterProcessorServer(srv, &server{handler: handler, version: opts.Version})
	hs := health.NewServer()
	hs.SetServingStatus(opts.Name, healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(srv, hs)

	log.Info("starting routr "+opts.Name, "bindAddr", lis.Addr().String())
	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(lis) }()
	select {
	case <-ctx.Done():
		srv.GracefulStop()
		<-errc
		return nil
	case err := <-errc:
		if err == nil {
			err = errors.New("stopped")
		}
		return fmt.Errorf("%s service: %w", opts.Name, err)
	}
}

// server is the Processor service over a Handler.
type server struct {
	pb.UnimplementedProcessorServer
	handler Handler
	version string
}

// ProcessMessage announces the processor's version and runs the handler. A
// handler's error that is not a gRPC status becomes codes.Internal with its
// text.
func (s *server) ProcessMessage(ctx context.Context, req *pb.MessageRequest) (*pb.MessageResponse, error) {
	if s.version != "" {
		if err := grpc.SetHeader(ctx, metadata.Pairs(versionMetadataKey, s.version)); err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
	}
	res, err := s.handler(ctx, req)
	if err != nil {
		if _, ok := status.FromError(err); ok {
			return nil, err
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return res, nil
}

// recoverToInternal turns a panic in a handler into an INTERNAL status for
// that one call, logged with the method, so a bad message never stops the
// processor.
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
