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
	"strings"

	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
)

// Binding is a Message Processor the Dispatcher forwards to: which
// requests it takes and the client that reaches it, over the wire or in
// process (ROUTR3.md § 3.1).
type Binding struct {
	Ref string
	// Methods the processor accepts, by name (INVITE, REGISTER, ...)
	Methods []string
	// MatchFunc is the JavaScript arrow function of dispatcher.yaml over the
	// MessageRequest; empty takes every request of the methods, with nothing
	// evaluated per message.
	MatchFunc string
	Client    processor.ProcessorClient
}

// MiddlewareBinding is a middleware the Dispatcher runs before the
// processor, or after it when PostProcessor is set.
type MiddlewareBinding struct {
	Ref           string
	PostProcessor bool
	Client        processor.ProcessorClient
}

// Options are what New takes.
type Options struct {
	// Logger receives the dispatcher's logs; slog.Default() when nil
	Logger *slog.Logger
	// Processors are tried in order; the first whose methods and matchFunc
	// take the request gets it. At least one is required.
	Processors []Binding
	// Middlewares run in order, each stage (pre, post) in turn.
	Middlewares []MiddlewareBinding
}

// Dispatcher implements processor.ProcessorServer for the EdgePort.
type Dispatcher struct {
	processor.UnimplementedProcessorServer

	log         *slog.Logger
	processors  []*compiledProcessor
	middlewares []*middleware
}

// New builds a Dispatcher over its bindings: it compiles every matchFunc
// and keeps the clients it was handed. It never dials; cmd/dispatcher
// dials the addresses of dispatcher.yaml (Dial) and RoutrOne binds Connect
// in process. A binding that cannot serve fails the build, naming it.
func New(opts Options) (*Dispatcher, error) {
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	if len(opts.Processors) == 0 {
		return nil, errors.New("at least one processor is required")
	}
	d := &Dispatcher{log: log}
	for i, b := range opts.Processors {
		if b.Ref == "" {
			return nil, fmt.Errorf("processors[%d]: a ref is required", i)
		}
		if b.Client == nil {
			return nil, fmt.Errorf("processor ref = %s: a client is required", b.Ref)
		}
		if len(b.Methods) == 0 {
			return nil, fmt.Errorf("processor ref = %s: at least one method is required", b.Ref)
		}
		for _, m := range b.Methods {
			if _, ok := processor.Method_value[m]; !ok {
				return nil, fmt.Errorf("processor ref = %s: unknown method %q; known methods are %s", b.Ref, m, strings.Join(config.MethodNames(), ", "))
			}
		}
		match := matchFunc(alwaysMatch)
		if strings.TrimSpace(b.MatchFunc) != "" {
			compiled, err := compileMatchFunc(b.MatchFunc)
			if err != nil {
				return nil, fmt.Errorf("processor ref = %s: %w", b.Ref, err)
			}
			match = compiled
		}
		d.processors = append(d.processors, &compiledProcessor{
			ref:     b.Ref,
			methods: methodSet(b.Methods),
			match:   match,
			client:  b.Client,
		})
	}
	for i, m := range opts.Middlewares {
		if m.Ref == "" {
			return nil, fmt.Errorf("middlewares[%d]: a ref is required", i)
		}
		if m.Client == nil {
			return nil, fmt.Errorf("middleware ref = %s: a client is required", m.Ref)
		}
		d.middlewares = append(d.middlewares, &middleware{
			ref:           m.Ref,
			postProcessor: m.PostProcessor,
			client:        m.Client,
		})
	}
	return d, nil
}

// Register adds the dispatcher to a gRPC server as the Processor service.
func (d *Dispatcher) Register(s grpc.ServiceRegistrar) {
	processor.RegisterProcessorServer(s, d)
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
