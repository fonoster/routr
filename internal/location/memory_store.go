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

package location

import (
	"context"
	"errors"
	"sync"
	"time"

	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"google.golang.org/protobuf/proto"
)

// DefaultSweepInterval is how often the memory store's sweeper drops expired
// routes when the owner does not say otherwise.
const DefaultSweepInterval = time.Second

// MemoryStore is the in-memory Store (mods/location/src/memory_store.ts):
// the store of RoutrOne and of a single Location instance.
//
// Every operation is O(1) in the size of the store: a collection is found by
// its key, the per-call collections of an AOR are indexed under it so Delete
// never scans, and expiry is a bucket per second that an owned sweeper
// empties as the clock reaches it. The Node store scanned every collection
// once every 10,000 reads instead.
type MemoryStore struct {
	mu sync.Mutex

	// key -> its routes, newest first
	entries map[string]*collection
	// base key -> the keys scoped under it ("<base>:<suffix>")
	children map[string]map[string]struct{}
	// the second a route expires in -> the routes expiring then
	buckets map[int64][]expiry
	// the last second the sweeper has emptied
	swept int64
	// how many per-call collections there are, and how many there may be
	pins    int
	maxPins int

	now func() time.Time

	stopOnce sync.Once
	stop     chan struct{}
	done     chan struct{}
}

type collection struct {
	base   string
	routes []*locationpb.Route
}

type expiry struct {
	key   string
	route *locationpb.Route
}

// MemoryOption configures a MemoryStore.
type MemoryOption func(*memoryOptions)

type memoryOptions struct {
	now      func() time.Time
	interval time.Duration
	maxPins  int
}

// DefaultMaxCallPins bounds the per-call collections: at CallRouteTTL's 60 s, a
// sustained 16,000 new calls per second.
const DefaultMaxCallPins = 1_000_000

// ErrPinsFull is a per-call pin the store has no room for. The call doesn't
// need it to be routed: it is what keeps a retried INVITE on its first route.
var ErrPinsFull = errors.New("too many per-call routes")

// WithMaxCallPins bounds the per-call collections; zero or less takes
// DefaultMaxCallPins. Past it Put answers ErrPinsFull.
func WithMaxCallPins(n int) MemoryOption {
	return func(o *memoryOptions) { o.maxPins = n }
}

// WithMemoryClock replaces the clock, for tests.
func WithMemoryClock(now func() time.Time) MemoryOption {
	return func(o *memoryOptions) { o.now = now }
}

// WithSweepInterval sets how often the sweeper runs. Zero or less runs no
// sweeper: the owner calls Sweep itself (tests do).
func WithSweepInterval(interval time.Duration) MemoryOption {
	return func(o *memoryOptions) { o.interval = interval }
}

// NewMemoryStore returns an empty store and starts its sweeper; Close stops
// it.
func NewMemoryStore(opts ...MemoryOption) *MemoryStore {
	o := memoryOptions{now: time.Now, interval: DefaultSweepInterval}
	for _, opt := range opts {
		opt(&o)
	}
	if o.maxPins <= 0 {
		o.maxPins = DefaultMaxCallPins
	}
	s := &MemoryStore{
		entries:  map[string]*collection{},
		children: map[string]map[string]struct{}{},
		buckets:  map[int64][]expiry{},
		now:      o.now,
		maxPins:  o.maxPins,
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
	}
	s.swept = s.now().Unix() - 1
	if o.interval > 0 {
		go s.run(o.interval)
	} else {
		close(s.done)
	}
	return s
}

