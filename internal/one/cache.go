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

package one

import (
	"context"
	"fmt"
	"math/rand/v2"
	"strconv"
	"sync"
	"time"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"

	"github.com/fonoster/routr/internal/data"
)

// The cache's defaults are Routr 2's (mods/pgdata/src/cache/find_cache.ts
// and create_find_cache.ts on main): Agents, Domains, Numbers, Peers and
// Trunks change rarely and Connect looks them up on every call. 300 s is
// what kept the refills off Node's thread; an empty answer lives less so a
// new resource shows up soon.
const (
	DefaultCacheTTL         = 300 * time.Second
	DefaultCacheNegativeTTL = 60 * time.Second
	DefaultCacheMaxEntries  = 100000
	// DefaultCacheStale is what RoutrOne runs with: an expired answer still
	// serves for this long while one background load refreshes it, so the refill
	// of a popular key costs no call a wait.
	DefaultCacheStale = 60 * time.Second
	// DefaultCacheMaxLoads bounds the loads running at once. A cold cache under a
	// full call rate misses on everything at the same moment: this is what keeps
	// that from becoming as many queries (ROUTR3.md § 2, the collapse measured on
	// Node at 200 calls/s). Far above what a query's latency needs at any rate
	// the rest of the path can reach, and far below a Postgres connection storm.
	DefaultCacheMaxLoads = 32
	// cacheLoadTimeout bounds a load; a load serves everyone waiting on the key,
	// so it can't live and die with the caller that happened to start it.
	cacheLoadTimeout = 10 * time.Second
	// cacheTTLSpread randomizes every expiry by ±20 %, so entries loaded
	// together don't expire together and come back as one burst of queries.
	cacheTTLSpread = 0.2
)

// embeddedBy lists, for each kind, the kinds whose answers embed it: a write
// of that kind drops every entry of those. It follows the mappers'
// includeFields to the end: an Agent carries its Domain's egress Numbers
// with their Trunks.
var embeddedBy = map[data.Kind][]data.Kind{
	data.KindDomain:      {data.KindDomain, data.KindAgent},
	data.KindNumber:      {data.KindNumber, data.KindDomain, data.KindAgent},
	data.KindTrunk:       {data.KindTrunk, data.KindNumber, data.KindAgent},
	data.KindCredentials: {data.KindAgent, data.KindPeer, data.KindTrunk, data.KindNumber},
	data.KindACL:         {data.KindDomain, data.KindAgent, data.KindPeer, data.KindTrunk, data.KindNumber},
}

// CacheOptions tune a FindCache. A zero field takes the default.
type CacheOptions struct {
	// TTL is how long a found answer lives.
	TTL time.Duration
	// NegativeTTL is how long an empty answer lives.
	NegativeTTL time.Duration
	// MaxEntries bounds the entries kept; past it, answers are served but
	// not kept until expired entries make room.
	MaxEntries int
	// Stale is how long an expired found answer still serves while a load in
	// the background refreshes it. Zero is none: every expiry waits for a load.
	// An empty answer is never served stale, and a write drops what it touches
	// whatever its age. A database changed behind the API is seen up to
	// TTL + Stale late.
	Stale time.Duration
	// MaxLoads bounds the loads running at once; past it a caller waits, for
	// as long as its context lets it.
	MaxLoads int
	// Now and Random are the clock and the spread source; time.Now and
	// rand.Float64 when nil. Tests inject them.
	Now    func() time.Time
	Random func() float64
}

func (o CacheOptions) withDefaults() CacheOptions {
	if o.TTL == 0 {
		o.TTL = DefaultCacheTTL
	}
	if o.NegativeTTL == 0 {
		o.NegativeTTL = DefaultCacheNegativeTTL
	}
	if o.MaxEntries == 0 {
		o.MaxEntries = DefaultCacheMaxEntries
	}
	if o.MaxLoads == 0 {
		o.MaxLoads = DefaultCacheMaxLoads
	}
	if o.Now == nil {
		o.Now = time.Now
	}
	if o.Random == nil {
		o.Random = rand.Float64
	}
	return o
}

