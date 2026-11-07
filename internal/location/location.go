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

// Package location is the Location Service of CORE.md, ported from
// mods/location/src: the bindings every endpoint registers, the routes a
// Processor looks up for a call, and the round-robin, least-sessions and
// session-affinity choice among the routes of a backend. Routes live in a
// Store, in memory or in Redis.
package location

import (
	"context"
	"errors"
	"hash/fnv"
	"log/slog"
	"math"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"
)

// The AOR schemes AddRoute accepts; "backend:" is deprecated since spec
// v0.1.5 and kept for compatibility.
const (
	schemeSIP     = "sip:"
	schemeBackend = "backend:"
)

// CallRouteTTL is how long a call stays on the route it first got (for the
// INVITE that answers a challenge, and retries): seconds, not the whole
// registration. At many calls per second those per-call entries were most of
// the store (CALL_ROUTE_TTL_SECONDS in mods/location/src/location.ts).
const CallRouteTTL = 60 * time.Second

// pinsRefusedLogEvery spaces the log of a full pin table.
const pinsRefusedLogEvery = 1000

// aorLockStripes is how many locks AddRoute spreads the AORs over.
const aorLockStripes = 256

// Location implements locationpb.LocationServer over a Store.
type Location struct {
	locationpb.UnimplementedLocationServer

	log         *slog.Logger
	pinsRefused atomic.Uint64

	store Store
	now   func() time.Time

	mu sync.Mutex
	// backend reference -> the position round-robin hands out next
	rr map[string]int
	// backend reference -> the least-sessions calls that found a tie
	tied map[string]int

	// aorLocks serialize the registrations of one AOR, so the maxContacts
	// check and the put it guards are one step: two REGISTERs of the same
	// AOR at once cannot both pass the check. Striped by a hash of the
	// AOR, so there is no lock per AOR to grow or sweep; the registrations
	// of the AORs that share a stripe wait on each other for the length of
	// a store round trip.
	aorLocks [aorLockStripes]sync.Mutex
}

// Option configures a Location.
type Option func(*Location)

// WithLogger sets where the Location logs; slog.Default() when not given.
func WithLogger(log *slog.Logger) Option {
	return func(l *Location) {
		if log != nil {
			l.log = log
		}
	}
}

// WithClock replaces the clock, for tests.
func WithClock(now func() time.Time) Option {
	return func(l *Location) { l.now = now }
}

// New returns a Location over the store. The store stays the caller's: close
// it when the Location is done.
func New(store Store, opts ...Option) *Location {
	l := &Location{log: slog.Default(), store: store, now: time.Now, rr: map[string]int{}, tied: map[string]int{}}
	for _, opt := range opts {
		opt(l)
	}
	return l
}

// Register serves the Location on a gRPC server.
func (l *Location) Register(s grpc.ServiceRegistrar) {
	locationpb.RegisterLocationServer(s, l)
}

// AddRoute binds a route to an AOR. A contact already bound (same user, host,
// port and transport) is refreshed; a new one is refused past maxContacts
// (-1 for no limit). The check and the put are one step: inside a store that
// replicas share (ContactStore), otherwise under the AOR's lock.
func (l *Location) AddRoute(ctx context.Context, req *locationpb.AddRouteRequest) (*emptypb.Empty, error) {
	aor := req.GetAor()
	if !strings.HasPrefix(aor, schemeSIP) && !strings.HasPrefix(aor, schemeBackend) {
		return nil, errUnsupportedSchema(aor)
	}
	route := req.GetRoute()
	if route == nil {
		return nil, errMissingRoute()
	}

	if store, ok := l.store.(ContactStore); ok {
		added, err := store.PutContact(ctx, Key{Base: aor}, route, req.GetMaxContacts())
		if err != nil {
			return nil, errStore("put", err)
		}
		if !added {
			return nil, errMaxContacts(req.GetMaxContacts())
		}
		return &emptypb.Empty{}, nil
	}

	mu := l.aorLock(aor)
	mu.Lock()
	defer mu.Unlock()

	existing, err := l.store.Get(ctx, Key{Base: aor})
	if err != nil {
		return nil, errStore("get", err)
	}
	exists := false
	for _, r := range existing {
		if sameContact(r, route) {
			exists = true
			break
		}
	}
	if !exists && req.GetMaxContacts() != -1 && len(existing) >= int(req.GetMaxContacts()) {
		return nil, errMaxContacts(req.GetMaxContacts())
	}

	if err := l.store.Put(ctx, Key{Base: aor}, route); err != nil {
		return nil, errStore("put", err)
	}
	return &emptypb.Empty{}, nil
}

// aorLock is the lock the registrations of an AOR serialize on.
func (l *Location) aorLock(aor string) *sync.Mutex {
	h := fnv.New32a()
	h.Write([]byte(aor))
	return &l.aorLocks[h.Sum32()%aorLockStripes]
}

