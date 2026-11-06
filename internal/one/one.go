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

// Package one is RoutrOne (ROUTR3.md § 3.1, § 3.4, § 3.7): every component
// of Routr in one process, wired directly. The EdgePort hands each message
// to the Dispatcher, the Dispatcher to Connect, and Connect reads the
// Location and the Data API through in-process adapters of their generated
// client interfaces, with a read cache in front of the Data API. The
// Location, Data API and Connect services are also served over gRPC on
// their Routr 2 ports, so rctl, the SDK and external processors keep
// working. One routr.yaml configures all of it.
package one

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"sync"
	"sync/atomic"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/fonoster/routr/internal/common/cloak"
	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/connect"
	"github.com/fonoster/routr/internal/data"
	"github.com/fonoster/routr/internal/dispatcher"
	"github.com/fonoster/routr/internal/edgeport"
	"github.com/fonoster/routr/internal/location"
)

// Listeners are the gRPC addresses RoutrOne serves besides SIP. An empty
// address turns that listener off.
type Listeners struct {
	// Location serves the Location service (Routr 2: 51902).
	Location string
	// Data serves the Data API, the seven Connect resource services, with no
	// cache in front (Routr 2: 51907).
	Data string
	// Connect serves the Connect processor, for an external Dispatcher
	// (Routr 2: 51904).
	Connect string
}

// DefaultListeners are the Routr 2 ports, all on.
func DefaultListeners() Listeners {
	return Listeners{
		Location: "0.0.0.0:51902",
		Data:     "0.0.0.0:51907",
		Connect:  "0.0.0.0:51904",
	}
}

// Options are what New needs besides routr.yaml.
type Options struct {
	// Logger receives every component's logs; slog.Default() when nil.
	Logger *slog.Logger
	// Env is the EdgePort's environment, read as cmd/edgeport reads it.
	Env config.Env
	// Version is what the EdgePort announces.
	Version string
	// Listeners are the gRPC addresses served; DefaultListeners() when nil.
	Listeners *Listeners
	// Cache tunes the read cache; a zero field takes Routr 2's value.
	Cache CacheOptions
}

// inProcessAddr stands where a component's config demands an address it
// never uses once its clients are injected (connect.Spec.LocationAddr and
// APIAddr; the Dispatcher's processor addr).
const inProcessAddr = "in-process"

// One is RoutrOne: built by New, run by Run until its context ends.
type One struct {
	log *slog.Logger

	dataAPI       *data.Data
	cache         *FindCache
	locationStore *location.MemoryStore
	location      *location.Location
	connect       *connect.Connect
	dispatcher    *dispatcher.Dispatcher
	edgePort      *edgeport.EdgePort
	// servers are the gRPC listeners, in start order
	servers []namedServer

	ran       atomic.Bool
	closeOnce sync.Once
}

type namedServer struct {
	name string
	lis  net.Listener
	srv  *grpc.Server
}

// New builds every component from routr.yaml and binds the gRPC listeners.
// What milestone 1 does not ship fails here with a clear error: the Redis
// Location store and the RTPRelay (milestone 3). A failure leaves nothing
// running.
func New(ctx context.Context, cfg *config.Routr, opts Options) (*One, error) {
	if cfg == nil {
		return nil, errors.New("config is required")
	}
	if cfg.Spec.EdgePort == nil {
		return nil, errors.New("spec.edgeport: is required")
	}
	if cfg.Spec.Location.Cache.Provider == "redis" {
		return nil, errors.New("spec.location.cache.provider: redis is not available in milestone 1, use memory (the Redis store ships in milestone 3)")
	}
	if cfg.Spec.RTPRelay != nil {
		return nil, errors.New("spec.rtprelay: the RTPRelay is not available in milestone 1, remove the section (it ships in milestone 3)")
	}
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	listeners := DefaultListeners()
	if opts.Listeners != nil {
		listeners = *opts.Listeners
	}

	cache, err := NewFindCache(opts.Cache)
	if err != nil {
		return nil, err
	}
	store, err := openStore(ctx, cfg.Spec.Data)
	if err != nil {
		return nil, err
	}
	dataAPI, err := data.New(store, data.Options{Logger: log})
	if err != nil {
		_ = store.Close()
		return nil, err
	}

	o := &One{log: log, dataAPI: dataAPI, cache: cache}
	if err := o.build(cfg, listeners, opts); err != nil {
		_ = o.Close()
		return nil, err
	}
	return o, nil
}

