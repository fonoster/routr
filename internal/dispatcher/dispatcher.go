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

// Package dispatcher is the Message Dispatcher (CORE.md): it takes every
// message the EdgePort received, runs it through the configured middlewares,
// forwards it to the first processor whose methods and matchFunc take it, and
// returns that processor's answer. It is the Go port of mods/dispatcher.
package dispatcher

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/pb/processor"
)

// Backend is a connected processor or middleware: the generated client plus
// the connection it owns.
type Backend interface {
	processor.ProcessorClient
	Close() error
}

// Dialer connects to the processor or middleware at addr. New calls it once
// per distinct address; the Dispatcher closes what it returns on Close.
type Dialer func(addr string) (Backend, error)

// Options are what New needs besides the config.
type Options struct {
	// Logger receives the dispatcher's logs; slog.Default() when nil
	Logger *slog.Logger
	// Dial connects to the backends; DialBackend (insecure gRPC) when nil
	Dial Dialer
}

// Dispatcher implements processor.ProcessorServer for the EdgePort.
type Dispatcher struct {
	processor.UnimplementedProcessorServer

	log         *slog.Logger
	processors  []*compiledProcessor
	middlewares []*middleware
	backends    map[string]Backend
}

// New builds a Dispatcher from a validated config: it compiles every
// matchFunc and connects to every backend address once. A matchFunc that
// does not compile fails the load, naming the processor.
func New(cfg *Config, opts Options) (*Dispatcher, error) {
	if cfg == nil {
		return nil, errors.New("config is required")
	}
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	dial := opts.Dial
	if dial == nil {
		dial = DialBackend
	}

	d := &Dispatcher{log: log, backends: map[string]Backend{}}
	for _, pc := range cfg.Spec.Processors {
		match, err := compileMatchFunc(pc.MatchFunc)
		if err != nil {
			_ = d.Close()
			return nil, fmt.Errorf("processor ref = %s: %w", pc.Ref, err)
		}
		client, err := d.backend(pc.Addr, dial)
		if err != nil {
			_ = d.Close()
			return nil, fmt.Errorf("processor ref = %s: %w", pc.Ref, err)
		}
		d.processors = append(d.processors, &compiledProcessor{
			ref:     pc.Ref,
			addr:    pc.Addr,
			methods: methodSet(pc.Methods),
			match:   match,
			client:  client,
		})
	}
	for _, mc := range cfg.Spec.Middlewares {
		client, err := d.backend(mc.Addr, dial)
		if err != nil {
			_ = d.Close()
			return nil, fmt.Errorf("middleware ref = %s: %w", mc.Ref, err)
		}
		d.middlewares = append(d.middlewares, &middleware{
			ref:           mc.Ref,
			addr:          mc.Addr,
			postProcessor: mc.PostProcessor,
			client:        client,
		})
	}
	return d, nil
}

// backend returns the client for addr, dialing it the first time.
func (d *Dispatcher) backend(addr string, dial Dialer) (processor.ProcessorClient, error) {
	if b, ok := d.backends[addr]; ok {
		return b, nil
	}
	b, err := dial(addr)
	if err != nil {
		return nil, err
	}
	d.backends[addr] = b
	return b, nil
}

// Register adds the dispatcher to a gRPC server as the Processor service.
func (d *Dispatcher) Register(s grpc.ServiceRegistrar) {
	processor.RegisterProcessorServer(s, d)
}

// Close closes every backend connection. The dispatcher must not be used
// afterwards.
func (d *Dispatcher) Close() error {
	var errs []error
	for addr, b := range d.backends {
		if err := b.Close(); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", addr, err))
		}
	}
	d.backends = map[string]Backend{}
	return errors.Join(errs...)
}

// ProcessMessage is the Processor service the EdgePort calls. A response
// other than 200 OK or 180 Ringing goes to the processor alone; anything
// else runs the pre middlewares, the processor and the post middlewares,
// in that order. The answer carries the last message, the processor's
// sender and its metadata without any trace.* key (processor.ts).
func (d *Dispatcher) ProcessMessage(ctx context.Context, request *processor.MessageRequest) (*processor.MessageResponse, error) {
	if isErrorResponse(request) {
		result, err := d.runProcessor(ctx, request)
		if err != nil {
			return nil, err
		}
		return toResponse(result), nil
	}

	pre, err := d.runMiddlewares(ctx, request, false)
	if err != nil {
		return nil, err
	}
	processed, err := d.runProcessor(ctx, pre)
	if err != nil {
		return nil, err
	}
	post, err := d.runMiddlewares(ctx, processed, true)
	if err != nil {
		return nil, err
	}
	return toResponse(post), nil
}

// toResponse is what goes back to the EdgePort: the MessageResponse fields
// of the result, the trace metadata removed.
func toResponse(result *processor.MessageRequest) *processor.MessageResponse {
	return &processor.MessageResponse{
		Sender:   result.GetSender(),
		Message:  result.GetMessage(),
		Metadata: withoutTraceMetadata(result.GetMetadata()),
	}
}

// grpcBackend is a Backend over a gRPC connection the dispatcher owns.
type grpcBackend struct {
	processor.ProcessorClient
	conn *grpc.ClientConn
}

func (b *grpcBackend) Close() error { return b.conn.Close() }

// DialBackend is the default Dialer: one insecure gRPC connection per
// address, with gRPC's defaults as the Node dispatcher used them (no
// deadline of its own, the EdgePort's deadline propagated; no retry policy;
// a call to an unreachable backend fails with UNAVAILABLE rather than
// waiting for the connection).
func DialBackend(addr string) (Backend, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("unable to reach the backend at %s: %w", addr, err)
	}
	return &grpcBackend{ProcessorClient: processor.NewProcessorClient(conn), conn: conn}, nil
}