// FindRoutes returns the routes of an AOR for a call. Without a backend it
// returns every route and pins the call to the first; with one it picks a
// route by the backend's algorithm (or the call's session affinity) and pins
// the call to it. A call that is pinned gets its route back. The pin lives
// CallRouteTTL. No route answers NOT_FOUND, and nothing is stored for it.
func (l *Location) FindRoutes(ctx context.Context, req *locationpb.FindRoutesRequest) (*locationpb.FindRoutesResponse, error) {
	aor := req.GetAor()
	labels := labelsKey(req.GetLabels())
	callKey := Key{Base: aor, Suffix: req.GetCallId()}
	pinKey := callKey
	if labels != "" {
		pinKey.Suffix = req.GetCallId() + ":" + labels
	}

	routes, err := l.store.Get(ctx, pinKey)
	if err != nil {
		return nil, errStore("get", err)
	}
	if len(routes) > 0 {
		return &locationpb.FindRoutesResponse{Routes: routes}, nil
	}

	routes, err = l.store.Get(ctx, Key{Base: aor})
	if err != nil {
		return nil, errStore("get", err)
	}
	if labels != "" {
		routes = withLabels(routes, req.GetLabels())
	}
	if len(routes) == 0 {
		return nil, errNoRoutesFound(aor)
	}

	backend := req.GetBackend()
	if backend == nil {
		if err := l.pin(ctx, callKey, routes[0]); err != nil {
			return nil, err
		}
		return &locationpb.FindRoutesResponse{Routes: routes}, nil
	}

	var route *locationpb.Route
	if backend.GetWithSessionAffinity() && req.GetSessionAffinityRef() != "" {
		route, err = l.nextWithAffinity(ctx, routes, req)
		if err != nil {
			return nil, err
		}
	} else {
		route = l.next(routes, req)
	}

	if err := l.pin(ctx, pinKey, route); err != nil {
		return nil, err
	}
	return &locationpb.FindRoutesResponse{Routes: []*locationpb.Route{route}}, nil
}

// RemoveRoutes drops every route of an AOR, the per-call pins included.
func (l *Location) RemoveRoutes(ctx context.Context, req *locationpb.RemoveRoutesRequest) (*emptypb.Empty, error) {
	if err := l.store.Delete(ctx, req.GetAor()); err != nil {
		return nil, errStore("delete", err)
	}
	return &emptypb.Empty{}, nil
}

// next picks the backend's next route: the fewest sessions, or round-robin
// over the backend's routes, counted per backend reference (the AOR when the
// request names none).
func (l *Location) next(routes []*locationpb.Route, req *locationpb.FindRoutesRequest) *locationpb.Route {
	// Both count over the routes by endpoint, not in the order the store
	// gives: that is newest registration first, and every REGISTER refresh
	// would move a route to the front, under the round-robin counter or the
	// least-sessions tie turn
	routes = byEndpoint(routes)
	if req.GetBackend().GetAlgorithm() == locationpb.FindRoutesRequest_Backend_LEAST_SESSIONS {
		return leastSessions(routes, l.tieTurn(req))
	}

	ref := backendRef(req)

	l.mu.Lock()
	defer l.mu.Unlock()
	position := l.rr[ref]
	if position >= len(routes) {
		// Routes went away since the last call: start over instead of
		// answering nothing once, as the Node service did
		position = 0
	}
	if position >= len(routes)-1 {
		l.rr[ref] = 0
	} else {
		l.rr[ref] = position + 1
	}
	return routes[position]
}

// byEndpoint is a copy of routes in a fixed order, by user, host and port
// (the binding key's parts), so a round-robin position means the same route
// from one lookup to the next.
func byEndpoint(routes []*locationpb.Route) []*locationpb.Route {
	ordered := slices.Clone(routes)
	slices.SortFunc(ordered, func(a, b *locationpb.Route) int {
		return strings.Compare(bindingKey("", a), bindingKey("", b))
	})
	return ordered
}

// backendRef is what a backend's choices are counted under: its reference, the
// AOR when the request names none.
func backendRef(req *locationpb.FindRoutesRequest) string {
	if ref := req.GetBackend().GetRef(); ref != "" {
		return ref
	}
	return req.GetAor()
}

// tieTurn is the next turn of a tie among the backend's routes.
func (l *Location) tieTurn(req *locationpb.FindRoutesRequest) func() int {
	return func() int {
		ref := backendRef(req)
		l.mu.Lock()
		defer l.mu.Unlock()
		turn := l.tied[ref]
		l.tied[ref] = (turn + 1) & math.MaxInt32
		return turn
	}
}

// nextWithAffinity keeps a session on the route it first got, stored under
// the session's reference for as long as that route's registration; a new
// session gets the route with the fewest sessions (affinity has no
// round-robin).
func (l *Location) nextWithAffinity(ctx context.Context, routes []*locationpb.Route, req *locationpb.FindRoutesRequest) (*locationpb.Route, error) {
	ref := req.GetSessionAffinityRef()
	pinned, err := l.store.Get(ctx, Key{Base: ref})
	if err != nil {
		return nil, errStore("get", err)
	}
	if len(pinned) > 0 {
		return pinned[0], nil
	}
	route := leastSessions(byEndpoint(routes), l.tieTurn(req))
	if err := l.store.Put(ctx, Key{Base: ref}, route); err != nil {
		return nil, errStore("put", err)
	}
	return route, nil
}

// pin keeps a call on its route. A store with no room for the pin leaves the call
// routed and unpinned: a retried INVITE may then land elsewhere, which beats
// refusing the call. It counts and logs.
func (l *Location) pin(ctx context.Context, key Key, route *locationpb.Route) error {
	err := l.store.Put(ctx, key, l.forThisCall(route))
	if errors.Is(err, ErrPinsFull) {
		if n := l.pinsRefused.Add(1); n%pinsRefusedLogEvery == 1 {
			l.log.Warn("location limit reached: a call goes unpinned", "limit", "call_pins", "count", n)
		}
		return nil
	}
	if err != nil {
		return errStore("put", err)
	}
	return nil
}

// PinsRefused is how many calls went unpinned for lack of room since the start.
func (l *Location) PinsRefused() uint64 { return l.pinsRefused.Load() }

// forThisCall is the copy of a route a call is pinned to: registered now,
// for CallRouteTTL.
func (l *Location) forThisCall(route *locationpb.Route) *locationpb.Route {
	pin := proto.Clone(route).(*locationpb.Route)
	pin.RegisteredOn = l.now().UnixMilli()
	pin.Expires = int32(CallRouteTTL / time.Second)
	return pin
}