// build wires the components over the Data API and binds the listeners;
// on an error the caller closes what was built.
func (o *One) build(cfg *config.Routr, listeners Listeners, opts Options) error {
	o.locationStore = location.NewMemoryStore()
	o.location = location.New(o.locationStore)

	c, err := connect.New(connectConfig(cfg), connect.Dependencies{
		Location: locationAdapter{srv: o.location},
		Agents:   cachedAgents{AgentsClient: agentsAdapter{srv: o.dataAPI.Agents()}, cache: o.cache},
		Domains:  cachedDomains{DomainsClient: domainsAdapter{srv: o.dataAPI.Domains()}, cache: o.cache},
		Trunks:   cachedTrunks{TrunksClient: trunksAdapter{srv: o.dataAPI.Trunks()}, cache: o.cache},
	}, connect.Options{Logger: o.log})
	if err != nil {
		return err
	}
	o.connect = c

	// The one processor binding is Connect, in process: the Dialer hands it
	// over whatever the address says
	d, err := dispatcher.New(dispatcherConfig(cfg), dispatcher.Options{
		Logger: o.log,
		Dial:   func(string) (dispatcher.Backend, error) { return processorAdapter{srv: c}, nil },
	})
	if err != nil {
		return err
	}
	o.dispatcher = d

	// The served gRPC: the Location, the Data API (no cache; a write
	// through it invalidates the cache), and Connect
	services := []struct {
		name, addr string
		register   func(grpc.ServiceRegistrar)
		options    []grpc.ServerOption
	}{
		{"location", listeners.Location, o.location.Register, nil},
		{"data", listeners.Data, o.dataAPI.Register, []grpc.ServerOption{grpc.ChainUnaryInterceptor(invalidateOnWrite(o.cache))}},
		{"connect", listeners.Connect, o.connect.Register, nil},
	}
	for _, s := range services {
		if s.addr == "" {
			continue
		}
		lis, err := net.Listen("tcp", s.addr)
		if err != nil {
			return fmt.Errorf("unable to listen for the %s service on %s: %w", s.name, s.addr, err)
		}
		srv := grpc.NewServer(s.options...)
		s.register(srv)
		// The chart's liveness probe is a gRPC health check on the service port
		healthpb.RegisterHealthServer(srv, health.NewServer())
		o.servers = append(o.servers, namedServer{name: s.name, lis: lis, srv: srv})
	}

	// The EdgePort, last: it hands every message to the Dispatcher directly
	env := opts.Env
	env.ProcessorAddr = ""
	ep, err := edgeport.New(cfg.EdgePortConfig(), edgeport.Options{
		Processor:     processorAdapter{srv: d},
		Env:           env,
		Version:       opts.Version,
		UDPReadBuffer: cfg.Spec.EdgePort.UDPReadBuffer,
	})
	if err != nil {
		return err
	}
	o.edgePort = ep
	return nil
}

// Run serves everything until ctx ends or a server fails, then stops it all
// in reverse start order: the EdgePort, the gRPC servers (gracefully), the
// components. It returns the failure, nil on a clean stop. Run cleans up
// after itself; Close is for a One that never ran.
func (o *One) Run(ctx context.Context) error {
	o.ran.Store(true)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errc := make(chan error, len(o.servers)+1)
	var wg sync.WaitGroup
	for _, s := range o.servers {
		o.log.Info("serving the "+s.name+" service", "addr", s.lis.Addr().String())
		wg.Add(1)
		go func(s namedServer) {
			defer wg.Done()
			if err := s.srv.Serve(s.lis); err != nil {
				errc <- fmt.Errorf("%s service: %w", s.name, err)
			}
		}(s)
	}
	edgePortDone := make(chan struct{})
	go func() {
		defer close(edgePortDone)
		// Start returns nil when ctx ends, having closed the EdgePort
		if err := o.edgePort.Start(ctx); err != nil {
			errc <- fmt.Errorf("edgeport: %w", err)
		}
	}()

	var err error
	select {
	case <-ctx.Done():
	case err = <-errc:
	}

	o.log.Info("stopping routr")
	cancel()
	<-edgePortDone
	for i := len(o.servers) - 1; i >= 0; i-- {
		o.servers[i].srv.GracefulStop()
	}
	wg.Wait()
	o.closeComponents()
	return err
}

