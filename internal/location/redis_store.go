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
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/redisx"
	"github.com/redis/go-redis/v9"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	// redisIndexPrefix names the index keys. Nothing but a JSON route may
	// match "<key>:*", or a Routr 2 pod's GET would answer WRONGTYPE, so the
	// indexes live outside every key's prefix.
	redisIndexPrefix = "routr:loc:idx:"
	// redisScanCount is the COUNT of the scans Delete and the backfill run.
	redisScanCount = 1000
	// backfillRerunDelay is when the backfill runs once more, for the bindings
	// Routr 2 pods wrote while a rolling update was finishing.
	backfillRerunDelay = 5 * time.Minute
	// startupPingTimeout bounds how long a Redis that isn't up yet can hold
	// Location before it serves: past its liveness probe, the pod is killed.
	startupPingTimeout = 2 * time.Second
)

// The binding JSON of Routr 2: JSON.stringify of a route as its gRPC loader
// decodes it (mods/common/src/service.ts): camelCase names, int64 as a string,
// enums by name, every default present. protojson spells it the same.
var (
	routeMarshal   = protojson.MarshalOptions{EmitUnpopulated: true}
	routeUnmarshal = protojson.UnmarshalOptions{DiscardUnknown: true}
)

var (
	_ Store        = (*RedisStore)(nil)
	_ ContactStore = (*RedisStore)(nil)
)

// RedisStore is the Store of Locations that share their bindings. A rollout
// mixes it with Routr 2 pods on one Redis, so the bindings stay as Routr 2
// writes them (mods/location/src/redis_store.ts): the string
// "<key>:<user><host><port>" holds the route's JSON for its expires. Beside
// them, the layout of #511: the sorted set "routr:loc:idx:<key>" lists a key's
// bindings, scored by when they expire, so Put and Get never scan. A binding's
// own TTL says if it is live; the score only drives cleanup.
//
// Unlike the memory store, a binding is told apart by user, host and port, and
// Get answers by binding key name, not newest first (#511). Delete and the
// backfill are the only scans, as #511 specifies: neither runs per message.
type RedisStore struct {
	client *redis.Client
	log    *slog.Logger

	cancel    context.CancelFunc
	done      chan struct{}
	closeOnce sync.Once
	closeErr  error
}

// NewRedisStore opens the store of a parameters string, indexes the bindings
// already in Redis and schedules the backfill's second run; Close stops it. A
// Redis that can't be reached is logged, not refused: Location starts anyway,
// without waiting for it, and its calls answer UNAVAILABLE until Redis is back.
func NewRedisStore(parameters string, log *slog.Logger) (*RedisStore, error) {
	client, err := redisx.Open(parameters)
	if err != nil {
		return nil, fmt.Errorf("spec.cache.parameters: %w", err)
	}
	s := newRedisStore(client, log)
	ctx, cancel := context.WithTimeout(context.Background(), startupPingTimeout)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Error("unable to index the bindings in redis at startup", "error", err)
	} else {
		s.runBackfill(context.Background())
	}
	s.scheduleBackfill(backfillRerunDelay)
	return s, nil
}

// newRedisStore wraps a client, with no backfill.
func newRedisStore(client *redis.Client, log *slog.Logger) *RedisStore {
	return &RedisStore{client: client, log: log}
}

// bindingKey is the key Routr 2 stores a route under.
func bindingKey(key string, route *locationpb.Route) string {
	return key + ":" + route.GetUser() + route.GetHost() + route.GetPort()
}

// indexKey is the sorted set listing the bindings of a key.
func indexKey(key string) string {
	return redisIndexPrefix + key
}

// Put implements Store. A route with no expires left removes its binding
// (RFC 3261 section 10.3, step 7). It is one round trip.
func (s *RedisStore) Put(ctx context.Context, key Key, route *locationpb.Route) error {
	_, err := s.put(ctx, key, route, noContactLimit)
	return err
}

// PutContact implements ContactStore: the check and the write are one Lua
// script (see putScript).
func (s *RedisStore) PutContact(ctx context.Context, key Key, route *locationpb.Route, maxContacts int32) (bool, error) {
	return s.put(ctx, key, route, maxContacts)
}

func (s *RedisStore) put(ctx context.Context, key Key, route *locationpb.Route, maxContacts int32) (bool, error) {
	if route == nil {
		return false, errors.New("route is nil")
	}
	value, err := routeMarshal.Marshal(route)
	if err != nil {
		return false, fmt.Errorf("encoding the route: %w", err)
	}
	k := key.String()
	done, err := putScript.Run(ctx, s.client, []string{bindingKey(k, route), indexKey(k)},
		value, route.GetExpires(), maxContacts, route.GetTransport().String()).Int()
	if err != nil {
		return false, err
	}
	return done == 1, nil
}

