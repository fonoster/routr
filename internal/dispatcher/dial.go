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

package dispatcher

import (
	"errors"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/service"
)

// Backend is a connected processor or middleware: the generated client plus
// the connection it owns.
type Backend interface {
	processor.ProcessorClient
	Close() error
}

// Dialer connects to the processor or middleware at addr. Dial calls it
// once per distinct address.
type Dialer func(addr string) (Backend, error)

// Backends are the bindings of a dispatcher.yaml over the connections Dial
// opened, one per distinct address. The caller that dialed closes them.
type Backends struct {
	Processors  []Binding
	Middlewares []MiddlewareBinding

	conns map[string]Backend
}

// Dial is the address-based path of a standalone Dispatcher: it connects
// to every processor and middleware of dispatcher.yaml, once per distinct
// address, and builds the bindings New takes. On a failure what was dialed
// is closed again and the error names the entry.
func Dial(spec config.DispatcherFileSpec, dial Dialer) (*Backends, error) {
	if dial == nil {
		dial = DialBackend
	}
	b := &Backends{conns: map[string]Backend{}}
	for _, p := range spec.Processors {
		client, err := b.backend(p.Addr, dial)
		if err != nil {
			_ = b.Close()
			return nil, fmt.Errorf("processor ref = %s: %w", p.Ref, err)
		}
		b.Processors = append(b.Processors, Binding{Ref: p.Ref, Methods: p.Methods, MatchFunc: p.MatchFunc, Client: client})
	}
	for _, m := range spec.Middlewares {
		client, err := b.backend(m.Addr, dial)
		if err != nil {
			_ = b.Close()
			return nil, fmt.Errorf("middleware ref = %s: %w", m.Ref, err)
		}
		b.Middlewares = append(b.Middlewares, MiddlewareBinding{Ref: m.Ref, PostProcessor: m.PostProcessor, Client: client})
	}
	return b, nil
}

// backend returns the client for addr, dialing it the first time.
func (b *Backends) backend(addr string, dial Dialer) (processor.ProcessorClient, error) {
	if conn, ok := b.conns[addr]; ok {
		return conn, nil
	}
	conn, err := dial(addr)
	if err != nil {
		return nil, err
	}
	b.conns[addr] = conn
	return conn, nil
}

// Close closes every connection. The bindings must not be used afterwards.
func (b *Backends) Close() error {
	var errs []error
	for addr, conn := range b.conns {
		if err := conn.Close(); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", addr, err))
		}
	}
	b.conns = map[string]Backend{}
	return errors.Join(errs...)
}

// grpcBackend is a Backend over a gRPC connection it owns.
type grpcBackend struct {
	processor.ProcessorClient
	conn *grpc.ClientConn
}

func (b *grpcBackend) Close() error { return b.conn.Close() }

// DialBackend is the default Dialer: one insecure gRPC connection per
// address, with gRPC's defaults as the Node dispatcher used them (no
// deadline of its own, the EdgePort's deadline propagated; no retry policy;
// a call to an unreachable backend fails with UNAVAILABLE rather than
// waiting for the connection), balanced round robin over every address the
// name resolves to (service.NewClient).
func DialBackend(addr string) (Backend, error) {
	conn, err := service.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("unable to reach the backend at %s: %w", addr, err)
	}
	return &grpcBackend{ProcessorClient: processor.NewProcessorClient(conn), conn: conn}, nil
}