// Close releases a One that never ran: the bound listeners and the
// components. After Run it is a no-op.
func (o *One) Close() error {
	if o.ran.Load() {
		return nil
	}
	for _, s := range o.servers {
		s.srv.Stop()
		_ = s.lis.Close()
	}
	if o.edgePort != nil {
		o.edgePort.Close()
	}
	o.closeComponents()
	return nil
}

// closeComponents closes what was built, once, in reverse build order.
func (o *One) closeComponents() {
	o.closeOnce.Do(func() {
		if o.dispatcher != nil {
			if err := o.dispatcher.Close(); err != nil {
				o.log.Warn("unable to close the dispatcher", "error", err)
			}
		}
		if o.locationStore != nil {
			if err := o.locationStore.Close(); err != nil {
				o.log.Warn("unable to close the location store", "error", err)
			}
		}
		if o.dataAPI != nil {
			if err := o.dataAPI.Close(); err != nil {
				o.log.Warn("unable to close the data backend", "error", err)
			}
		}
	})
}

// Addr is where the named service (location, data, connect) listens; "" when
// it is off. Tests and operators use it when the address was ":0".
func (o *One) Addr(service string) string {
	for _, s := range o.servers {
		if s.name == service {
			return s.lis.Addr().String()
		}
	}
	return ""
}

// openStore builds the backend spec.data names, as cmd/data does.
func openStore(ctx context.Context, spec config.DataSpec) (data.Store, error) {
	switch spec.Backend {
	case data.BackendFiles:
		store, err := data.NewFiles(spec.Path)
		if err != nil {
			return nil, fmt.Errorf("spec.data.path: %w", err)
		}
		return store, nil
	case data.BackendPostgres:
		var cipher data.Cipher = data.Identity{}
		if spec.EncryptionKey != "" {
			c, err := cloak.New(spec.EncryptionKey)
			if err != nil {
				return nil, fmt.Errorf("spec.data.encryptionKey: %w", err)
			}
			cipher = c
		}
		store, err := data.OpenPostgres(ctx, spec.URL, cipher)
		if err != nil {
			return nil, fmt.Errorf("spec.data.url: %w", err)
		}
		return store, nil
	}
	return nil, fmt.Errorf("spec.data.backend: unknown backend %q", spec.Backend)
}

// connectConfig is spec.connect in the shape connect.New takes. The
// addresses are placeholders: Connect's clients are injected.
func connectConfig(cfg *config.Routr) *connect.Config {
	nonceMaxAge := cfg.Spec.Connect.NonceMaxAge
	registerDefaultExpires := cfg.Spec.Connect.RegisterDefaultExpires
	return &connect.Config{
		Kind:       "Connect",
		APIVersion: "v2beta1",
		Ref:        cfg.Ref,
		Metadata:   cfg.Metadata,
		Spec: &connect.Spec{
			BindAddr:               inProcessAddr,
			LocationAddr:           inProcessAddr,
			APIAddr:                inProcessAddr,
			NonceMaxAge:            &nonceMaxAge,
			RegisterDefaultExpires: &registerDefaultExpires,
		},
	}
}

// dispatcherConfig is the Dispatcher's one binding: Connect, in process, for
// every method; the EdgePort's spec.methods already filters what comes in.
func dispatcherConfig(cfg *config.Routr) *dispatcher.Config {
	methods := make([]string, 0, len(processor.Method_name))
	for i := range int32(len(processor.Method_name)) {
		methods = append(methods, processor.Method_name[i])
	}
	return &dispatcher.Config{
		Kind:       "MessageDispatcher",
		APIVersion: "v2beta1",
		Ref:        cfg.Ref,
		Spec: dispatcher.Spec{
			BindAddr: inProcessAddr,
			Processors: []dispatcher.ProcessorConfig{{
				Ref:       "connect",
				Addr:      inProcessAddr,
				Methods:   methods,
				MatchFunc: "req => true",
			}},
		},
	}
}
