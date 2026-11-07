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
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/fonoster/routr/internal/common/redisx"
	"github.com/redis/go-redis/v9"
)

const (
	// redisKeyPrefix is the prefix of Routr 2's entries.
	redisKeyPrefix = "registry:"
	// redisScanCount is the COUNT of List's scan.
	redisScanCount = 1000
)

// redisStore is the Store of mods/registry/src/redis_store.ts: an entry is the
// string "registry:<trunk>" holding its JSON, with the retention time as its
// TTL, so a rollout shares entries with Routr 2's pods. The TTL alone says if
// an entry is live, as in Routr 2. List scans those keys once per round, never
// per message.
type redisStore struct {
	client *redis.Client
	log    *slog.Logger
}

// newRedisStore opens the store of a parameters string.
func newRedisStore(parameters string, log *slog.Logger) (*redisStore, error) {
	client, err := redisx.Open(parameters)
	if err != nil {
		return nil, fmt.Errorf("spec.cache.parameters: %w", err)
	}
	return &redisStore{client: client, log: log}, nil
}

// retentionTTL is the TTL of a retention time. Redis keeps no key for a TTL
// under a millisecond, and retention may be negative: the entry is then
// already due.
func retentionTTL(seconds float64) (time.Duration, bool) {
	ttl := time.Duration(seconds * float64(time.Second))
	return ttl, ttl >= time.Millisecond
}

// Put implements Store. An entry already due replaces what the key held by
// removing it; Routr 2 sent Redis an EX it refuses, leaving the old entry.
func (s *redisStore) Put(ctx context.Context, key string, entry Entry) error {
	ttl, live := retentionTTL(entry.RetentionTimeInSeconds)
	if !live {
		return s.Delete(ctx, key)
	}
	value, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("encoding the entry: %w", err)
	}
	return s.client.Set(ctx, redisKeyPrefix+key, value, ttl).Err()
}

// Get implements Store.
func (s *redisStore) Get(ctx context.Context, key string) (Entry, bool, error) {
	value, err := s.client.Get(ctx, redisKeyPrefix+key).Bytes()
	if errors.Is(err, redis.Nil) {
		return Entry{}, false, nil
	}
	if err != nil {
		return Entry{}, false, err
	}
	var entry Entry
	if err := json.Unmarshal(value, &entry); err != nil {
		return Entry{}, false, fmt.Errorf("decoding entry %s: %w", key, err)
	}
	return entry, true, nil
}

// Delete implements Store. (The Node store called a method its client doesn't
// have.)
func (s *redisStore) Delete(ctx context.Context, key string) error {
	return s.client.Del(ctx, redisKeyPrefix+key).Err()
}

// List implements Store. SCAN may answer a key twice; it is listed once. An
// entry that doesn't parse is skipped, so one bad key stops no round.
func (s *redisStore) List(ctx context.Context) ([]Entry, error) {
	seen := map[string]struct{}{}
	entries := []Entry{}
	var cursor uint64
	for {
		keys, next, err := s.client.Scan(ctx, cursor, redisKeyPrefix+"*", redisScanCount).Result()
		if err != nil {
			return nil, err
		}
		fresh := keys[:0:0]
		for _, key := range keys {
			if _, ok := seen[key]; !ok {
				seen[key] = struct{}{}
				fresh = append(fresh, key)
			}
		}
		if len(fresh) > 0 {
			values, err := s.client.MGet(ctx, fresh...).Result()
			if err != nil {
				return nil, err
			}
			for i, value := range values {
				text, ok := value.(string)
				if !ok {
					continue // expired since the scan
				}
				var entry Entry
				if err := json.Unmarshal([]byte(text), &entry); err != nil {
					s.log.Warn("skipping an entry that doesn't parse", "key", fresh[i], "error", err)
					continue
				}
				entries = append(entries, entry)
			}
		}
		if next == 0 {
			return entries, nil
		}
		cursor = next
	}
}

// Close closes the client.
func (s *redisStore) Close() error {
	return s.client.Close()
}