func (o CacheOptions) validate() error {
	if o.TTL < 0 {
		return fmt.Errorf("cache ttl must be positive, got %s", o.TTL)
	}
	if o.NegativeTTL < 0 {
		return fmt.Errorf("cache negative ttl must be positive, got %s", o.NegativeTTL)
	}
	if o.MaxEntries < 0 {
		return fmt.Errorf("cache max entries must be positive, got %d", o.MaxEntries)
	}
	if o.Stale < 0 {
		return fmt.Errorf("cache stale must be positive, got %s", o.Stale)
	}
	if o.MaxLoads < 0 {
		return fmt.Errorf("cache max loads must be positive, got %d", o.MaxLoads)
	}
	return nil
}

// FindCache keeps FindBy answers in front of the in-process Data API
// (ROUTR3.md § 3.4): an answer is keyed by kind, field and value and served
// from memory until it expires; one load at a time refills a key, and a
// write through the API drops the written row and every kind that embeds it.
//
// What it hands out is shared: a caller reads a cached answer and never
// changes it (§ 3.1, a direct call shares memory where gRPC copied it).
type FindCache struct {
	opts CacheOptions

	mu sync.Mutex
	// entries by kind, then by "field|value", so dropping a kind is one
	// delete, not a scan
	entries map[data.Kind]map[string]cacheEntry
	size    int
	// inflight loads by "kind|field|value"; a second caller waits on the
	// first's result
	inflight map[string]*cacheLoad
	// generation is bumped by every invalidation, so a load that began
	// before one isn't kept
	generation uint64

	// loads holds a slot per load running; refreshes are the background ones,
	// which Close waits for
	loads     chan struct{}
	refreshes sync.WaitGroup
	closed    bool
}

type cacheEntry struct {
	value     any
	expiresAt time.Time
	// staleUntil is how long the entry may still serve while it is refreshed;
	// expiresAt when it may not
	staleUntil time.Time
}

type cacheLoad struct {
	done  chan struct{}
	value any
	err   error
	// gaveUp: the caller that held the load left before a slot came free. Nothing
	// ran, so its waiters try again rather than share its error
	gaveUp bool
}

// NewFindCache builds a cache with the options, defaults filled in.
func NewFindCache(opts CacheOptions) (*FindCache, error) {
	if err := opts.validate(); err != nil {
		return nil, err
	}
	return &FindCache{
		opts:     opts.withDefaults(),
		entries:  map[data.Kind]map[string]cacheEntry{},
		inflight: map[string]*cacheLoad{},
		loads:    make(chan struct{}, opts.withDefaults().MaxLoads),
	}, nil
}

// GetOrLoad is Load with no deadline on the caller's side.
func (c *FindCache) GetOrLoad(kind data.Kind, field, value string, load func() (any, error), isEmpty func(any) bool) (any, error) {
	return c.Load(context.Background(), kind, field, value, func(context.Context) (any, error) { return load() }, isEmpty)
}