// Get implements Store: the live routes put under exactly this key, newest
// registration first as the memory store returns them (#576; #511 had them by
// binding key name, which could put a stale contact ahead of the one a phone
// just registered), in at most two commands. It writes nothing. The range
// uses this pod's clock, because a script here would be a write path; clock
// skew only shifts when a member leaves the range, by as much as the skew.
func (s *RedisStore) Get(ctx context.Context, key Key) ([]*locationpb.Route, error) {
	// Latest expiry first: the order among routes registered in the same
	// millisecond, and of a binding another writer stored with no registeredOn
	members, err := s.client.ZRevRangeByScore(ctx, indexKey(key.String()), &redis.ZRangeBy{
		Min: strconv.FormatInt(time.Now().UnixMilli(), 10),
		Max: "+inf",
	}).Result()
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, nil
	}
	values, err := s.client.MGet(ctx, members...).Result()
	if err != nil {
		return nil, err
	}
	routes := make([]*locationpb.Route, 0, len(values))
	for i, value := range values {
		text, ok := value.(string)
		if !ok {
			continue // expired since the range was read
		}
		route := &locationpb.Route{}
		if err := routeUnmarshal.Unmarshal([]byte(text), route); err != nil {
			s.log.Warn("skipping a binding that isn't a route", "key", members[i], "error", err)
			continue
		}
		routes = append(routes, route)
	}
	slices.SortStableFunc(routes, func(a, b *locationpb.Route) int {
		return cmp.Compare(b.GetRegisteredOn(), a.GetRegisteredOn())
	})
	return routes, nil
}

// Delete implements Store: the bindings under base, its per-call entries and
// the indexes of both. Routr 2's pods write entries no index lists, so this is
// the scan #511 keeps; RemoveRoutes is an operator's call, never a message's.
func (s *RedisStore) Delete(ctx context.Context, base string) error {
	pattern := escapeGlob(base) + ":*"
	if err := s.deleteMatching(ctx, pattern); err != nil {
		return err
	}
	if err := s.deleteMatching(ctx, redisIndexPrefix+pattern); err != nil {
		return err
	}
	return s.client.Del(ctx, indexKey(base)).Err()
}

func (s *RedisStore) deleteMatching(ctx context.Context, pattern string) error {
	var cursor uint64
	for {
		keys, next, err := s.client.Scan(ctx, cursor, pattern, redisScanCount).Result()
		if err != nil {
			return err
		}
		if len(keys) > 0 {
			if err := s.client.Del(ctx, keys...).Err(); err != nil {
				return err
			}
		}
		if next == 0 {
			return nil
		}
		cursor = next
	}
}

var globEscaper = strings.NewReplacer(`\`, `\\`, `*`, `\*`, `?`, `\?`, `[`, `\[`, `]`, `\]`)

// escapeGlob quotes what SCAN MATCH would read as a pattern, so an AOR with a
// "*" deletes its own bindings and no others. The Node store did not.
func escapeGlob(s string) string {
	return globEscaper.Replace(s)
}

// backfill indexes the bindings the old layout left in Redis (#511). It reads
// the strings of the whole keyspace, once at start and once more later, and
// leaves every other key untouched. It answers how many it indexed.
func (s *RedisStore) backfill(ctx context.Context) (int, error) {
	if err := indexScript.Load(ctx, s.client).Err(); err != nil {
		return 0, err
	}
	var cursor uint64
	indexed := 0
	for {
		keys, next, err := s.client.ScanType(ctx, cursor, "*", redisScanCount, "string").Result()
		if err != nil {
			return indexed, err
		}
		n, err := s.indexBatch(ctx, keys)
		indexed += n
		if err != nil {
			return indexed, err
		}
		if next == 0 {
			return indexed, nil
		}
		cursor = next
	}
}

// indexBatch indexes the bindings among the keys of one scan.
func (s *RedisStore) indexBatch(ctx context.Context, keys []string) (int, error) {
	if len(keys) == 0 {
		return 0, nil
	}
	values, err := s.client.MGet(ctx, keys...).Result()
	if err != nil {
		return 0, err
	}
	indexed := 0
	_, err = s.client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for i, value := range values {
			text, ok := value.(string)
			if !ok {
				continue
			}
			if storeKey, ok := storeKeyOf(keys[i], text); ok {
				indexScript.EvalSha(ctx, pipe, []string{keys[i], indexKey(storeKey)})
				indexed++
			}
		}
		return nil
	})
	return indexed, err
}

// storeKeyOf says which store key a string key is a binding of: its value must
// parse as a route and its name end in ":<user><host><port>" of that route.
func storeKeyOf(name, value string) (string, bool) {
	route := &locationpb.Route{}
	if err := routeUnmarshal.Unmarshal([]byte(value), route); err != nil || route.GetHost() == "" {
		return "", false
	}
	suffix := ":" + route.GetUser() + route.GetHost() + route.GetPort()
	storeKey, found := strings.CutSuffix(name, suffix)
	if !found || storeKey == "" {
		return "", false
	}
	return storeKey, true
}

// runBackfill runs the backfill and logs how it went: its failure stops nothing.
func (s *RedisStore) runBackfill(ctx context.Context) {
	indexed, err := s.backfill(ctx)
	if err != nil {
		if ctx.Err() == nil {
			s.log.Error("unable to index the bindings in redis", "indexed", indexed, "error", err)
		}
		return
	}
	s.log.Info("indexed the bindings in redis", "indexed", indexed)
}

// scheduleBackfill runs the backfill once more after the delay. Close stops it.
func (s *RedisStore) scheduleBackfill(delay time.Duration) {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.done = make(chan struct{})
	go func() {
		defer close(s.done)
		timer := time.NewTimer(delay)
		defer timer.Stop()
		select {
		case <-ctx.Done():
		case <-timer.C:
			s.runBackfill(ctx)
		}
	}()
}

// Close stops the scheduled backfill, waits for it and closes the client. It
// is safe to call twice.
func (s *RedisStore) Close() error {
	s.closeOnce.Do(func() {
		if s.cancel != nil {
			s.cancel()
			<-s.done
		}
		s.closeErr = s.client.Close()
	})
	return s.closeErr
}