// Put implements Store. A route that is already expired (expires 0, the
// unregistration of RFC 3261 section 10.3) replaces nothing and drops the
// binding it names. The route is copied, so the caller may reuse its message.
func (s *MemoryStore) Put(_ context.Context, key Key, route *locationpb.Route) error {
	if route == nil {
		return errors.New("route is nil")
	}
	now := s.now()
	k := key.String()

	s.mu.Lock()
	defer s.mu.Unlock()

	existing := s.entries[k]
	if key.Suffix != "" && existing == nil && s.pins >= s.maxPins && isLive(route, now) {
		return ErrPinsFull
	}

	var kept []*locationpb.Route
	if c := existing; c != nil {
		kept = make([]*locationpb.Route, 0, len(c.routes)+1)
		for _, r := range c.routes {
			if isLive(r, now) && !sameEndpoint(r, route) {
				kept = append(kept, r)
			}
		}
	}

	if isLive(route, now) {
		stored := proto.Clone(route).(*locationpb.Route)
		kept = append([]*locationpb.Route{stored}, kept...)
		sec := bucketOf(stored)
		s.buckets[sec] = append(s.buckets[sec], expiry{key: k, route: stored})
	}

	if len(kept) == 0 {
		s.remove(k, key.Base)
		return nil
	}
	s.entries[k] = &collection{base: key.Base, routes: kept}
	if key.Suffix != "" {
		if existing == nil {
			s.pins++
		}
		if s.children[key.Base] == nil {
			s.children[key.Base] = map[string]struct{}{}
		}
		s.children[key.Base][k] = struct{}{}
	}
	return nil
}

// Get implements Store: the live routes under the key, newest first.
func (s *MemoryStore) Get(_ context.Context, key Key) ([]*locationpb.Route, error) {
	now := s.now()
	s.mu.Lock()
	defer s.mu.Unlock()
	c := s.entries[key.String()]
	if c == nil {
		return nil, nil
	}
	live := make([]*locationpb.Route, 0, len(c.routes))
	for _, r := range c.routes {
		if isLive(r, now) {
			live = append(live, r)
		}
	}
	return live, nil
}

// Delete implements Store: the base key and every key scoped under it.
func (s *MemoryStore) Delete(_ context.Context, base string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, base)
	for k := range s.children[base] {
		if _, ok := s.entries[k]; ok {
			s.pins--
		}
		delete(s.entries, k)
	}
	delete(s.children, base)
	return nil
}

// Close stops the sweeper and waits for it. It is safe to call twice.
func (s *MemoryStore) Close() error {
	s.stopOnce.Do(func() { close(s.stop) })
	<-s.done
	return nil
}

// Len is the number of collections held, expired ones included until the
// sweeper reaches them.
func (s *MemoryStore) Len() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.entries)
}

// Sweep drops the routes that expired at or before now. The sweeper calls it
// every interval; it only visits the seconds since its last visit, so the
// work is proportional to what expired, never to the store.
func (s *MemoryStore) Sweep(now time.Time) {
	nowSec := now.Unix()
	s.mu.Lock()
	defer s.mu.Unlock()
	if nowSec <= s.swept {
		return
	}
	if nowSec-s.swept > int64(len(s.buckets)) {
		// The clock jumped further than there are buckets: visit the buckets
		for sec := range s.buckets {
			if sec <= nowSec {
				s.expire(sec, now)
			}
		}
	} else {
		for sec := s.swept + 1; sec <= nowSec; sec++ {
			s.expire(sec, now)
		}
	}
	s.swept = nowSec
}

// expire empties one bucket, keeping the routes of each collection it names
// that are still live (a route re-registered since it was bucketed is live
// under a newer deadline).
func (s *MemoryStore) expire(sec int64, now time.Time) {
	bucket, ok := s.buckets[sec]
	if !ok {
		return
	}
	delete(s.buckets, sec)
	for _, e := range bucket {
		c := s.entries[e.key]
		if c == nil {
			continue
		}
		live := c.routes[:0:0]
		for _, r := range c.routes {
			if isLive(r, now) {
				live = append(live, r)
			}
		}
		if len(live) == 0 {
			s.remove(e.key, c.base)
			continue
		}
		c.routes = live
	}
}

// remove drops one collection and its index entry. The caller holds the lock.
func (s *MemoryStore) remove(k, base string) {
	_, held := s.entries[k]
	delete(s.entries, k)
	if k == base {
		return
	}
	if held {
		s.pins--
	}
	delete(s.children[base], k)
	if len(s.children[base]) == 0 {
		delete(s.children, base)
	}
}

func (s *MemoryStore) run(interval time.Duration) {
	defer close(s.done)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			s.Sweep(s.now())
		}
	}
}

// bucketOf is the first whole second at which the route is expired.
func bucketOf(r *locationpb.Route) int64 {
	ms := deadline(r).UnixMilli()
	return (ms + 999) / 1000
}
