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
	"strings"

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

// Store keeps routes by key. It is ILocatorStore of mods/location/src/types.ts;
// the memory store implements it here and a Redis store drops in later.
type Store interface {
	// Put adds a route to a collection, replacing an earlier route with the
	// same host, port and transport; the newest route is first in Get's answer.
	Put(ctx context.Context, key Key, route *locationpb.Route) error
	// Get returns the live routes of a collection, newest first, and nothing
	// for an unknown key.
	Get(ctx context.Context, key Key) ([]*locationpb.Route, error)
	// Delete drops the collection named by base and every collection scoped
	// under it (the per-call entries FindRoutes stored).
	Delete(ctx context.Context, base string) error
	// Close releases what the store owns (the memory store's sweeper, a
	// Redis connection).
	Close() error
}

// Provider is spec.cache.provider.
type Provider string

// The cache providers of the Node schema (mods/location/src/config/schema.ts).
const (
	ProviderMemory Provider = "memory"
	ProviderRedis  Provider = "redis"
)

// OpenStore returns the store spec.cache asks for. Milestone 1 ships the
// memory store; redis is accepted by the schema and refused here with a clear
// error until the Redis store lands (ROUTR3.md § 6, milestone 3).
func OpenStore(cache Cache) (Store, error) {
	switch Provider(strings.ToLower(cache.Provider)) {
	case ProviderMemory, "":
		return NewMemoryStore(), nil
	case ProviderRedis:
		return nil, fmt.Errorf("cache provider redis is not available yet: use memory (the Redis store ships in milestone 3)")
	default:
		return nil, fmt.Errorf("unknown cache provider %q", cache.Provider)
	}
}
