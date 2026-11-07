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

package registry

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/fonoster/routr/internal/common/config"
)

// The cache providers of spec.cache.provider.
const (
	providerMemory = "memory"
	providerRedis  = "redis"
)

// Status is what the last REGISTER of a Trunk came back with.
type Status string

// The statuses of a registration entry, with the values Routr 2 stores.
const (
	StatusRegistered Status = "registered"
	StatusQuarantine Status = "quarantine"
)

// Entry is one Trunk the registry heard back about. The JSON names are Routr
// 2's, for the Redis store to read what a rollout left behind.
type Entry struct {
	TrunkRef string `json:"trunkRef"`
	// TimeOfEntry is when the answer came, in milliseconds since the epoch.
	TimeOfEntry int64 `json:"timeOfEntry"`
	// RetentionTimeInSeconds is how long the entry keeps its Trunk out of the
	// registration round. It may be negative: the Trunk is then due again on
	// the next round.
	RetentionTimeInSeconds float64 `json:"retentionTimeInSeconds"`
	Status                 Status  `json:"status"`
}

// expired says if the entry's retention time has passed at now.
func (e Entry) expired(now time.Time) bool {
	elapsed := now.Sub(time.UnixMilli(e.TimeOfEntry)).Seconds()
	return elapsed > e.RetentionTimeInSeconds
}

// Store holds the Trunks that need no REGISTER for now.
type Store interface {
	Put(ctx context.Context, key string, entry Entry) error
	// Get answers false for a key that is missing or expired.
	Get(ctx context.Context, key string) (Entry, bool, error)
	Delete(ctx context.Context, key string) error
	// List answers the entries that have not expired.
	List(ctx context.Context) ([]Entry, error)
}

// newStore builds the store spec.cache names.
func newStore(cache config.Cache, now func() time.Time, log *slog.Logger) (Store, error) {
	switch cache.Provider {
	case "", providerMemory:
		return newMemoryStore(defaultMaxPutsBeforeCleanup, now), nil
	case providerRedis:
		return newRedisStore(cache.Parameters, log)
	}
	return nil, fmt.Errorf("spec.cache.provider: unknown provider %q", cache.Provider)
}
