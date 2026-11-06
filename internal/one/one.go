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
// Location, Data API, Connect and Dispatcher services are also served over
// gRPC on their Routr 2 ports (each section's bindAddr; empty turns one
// off), so rctl, the SDK, external processors and middlewares keep working.
// One routr.yaml configures all of it; nothing is read from the environment.
package one

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"

	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/connect"
	"github.com/fonoster/routr/internal/data"
	"github.com/fonoster/routr/internal/dispatcher"
	"github.com/fonoster/routr/internal/edgeport"
	"github.com/fonoster/routr/internal/location"
)

// Options are what New needs besides routr.yaml.
type Options struct {
	// Logger receives every component's logs; slog.Default() when nil.
	Logger *slog.Logger
	// Version is what the EdgePort announces.
	Version string
	// Cache tunes the read cache; a zero field takes Routr 2's value.
	Cache CacheOptions
}

// One is RoutrOne: built by New, run by Run until its context ends.
type One struct {
	log *slog.Logger

	store         data.Store
	dataAPI       *data.Data
	cache         *FindCache
	locationStore *location.MemoryStore
	location      *location.Location
	connect       *connect.Connect
	dispatcher    *dispatcher.Dispatcher
	edgePort      *edgeport.EdgePort
	// servers are the gRPC listeners, bound, in start order
	servers []*service.Server

	ran       atomic.Bool
	closeOnce sync.Once
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

	cache, err := NewFindCache(opts.Cache)
	if err != nil {
		return nil, err
	}
	store, err := data.OpenStore(ctx, cfg.Spec.Data)
	if err != nil {
		return nil, err
	}
	dataAPI, err := data.New(store, data.Options{Logger: log})
	if err != nil {
		_ = store.Close()
		return nil, err
	}

	o := &One{log: log, store: store, dataAPI: dataAPI, cache: cache}
	if err := o.build(cfg, opts); err != nil {
		_ = o.Close()
		return nil, err
	}
	return o, nil
}

// build wires the components over the Data API and binds the listeners;
// on an error the caller closes what was built.
func (o *One) build(cfg *config.Routr, opts Options) error {
	o.locationStore = location.NewMemoryStore()
	o.location = location.New(o.locationStore)

	c, err := connect.New(cfg.Spec.Connect, connect.Trust{}, connect.Dependencies{
		Location: locationAdapter{srv: o.location},
		Agents:   cachedAgents{AgentsClient: agentsAdapter{srv: o.dataAPI.Agents()}, cache: o.cache},
		Domains:  cachedDomains{DomainsClient: domainsAdapter{srv: o.dataAPI.Domains()}, cache: o.cache},
		Trunks:   cachedTrunks{TrunksClient: trunksAdapter{srv: o.dataAPI.Trunks()}, cache: o.cache},
	}, connect.Options{Logger: o.log})
	if err != nil {
		return err
	}
	o.connect = c

	// The one processor binding is Connect, in process, for every method
	// and with no matchFunc: nothing is evaluated per message. The
	// EdgePort's spec.methods already filters what comes in.
	d, err := dispatcher.New(dispatcher.Options{
		Logger:     o.log,
		Processors: []dispatcher.Binding{{Ref: "connect", Methods: config.MethodNames(), Client: processorAdapter{srv: c}}},
	})
	if err != nil {
		return err
	}
	o.dispatcher = d

	// The served gRPC: the Location, the Data API (no cache; a write
	// through it invalidates the cache), Connect and the Dispatcher
	services := []struct {
		name, addr string
		register   func(grpc.ServiceRegistrar)
		options    []grpc.ServerOption
	}{
		{"location", cfg.Spec.Location.BindAddr, o.location.Register, nil},
		{"data", cfg.Spec.Data.BindAddr, o.dataAPI.Register, []grpc.ServerOption{grpc.ChainUnaryInterceptor(invalidateOnWrite(o.cache))}},
		{"connect", cfg.Spec.Connect.BindAddr, o.connect.Register, nil},
		{"dispatcher", cfg.Spec.Dispatcher.BindAddr, o.dispatcher.Register, nil},
	}
	for _, s := range services {
		if s.addr == "" {
			continue
		}
		srv, err := service.Listen(o.log, s.name, s.addr, s.register, s.options...)
		if err != nil {
			return err
		}
		o.servers = append(o.servers, srv)
	}

	// The EdgePort, last: it hands every message to the Dispatcher directly.
	// Its environment is empty: RoutrOne reads routr.yaml and nothing else.
	ep, err := edgeport.New(cfg.EdgePortConfig(), edgeport.Options{
		Processor:     processorAdapter{srv: d},
		Logger:        o.log,
		Env:           config.Env{},
		Version:       opts.Version,
		UDPReadBuffer: cfg.Spec.EdgePort.UDPReadBuffer,
	})
	if err != nil {
		return err
	}
	o.edgePort = ep
	return nil
}

// Run serves everything until ctx ends or a server fails, then stops it
// all: the EdgePort, the gRPC servers (gracefully), the components. It
// returns the failure, nil on a clean stop. Run cleans up after itself;
// Close is for a One that never ran.
func (o *One) Run(ctx context.Context) error {
	o.ran.Store(true)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errc := make(chan error, len(o.servers)+1)
	var wg sync.WaitGroup
	for _, s := range o.servers {
		wg.Add(1)
		go func(s *service.Server) {
			defer wg.Done()
			if err := s.Serve(ctx); err != nil {
				errc <- err
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
		s.Close()
	}
	if o.edgePort != nil {
		o.edgePort.Close()
	}
	o.closeComponents()
	return nil
}

// closeComponents closes what was built, once, in reverse build order: the
// Location store and the data store RoutrOne opened.
func (o *One) closeComponents() {
	o.closeOnce.Do(func() {
		if o.locationStore != nil {
			if err := o.locationStore.Close(); err != nil {
				o.log.Warn("unable to close the location store", "error", err)
			}
		}
		if o.store != nil {
			if err := o.store.Close(); err != nil {
				o.log.Warn("unable to close the data backend", "error", err)
			}
		}
	})
}

// Addr is where the named service (location, data, connect, dispatcher)
// listens; "" when it is off. Tests and operators use it when the bindAddr
// was ":0".
func (o *One) Addr(name string) string {
	for _, s := range o.servers {
		if s.Name() == name {
			return s.Addr()
		}
	}
	return ""
}
