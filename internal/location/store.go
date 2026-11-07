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
	"fmt"
	"log/slog"
	"strings"

	"github.com/fonoster/routr/internal/common/config"
	locationpb "github.com/fonoster/routr/internal/common/pb/location"
)

// Key names a collection of routes, the way the Node service names them
// (mods/location/src/location.ts): Base is the AOR a binding was registered
// under (or a session affinity reference), Suffix scopes the collection to one
// call, "<callId>" or "<callId>:<labels>". Its String is the key Routr 2
// writes, "<base>" or "<base>:<suffix>", so a Redis store shares entries with
// a Routr 2 instance during a rollout.
type Key struct {
	Base   string
	Suffix string
}

// String returns the key as the Node service spells it.
func (k Key) String() string {
	if k.Suffix == "" {
		return k.Base
	}
	return k.Base + ":" + k.Suffix
}

// Store keeps routes by key. It is ILocatorStore of mods/location/src/types.ts,
// with a memory store and a Redis store.
type Store interface {
	// Put adds a route to a collection, replacing an earlier route for the
	// same binding: same host, port and transport in memory, same user, host
	// and port in Redis, whose key names Routr 2 wrote.
	Put(ctx context.Context, key Key, route *locationpb.Route) error
	// Get returns the live routes of a collection, and nothing for an unknown
	// key: newest first in memory, by binding key name in Redis.
	Get(ctx context.Context, key Key) ([]*locationpb.Route, error)
	// Delete drops the collection named by base and every collection scoped
	// under it (the per-call entries FindRoutes stored).
	Delete(ctx context.Context, base string) error
	// Close releases what the store owns (the memory store's sweeper, a
	// Redis connection).
	Close() error
}

// ContactStore is a Store replicas share. The check against maxContacts and the
// write it guards have to be one step in the store itself, since a lock in
// this process stops no other replica. AddRoute prefers it to its own lock.
type ContactStore interface {
	// PutContact does what Put does, unless the route is a new contact past
	// maxContacts (-1 for no limit): then it stores nothing and answers false.
	PutContact(ctx context.Context, key Key, route *locationpb.Route, maxContacts int32) (bool, error)
}

// Provider is spec.cache.provider.
type Provider string

// The cache providers of the Node schema (mods/location/src/config/schema.ts).
const (
	ProviderMemory Provider = "memory"
	ProviderRedis  Provider = "redis"
)

// OpenStore is OpenStoreWithLogger logging to the default logger.
func OpenStore(cache config.Cache) (Store, error) {
	return OpenStoreWithLogger(cache, slog.Default())
}

// OpenStoreWithLogger returns the store spec.cache asks for. A Redis store
// indexes the bindings already in Redis before it returns, so a Location that
// serves after this call finds them.
func OpenStoreWithLogger(cache config.Cache, log *slog.Logger) (Store, error) {
	switch Provider(strings.ToLower(cache.Provider)) {
	case ProviderMemory, "":
		return NewMemoryStore(), nil
	case ProviderRedis:
		return NewRedisStore(cache.Parameters, log)
	default:
		return nil, fmt.Errorf("unknown cache provider %q", cache.Provider)
	}
}