// Load returns the answer kept for kind, field and value, or loads it with
// load, keeps it (for NegativeTTL when isEmpty says so) and returns it.
//
// Concurrent callers of one key share one load; a failed load is returned to all
// of them and not kept. The load runs on the context of no caller, under
// cacheLoadTimeout: one caller giving up must not fail the others. A caller
// whose ctx ends stops waiting and gets its error.
//
// An answer past its TTL and within Stale is returned at once, and the first such
// caller starts one background refresh.
func (c *FindCache) Load(ctx context.Context, kind data.Kind, field, value string, load func(context.Context) (any, error), isEmpty func(any) bool) (any, error) {
	key := field + "|" + value
	full := string(kind) + "|" + key

	for {
		c.mu.Lock()
		now := c.opts.Now()
		entry, found := c.entries[kind][key]
		if found && entry.expiresAt.After(now) {
			c.mu.Unlock()
			return entry.value, nil
		}
		pending, loading := c.inflight[full]
		if found && entry.staleUntil.After(now) {
			if !loading {
				c.refreshLocked(ctx, kind, key, full, load, isEmpty)
			}
			c.mu.Unlock()
			return entry.value, nil
		}
		if loading {
			c.mu.Unlock()
			select {
			case <-pending.done:
				if pending.gaveUp {
					// Whoever had the load left before it ran; someone else takes it
					continue
				}
				return pending.value, pending.err
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		pending = &cacheLoad{done: make(chan struct{})}
		c.inflight[full] = pending
		startedAt := c.generation
		c.mu.Unlock()
		return c.loadNow(ctx, kind, key, full, pending, startedAt, load, isEmpty)
	}
}

// loadNow waits for a slot and runs the load the caller just registered.
func (c *FindCache) loadNow(ctx context.Context, kind data.Kind, key, full string, pending *cacheLoad, startedAt uint64, load func(context.Context) (any, error), isEmpty func(any) bool) (any, error) {
	// A load that panics must not leave the waiters hanging
	defer c.finish(kind, key, full, pending, startedAt, isEmpty)
	select {
	case c.loads <- struct{}{}:
		defer func() { <-c.loads }()
	case <-ctx.Done():
		pending.err = ctx.Err()
		pending.gaveUp = true
		return nil, pending.err
	}
	pending.value, pending.err = runLoad(ctx, load)
	return pending.value, pending.err
}

// runLoad runs a load detached from its caller's cancellation, keeping the
// caller's values (a trace, say).
func runLoad(ctx context.Context, load func(context.Context) (any, error)) (any, error) {
	loadCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cacheLoadTimeout)
	defer cancel()
	return load(loadCtx)
}

// finish records a load's result and wakes who waits for it.
func (c *FindCache) finish(kind data.Kind, key, full string, pending *cacheLoad, startedAt uint64, isEmpty func(any) bool) {
	c.mu.Lock()
	delete(c.inflight, full)
	if pending.err == nil && startedAt == c.generation {
		c.store(kind, key, pending.value, isEmpty(pending.value))
	}
	c.mu.Unlock()
	close(pending.done)
}

// refreshLocked starts the background load of a stale key, if a slot is free: no
// slot and the next caller tries again, the stale answer still serves. The
// caller holds mu. The goroutine is the cache's, bounded by the slots and waited
// for by Close.
func (c *FindCache) refreshLocked(ctx context.Context, kind data.Kind, key, full string, load func(context.Context) (any, error), isEmpty func(any) bool) {
	if c.closed {
		return
	}
	select {
	case c.loads <- struct{}{}:
	default:
		return
	}
	pending := &cacheLoad{done: make(chan struct{})}
	c.inflight[full] = pending
	startedAt := c.generation
	c.refreshes.Add(1)
	go func() {
		defer c.refreshes.Done()
		defer func() { <-c.loads }()
		defer c.finish(kind, key, full, pending, startedAt, isEmpty)
		pending.value, pending.err = runLoad(ctx, load)
	}()
}

// Close waits for the background refreshes and starts no more.
func (c *FindCache) Close() {
	c.mu.Lock()
	c.closed = true
	c.mu.Unlock()
	c.refreshes.Wait()
}

// store keeps an answer under the lock. Full of live entries, it serves the
// answer but doesn't keep it.
func (c *FindCache) store(kind data.Kind, key string, value any, empty bool) {
	now := c.opts.Now()
	if c.size >= c.opts.MaxEntries {
		c.sweep(now)
	}
	byKind, ok := c.entries[kind]
	if !ok {
		byKind = map[string]cacheEntry{}
		c.entries[kind] = byKind
	}
	_, replacing := byKind[key]
	if !replacing && c.size >= c.opts.MaxEntries {
		return
	}
	ttl := c.opts.TTL
	if empty {
		ttl = c.opts.NegativeTTL
	}
	spread := 1 - cacheTTLSpread + 2*cacheTTLSpread*c.opts.Random()
	expiresAt := now.Add(time.Duration(float64(ttl) * spread))
	staleUntil := expiresAt
	if !empty {
		staleUntil = expiresAt.Add(c.opts.Stale)
	}
	byKind[key] = cacheEntry{value: value, expiresAt: expiresAt, staleUntil: staleUntil}
	if !replacing {
		c.size++
	}
}

// sweep drops every entry past serving; it runs only when the cache is full.
func (c *FindCache) sweep(now time.Time) {
	for kind, byKind := range c.entries {
		for key, entry := range byKind {
			if !entry.staleUntil.After(now) {
				delete(byKind, key)
				c.size--
			}
		}
		if len(byKind) == 0 {
			delete(c.entries, kind)
		}
	}
}

// Invalidate records a write of a row of kind: the entries keyed by any of
// the row's scalar fields (by their JSON names, as FindBy names them) go,
// and so does every entry of the kinds that embed the row's kind. A load
// that began before the write is not kept.
func (c *FindCache) Invalidate(kind data.Kind, row proto.Message) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.generation++
	if row != nil {
		row.ProtoReflect().Range(func(fd protoreflect.FieldDescriptor, v protoreflect.Value) bool {
			if text, ok := scalarText(fd, v); ok {
				c.drop(kind, fd.JSONName()+"|"+text)
			}
			return true
		})
	}
	for _, embedding := range embeddedBy[kind] {
		c.dropKind(embedding)
	}
}

