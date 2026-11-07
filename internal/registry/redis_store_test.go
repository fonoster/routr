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
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// The cases of mods/registry/test/redis_store.int.test.ts, plus the retention
// edges. The ones that need Redis skip without TEST_REDIS_URL.

func newRedisTestStore(t *testing.T) *redisStore {
	t.Helper()
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		t.Skip("TEST_REDIS_URL is not set")
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	store := &redisStore{client: redis.NewClient(opts), log: slog.New(slog.DiscardHandler)}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

// testRef is a Trunk name no other run uses, removed when the test ends.
func testRef(t *testing.T, store *redisStore, name string) string {
	t.Helper()
	ref := name + "-" + time.Now().Format("150405.000000000")
	t.Cleanup(func() { _ = store.Delete(context.Background(), ref) })
	return ref
}

func TestRetentionTTL(t *testing.T) {
	cases := []struct {
		seconds float64
		ttl     time.Duration
		live    bool
	}{
		{120, 120 * time.Second, true},
		{0.5, 500 * time.Millisecond, true},
		{0, 0, false},
		{-30, -30 * time.Second, false},
		{0.0001, 100 * time.Microsecond, false},
	}
	for _, c := range cases {
		ttl, live := retentionTTL(c.seconds)
		if ttl != c.ttl || live != c.live {
			t.Errorf("%v: got %v %v", c.seconds, ttl, live)
		}
	}
}

func TestNewStoreRedisFailure(t *testing.T) {
	_, err := newRedisStore("not parameters", slog.New(slog.DiscardHandler))
	if err == nil || !strings.Contains(err.Error(), "spec.cache.parameters") {
		t.Fatalf("expected the parameters refused, got %v", err)
	}
}

func TestRedisStorePutListGet(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	fresh := entryAt(testRef(t, store, "trunk-01"), time.Now(), 120)
	// A very old entry stays until its TTL ends, as in Routr 2
	old := entryAt(testRef(t, store, "tky767x2"), time.UnixMilli(1661701508130), 10)
	old.Status = StatusQuarantine
	for _, entry := range []Entry{fresh, old} {
		if err := store.Put(ctx, entry.TrunkRef, entry); err != nil {
			t.Fatal(err)
		}
	}

	listed, err := store.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]Entry{}
	for _, entry := range listed {
		found[entry.TrunkRef] = entry
	}
	if found[fresh.TrunkRef] != fresh || found[old.TrunkRef] != old {
		t.Errorf("List: %v", listed)
	}
	got, ok, err := store.Get(ctx, fresh.TrunkRef)
	if err != nil || !ok || got.Status != StatusRegistered {
		t.Errorf("Get: %v %v %v", got, ok, err)
	}
	if _, ok, err := store.Get(ctx, testRef(t, store, "missing")); ok || err != nil {
		t.Errorf("Get on a missing key: %v %v", ok, err)
	}
}

func TestRedisStoreKeepsRoutr2Layout(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	entry := entryAt(testRef(t, store, "trunk-02"), time.Now(), 120)
	if err := store.Put(ctx, entry.TrunkRef, entry); err != nil {
		t.Fatal(err)
	}
	value, err := store.client.Get(ctx, "registry:"+entry.TrunkRef).Result()
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{`"trunkRef"`, `"timeOfEntry"`, `"retentionTimeInSeconds"`, `"status":"registered"`} {
		if !strings.Contains(value, name) {
			t.Errorf("%s missing from %s", name, value)
		}
	}
	if ttl := store.client.TTL(ctx, "registry:"+entry.TrunkRef).Val(); ttl <= 0 || ttl > 120*time.Second {
		t.Errorf("ttl: %v", ttl)
	}
}

func TestRedisStoreDueEntryRemovesTheKey(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	ref := testRef(t, store, "trunk-03")
	if err := store.Put(ctx, ref, entryAt(ref, time.Now(), 120)); err != nil {
		t.Fatal(err)
	}
	if err := store.Put(ctx, ref, entryAt(ref, time.Now(), -5)); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := store.Get(ctx, ref); ok || err != nil {
		t.Errorf("expected the entry gone: %v %v", ok, err)
	}
}

func TestRedisStoreDelete(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	ref := testRef(t, store, "trunk-04")
	if err := store.Put(ctx, ref, entryAt(ref, time.Now(), 120)); err != nil {
		t.Fatal(err)
	}
	if err := store.Delete(ctx, ref); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := store.Get(ctx, ref); ok {
		t.Error("the entry is gone")
	}
}

func TestRedisStoreListSkipsWhatDoesNotParse(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	bad := testRef(t, store, "bad")
	if err := store.client.Set(ctx, "registry:"+bad, "not json", time.Minute).Err(); err != nil {
		t.Fatal(err)
	}
	if _, err := store.List(ctx); err != nil {
		t.Fatalf("one bad key stops the round: %v", err)
	}
	if _, _, err := store.Get(ctx, bad); err == nil {
		t.Error("expected Get to say the entry doesn't parse")
	}
}
