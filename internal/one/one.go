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
// client interfaces, with a read cache in front of the Data API. With
// spec.registry the Registry reads its Trunks through that cache and sends
// their REGISTER through the Requester, also in process. The Location, Data
// API, Connect, Dispatcher and Requester services are also served over gRPC
// on their Routr 2 ports (each section's bindAddr; empty turns one off), so
// rctl, the SDK, external processors and middlewares keep working; the Requester
// exists only with spec.registry.
// One routr.yaml configures all of it; nothing is read from the environment.
package one

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"

	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/verifier"
	"github.com/fonoster/routr/internal/common/service"
	"github.com/fonoster/routr/internal/connect"
	"github.com/fonoster/routr/internal/data"
	"github.com/fonoster/routr/internal/dispatcher"
	"github.com/fonoster/routr/internal/edgeport"
	"github.com/fonoster/routr/internal/location"
	"github.com/fonoster/routr/internal/registry"
	"github.com/fonoster/routr/internal/requester"
)

// Options are what New needs besides routr.yaml.
type Options struct {
	// Logger receives every component's logs; slog.Default() when nil.
	Logger *slog.Logger
	// Version is what the EdgePort announces.
	Version string
	// Cache tunes the read cache; a zero field takes Routr 2's value.
	Cache CacheOptions
	// Verifier is the client for spec.connect.verifierAddr, dialed by the
	// command; required when that key is set.
	Verifier verifier.VerifierClient
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
	requester     *requester.Requester
	registry      *registry.Registry
	// requesterFailed takes what a SIP listening point of the Requester
	// reports when it stops by itself: at most one per listening point
	requesterFailed chan error
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

	if err := o.buildRequester(cfg); err != nil {
		return err
	}
	// Connect honors X-Gateway-Auth only from the Registry's Requester, and
	// that address gets nothing else: RoutrOne has no peer EdgePorts, so
	// X-Edgeport-Ref is honored from nobody
	var trust connect.Trust
	if cfg.Spec.Registry != nil {
		trust.RegistryAddresses = []string{o.requester.Host()}
	}

	trunksClient := cachedTrunks{TrunksClient: trunksAdapter{srv: o.dataAPI.Trunks()}, cache: o.cache}
	connectOpts := connect.Options{Logger: o.log, UntrustedHeaders: cfg.Spec.Connect.UntrustedHeadersToStrip}
	if cfg.Spec.Connect.VerifierAddr != "" && opts.Verifier == nil {
		return errors.New("spec.connect.verifierAddr: needs a Verifier client")
	}
	if path := cfg.Spec.Connect.VerifierPublicKeyPath; path != "" {
		key, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("spec.connect.verifierPublicKeyPath: %w", err)
		}
		connectOpts.VerifierPublicKey = key
	}
	c, err := connect.New(cfg.Spec.Connect, trust, connect.Dependencies{
		Location: locationAdapter{srv: o.location},
		Agents:   cachedAgents{AgentsClient: agentsAdapter{srv: o.dataAPI.Agents()}, cache: o.cache},
		Domains:  cachedDomains{DomainsClient: domainsAdapter{srv: o.dataAPI.Domains()}, cache: o.cache},
		Trunks:   trunksClient,
		Numbers:  cachedNumbers{NumbersClient: numbersAdapter{srv: o.dataAPI.Numbers()}, cache: o.cache},
		Peers:    cachedPeers{PeersClient: peersAdapter{srv: o.dataAPI.Peers()}, cache: o.cache},
		Verifier: opts.Verifier,
	}, connectOpts)
	if err != nil {
		return err
	}
	o.connect = c

	// The one processor binding is Connect, in process, with no matchFunc:
	// nothing is evaluated per message. spec.methods is what it takes, as in
	// Routr 2's RoutrOne; a request of any other method is answered 501.
	d, err := dispatcher.New(dispatcher.Options{
		Logger:     o.log,
		Processors: []dispatcher.Binding{{Ref: "connect", Methods: cfg.Spec.EdgePort.Methods, Client: processorAdapter{srv: c}}},
	})
	if err != nil {
		return err
	}
	o.dispatcher = d

	if err := o.buildRegistry(cfg, trunksClient); err != nil {
		return err
	}

	// The served gRPC: the Location, the Data API (no cache; a write
	// through it invalidates the cache), Connect, the Dispatcher and the
	// Requester
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
	if o.requester != nil {
		services = append(services, struct {
			name, addr string
			register   func(grpc.ServiceRegistrar)
			options    []grpc.ServerOption
		}{"requester", cfg.Spec.Requester.BindAddr, o.requester.Register, nil})
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

// buildRequester builds the Requester when the Registry uses it. Without one
// nothing in RoutrOne sends a SIP request of its own, so no listening point opens.
func (o *One) buildRequester(cfg *config.Routr) error {
	if cfg.Spec.Registry == nil {
		return nil
	}
	// The Requester's SIP stack starts here, the EdgePort's only in Run:
	// sipgo's package-level settings go first
	edgeport.InitSIPGlobals(o.log, false)
	o.requesterFailed = make(chan error, 2)
	r, err := requester.New(requester.Options{
		Logger:    o.log,
		SIPHost:   cfg.Spec.Requester.SIPHost,
		OnFailure: func(err error) { o.requesterFailed <- err },
	})
	if err != nil {
		return err
	}
	o.requester = r
	return nil
}

// buildRegistry builds the Registry when spec.registry asks for one, over the
// Requester in process and the cached Trunks client.
func (o *One) buildRegistry(cfg *config.Routr, trunksClient cachedTrunks) error {
	spec := cfg.Spec.Registry
	if spec == nil {
		return nil
	}
	edgePorts := make([]registry.EdgePort, 0, len(spec.EdgePorts))
	for _, e := range spec.EdgePorts {
		edgePorts = append(edgePorts, registry.EdgePort{Address: e.Address, Region: e.Region})
	}
	reg, err := registry.New(registry.Spec{
		RegisterInterval: spec.RegisterInterval,
		Methods:          spec.Methods,
		EdgePorts:        edgePorts,
	}, registry.Dependencies{
		Requester: requesterAdapter{srv: o.requester},
		Trunks:    trunksClient,
	}, registry.Options{Logger: o.log})
	if err != nil {
		return err
	}
	o.registry = reg
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
	if o.registry != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			o.registry.Run(ctx)
		}()
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
	case err = <-o.requesterFailed:
	}

	o.log.Info("stopping routr")
	cancel()
	// The sends still waiting on the SIP stack would hold the gRPC server's
	// graceful stop and the Registry's last round
	if o.requester != nil {
		o.requester.Close()
	}
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
// Requester, the Location store and the data store RoutrOne opened.
func (o *One) closeComponents() {
	o.closeOnce.Do(func() {
		if o.requester != nil {
			o.requester.Close()
		}
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

// Addr is where the named service (location, data, connect, dispatcher,
// requester) listens; "" when it is off. Tests and operators use it when the bindAddr
// was ":0".
func (o *One) Addr(name string) string {
	for _, s := range o.servers {
		if s.Name() == name {
			return s.Addr()
		}
	}
	return ""
}