func (c *FindCache) drop(kind data.Kind, key string) {
	byKind, ok := c.entries[kind]
	if !ok {
		return
	}
	if _, ok := byKind[key]; ok {
		delete(byKind, key)
		c.size--
	}
	if len(byKind) == 0 {
		delete(c.entries, kind)
	}
}

func (c *FindCache) dropKind(kind data.Kind) {
	if byKind, ok := c.entries[kind]; ok {
		c.size -= len(byKind)
		delete(c.entries, kind)
	}
}

// Clear drops every entry; a load in flight is not kept.
func (c *FindCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.generation++
	c.entries = map[data.Kind]map[string]cacheEntry{}
	c.size = 0
}

// Size is how many entries are kept, expired or not.
func (c *FindCache) Size() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.size
}

// scalarText is the FindBy value a scalar field matches: strings as they
// are, numbers and booleans as the Node service received them in
// fieldValue, enums by name. Messages, lists and maps match nothing.
func scalarText(fd protoreflect.FieldDescriptor, v protoreflect.Value) (string, bool) {
	if fd.IsList() || fd.IsMap() {
		return "", false
	}
	switch fd.Kind() {
	case protoreflect.StringKind:
		return v.String(), true
	case protoreflect.BoolKind:
		return strconv.FormatBool(v.Bool()), true
	case protoreflect.Int32Kind, protoreflect.Sint32Kind, protoreflect.Sfixed32Kind,
		protoreflect.Int64Kind, protoreflect.Sint64Kind, protoreflect.Sfixed64Kind:
		return strconv.FormatInt(v.Int(), 10), true
	case protoreflect.Uint32Kind, protoreflect.Fixed32Kind, protoreflect.Uint64Kind, protoreflect.Fixed64Kind:
		return strconv.FormatUint(v.Uint(), 10), true
	case protoreflect.FloatKind, protoreflect.DoubleKind:
		return strconv.FormatFloat(v.Float(), 'f', -1, 64), true
	case protoreflect.EnumKind:
		if ev := fd.Enum().Values().ByNumber(v.Enum()); ev != nil {
			return string(ev.Name()), true
		}
	}
	return "", false
}
