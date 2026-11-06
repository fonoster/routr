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
}

type cacheEntry struct {
	value     any
	expiresAt time.Time
}

type cacheLoad struct {
	done  chan struct{}
	value any
	err   error
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
	}, nil
}

// GetOrLoad returns the answer kept for kind, field and value, or loads it
// with load, keeps it (for NegativeTTL when isEmpty says so) and returns it.
// Concurrent callers of one key share one load; a failed load is returned
// to all of them and not kept.
func (c *FindCache) GetOrLoad(kind data.Kind, field, value string, load func() (any, error), isEmpty func(any) bool) (any, error) {
	key := field + "|" + value
	full := string(kind) + "|" + key

	c.mu.Lock()
	if entry, ok := c.entries[kind][key]; ok && entry.expiresAt.After(c.opts.Now()) {
		c.mu.Unlock()
		return entry.value, nil
	}
	if pending, ok := c.inflight[full]; ok {
		c.mu.Unlock()
		<-pending.done
		return pending.value, pending.err
	}
	pending := &cacheLoad{done: make(chan struct{})}
	c.inflight[full] = pending
	startedAt := c.generation
	c.mu.Unlock()

	// A load that panics must not leave the waiters hanging
	defer func() {
		c.mu.Lock()
		delete(c.inflight, full)
		if pending.err == nil && startedAt == c.generation {
			c.store(kind, key, pending.value, isEmpty(pending.value))
		}
		c.mu.Unlock()
		close(pending.done)
	}()
	pending.value, pending.err = load()
	return pending.value, pending.err
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
	byKind[key] = cacheEntry{value: value, expiresAt: now.Add(time.Duration(float64(ttl) * spread))}
	if !replacing {
		c.size++
	}
}

// sweep drops every expired entry; it runs only when the cache is full.
func (c *FindCache) sweep(now time.Time) {
	for kind, byKind := range c.entries {
		for key, entry := range byKind {
			if !entry.expiresAt.After(now) {
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
