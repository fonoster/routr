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
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// The cases of mods/location/test/redis_store.int.test.ts and the acceptance
// criteria of #511. The ones that need Redis skip without TEST_REDIS_URL.

// commandCounter counts the commands a client sends, so a test sees its own
// and not those of other packages sharing the Redis.
type commandCounter struct {
	mu     sync.Mutex
	counts map[string]int
}

func (c *commandCounter) DialHook(next redis.DialHook) redis.DialHook { return next }

func (c *commandCounter) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		c.mu.Lock()
		c.counts[cmd.Name()]++
		c.mu.Unlock()
		return next(ctx, cmd)
	}
}

func (c *commandCounter) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}

func (c *commandCounter) reset() {
	c.mu.Lock()
	c.counts = map[string]int{}
	c.mu.Unlock()
}

func (c *commandCounter) count(name string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.counts[name]
}

func redisTestClient(t *testing.T) *redis.Client {
	t.Helper()
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		t.Skip("TEST_REDIS_URL is not set")
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	return redis.NewClient(opts)
}

func newRedisTestStore(t *testing.T) *RedisStore {
	t.Helper()
	store := newRedisStore(redisTestClient(t), slog.New(slog.DiscardHandler))
	t.Cleanup(func() { _ = store.Close() })
	return store
}

// testAOR is an AOR no other run uses, whose keys go away with the test.
func testAOR(t *testing.T, store *RedisStore) string {
	t.Helper()
	aor := fmt.Sprintf("sip:%d@redis.test", rand.Int64())
	t.Cleanup(func() { _ = store.Delete(context.Background(), aor) })
	return aor
}

func redisPut(t *testing.T, s *RedisStore, key string, route *locationpb.Route) {
	t.Helper()
	if err := s.Put(context.Background(), Key{Base: key}, route); err != nil {
		t.Fatalf("Put(%s): %v", key, err)
	}
}

func redisGet(t *testing.T, s *RedisStore, key string) []*locationpb.Route {
	t.Helper()
	routes, err := s.Get(context.Background(), Key{Base: key})
	if err != nil {
		t.Fatalf("Get(%s): %v", key, err)
	}
	return routes
}

func redisBackfill(t *testing.T, s *RedisStore) {
	t.Helper()
	if _, err := s.backfill(context.Background()); err != nil {
		t.Fatalf("backfill: %v", err)
	}
}

func routeWithExpires(user, port string, expires int32) *locationpb.Route {
	route := exampleRoute(user, "127.0.0.1", port, common.Transport_TCP, 0, time.Now())
	route.Expires = expires
	return route
}

func TestRouteJSONIsRoutr2s(t *testing.T) {
	route := exampleRoute("1001", "127.0.0.1", "6060", common.Transport_TCP, 0, time.UnixMilli(1762000000000))
	value, err := routeMarshal.Marshal(route)
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(value, &got); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"user": "1001", "port": "6060", "transport": "TCP", "registeredOn": "1762000000000",
		"expires": float64(600), "sessionCount": float64(0), "edgePortRef": "edgeport-01",
	}
	for name, value := range want {
		if got[name] != value {
			t.Errorf("%s: got %v, want %v", name, got[name], value)
		}
	}
	for _, name := range []string{"advertisedHost", "listeningPoints", "localnets", "externalAddrs", "labels"} {
		if _, ok := got[name]; !ok {
			t.Errorf("%s is missing: Routr 2 writes every default", name)
		}
	}
}

func TestRouteJSONReadsRoutr2s(t *testing.T) {
	value := `{"user":"1001","host":"127.0.0.1","port":"6060","advertisedHost":"127.0.0.1","advertisedPort":"6060",` +
		`"transport":"TCP","registeredOn":"1762000000000","expires":600,"sessionCount":0,"edgePortRef":"edgeport-01",` +
		`"listeningPoints":[{"name":"","host":"proxy","port":5060,"transport":"TCP"}],"localnets":[],"externalAddrs":[],` +
		`"labels":{"priority":"1"},"addedLater":true}`
	route := &locationpb.Route{}
	if err := routeUnmarshal.Unmarshal([]byte(value), route); err != nil {
		t.Fatal(err)
	}
	if route.GetRegisteredOn() != 1762000000000 || route.GetTransport() != common.Transport_TCP ||
		route.GetLabels()["priority"] != "1" || route.GetListeningPoints()[0].GetPort() != 5060 {
		t.Fatalf("got %v", route)
	}
}

func TestBindingAndIndexKeys(t *testing.T) {
	route := exampleRoute("1001", "127.0.0.1", "6060", common.Transport_TCP, 0, time.Now())
	if got := bindingKey("sip:1001@d.local:call-01", route); got != "sip:1001@d.local:call-01:1001127.0.0.16060" {
		t.Errorf("binding: %s", got)
	}
	if got := indexKey("sip:1001@d.local"); got != "routr:loc:idx:sip:1001@d.local" {
		t.Errorf("index: %s", got)
	}
}

func TestEscapeGlob(t *testing.T) {
	if got := escapeGlob(`sip:*?[a]\@d`); got != `sip:\*\?\[a\]\\@d` {
		t.Errorf("got %s", got)
	}
}

func TestStoreKeyOf(t *testing.T) {
	binding := `{"user":"1001","host":"127.0.0.1","port":"6060"}`
	cases := []struct {
		name, value, want string
		ok                bool
	}{
		{"sip:1001@d.local:1001127.0.0.16060", binding, "sip:1001@d.local", true},
		{"sip:1001@d.local:c1:1001127.0.0.16060", binding, "sip:1001@d.local:c1", true},
		{"sip:1001@d.local:other", binding, "", false},
		{":1001127.0.0.16060", binding, "", false},
		{"registry:trunk-01", `{"trunkRef":"trunk-01","status":"registered"}`, "", false},
		{"some-key", "not json", "", false},
		{"some-key", "42", "", false},
	}
	for _, c := range cases {
		got, ok := storeKeyOf(c.name, c.value)
		if got != c.want || ok != c.ok {
			t.Errorf("%s: got %q %v", c.name, got, ok)
		}
	}
}

// contactStoreFake answers PutContact as it is told and fails anything else.
type contactStoreFake struct {
	*MemoryStore
	added bool
	err   error
	max   int32
}

func (f *contactStoreFake) PutContact(_ context.Context, _ Key, _ *locationpb.Route, maxContacts int32) (bool, error) {
	f.max = maxContacts
	return f.added, f.err
}

func TestAddRouteLeavesTheCheckToAContactStore(t *testing.T) {
	memory := NewMemoryStore(WithSweepInterval(0))
	t.Cleanup(func() { _ = memory.Close() })
	req := &locationpb.AddRouteRequest{Aor: "sip:1001@d.local", Route: routeWithExpires("1001", "6060", 600), MaxContacts: 2}

	store := &contactStoreFake{MemoryStore: memory, added: true}
	if _, err := New(store).AddRoute(context.Background(), req); err != nil || store.max != 2 {
		t.Fatalf("added: %v, max %d", err, store.max)
	}

	store = &contactStoreFake{MemoryStore: memory}
	_, err := New(store).AddRoute(context.Background(), req)
	if status.Code(err) != codes.InvalidArgument || !strings.Contains(err.Error(), "exceeds maximum of 2 allowed contacts") {
		t.Fatalf("refused: %v", err)
	}

	store = &contactStoreFake{MemoryStore: memory, err: errors.New("down")}
	if _, err := New(store).AddRoute(context.Background(), req); status.Code(err) != codes.Unavailable {
		t.Fatalf("failed: %v", err)
	}
}

func TestRedisStorePutRejectsNil(t *testing.T) {
	store := newRedisStore(redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"}), slog.New(slog.DiscardHandler))
	t.Cleanup(func() { _ = store.Close() })
	if err := store.Put(context.Background(), Key{Base: "k"}, nil); err == nil {
		t.Fatal("expected an error for a nil route")
	}
}

func TestRedisStorePutsInACollection(t *testing.T) {
	store := newRedisTestStore(t)
	voice, conference := testAOR(t, store), testAOR(t, store)
	now := time.Now()
	redisPut(t, store, voice, voiceBackendRoute01(now))
	redisPut(t, store, voice, voiceBackendRoute02(now))
	redisPut(t, store, voice, voiceBackendRoute02(now))
	redisPut(t, store, conference, conferenceBackendRoute01(now))
	redisPut(t, store, conference, conferenceBackendRoute01(now))

	got := redisGet(t, store, voice)
	users := map[string]bool{}
	for _, route := range got {
		users[route.GetUser()] = true
	}
	if len(got) != 2 || !users["voice01"] || !users["voice02"] {
		t.Fatalf("voice: %v", got)
	}
	if got := redisGet(t, store, conference); len(got) != 1 {
		t.Fatalf("conference: %v", got)
	}
}

func TestRedisStoreGetNeverScans(t *testing.T) {
	store := newRedisTestStore(t)
	counter := &commandCounter{counts: map[string]int{}}
	store.client.AddHook(counter)
	ctx := context.Background()
	aor := testAOR(t, store)

	prefix := fmt.Sprintf("unrelated:%d:", time.Now().UnixNano())
	_, err := store.client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for i := range 2000 {
			pipe.Set(ctx, prefix+fmt.Sprint(i), "x", time.Minute)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	redisPut(t, store, aor, routeWithExpires("1001", "6060", 600))

	counter.reset()
	if got := redisGet(t, store, aor); len(got) != 1 {
		t.Fatalf("got %v", got)
	}
	if counter.count("scan") != 0 || counter.count("mget") != 1 {
		t.Fatalf("scan %d, mget %d", counter.count("scan"), counter.count("mget"))
	}

	counter.reset()
	if got := redisGet(t, store, aor+":unknown"); got != nil {
		t.Fatalf("expected nothing for an unknown key, got %v", got)
	}
	if counter.count("mget") != 0 {
		t.Fatalf("mget on an unknown key: %d", counter.count("mget"))
	}
}

func TestRedisStorePerCallCopiesAreNotBindings(t *testing.T) {
	store := newRedisTestStore(t)
	aor := testAOR(t, store)
	l := New(store)
	addRoute(t, l, aor, routeWithExpires("1001", "6060", 600), 2)
	for _, callID := range []string{"c1", "c2", "c3"} {
		findRoutes(t, l, &locationpb.FindRoutesRequest{Aor: aor, CallId: callID})
	}
	if got := redisGet(t, store, aor); len(got) != 1 {
		t.Fatalf("expected the binding alone, got %v", got)
	}
	addRoute(t, l, aor, routeWithExpires("1001", "6061", 600), 2)
}

func TestRedisStoreEachBindingKeepsItsExpiry(t *testing.T) {
	store := newRedisTestStore(t)
	aor := testAOR(t, store)
	short, long := routeWithExpires("a", "6060", 1), routeWithExpires("b", "6061", 600)
	redisPut(t, store, aor, short)
	redisPut(t, store, aor, long)

	time.Sleep(1200 * time.Millisecond)
	got := redisGet(t, store, aor)
	if len(got) != 1 || got[0].GetUser() != "b" {
		t.Fatalf("expected b alone, got %v", got)
	}
	if ttl := store.client.PTTL(context.Background(), indexKey(aor)).Val(); ttl <= 0 {
		t.Fatalf("index pttl: %v", ttl)
	}

	short.Expires = 600
	redisPut(t, store, aor, short)
	if got := redisGet(t, store, aor); len(got) != 2 {
		t.Fatalf("expected the expired binding back, got %v", got)
	}
}

func TestRedisStoreExpiresZeroRemoves(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	aor := testAOR(t, store)
	gone, kept := routeWithExpires("a", "6060", 600), routeWithExpires("b", "6061", 600)
	redisPut(t, store, aor, gone)
	redisPut(t, store, aor, kept)

	gone.Expires = 0
	redisPut(t, store, aor, gone)

	key := bindingKey(aor, gone)
	if n := store.client.Exists(ctx, key).Val(); n != 0 {
		t.Fatal("the binding is still there")
	}
	if err := store.client.ZScore(ctx, indexKey(aor), key).Err(); !errors.Is(err, redis.Nil) {
		t.Fatalf("the index still lists it: %v", err)
	}
	if got := redisGet(t, store, aor); len(got) != 1 || got[0].GetUser() != "b" {
		t.Fatalf("expected b alone, got %v", got)
	}
}

func TestRedisStoreRoundRobinSurvivesAReRegister(t *testing.T) {
	store := newRedisTestStore(t)
	aor := testAOR(t, store)
	l := New(store)
	first, second := routeWithExpires("a", "6060", 600), routeWithExpires("b", "6061", 600)
	addRoute(t, l, aor, first, -1)
	addRoute(t, l, aor, second, -1)

	backend := &locationpb.FindRoutesRequest_Backend{Ref: aor}
	one := findRoutes(t, l, &locationpb.FindRoutesRequest{Aor: aor, CallId: "c1", Backend: backend})
	addRoute(t, l, aor, first, -1)
	two := findRoutes(t, l, &locationpb.FindRoutesRequest{Aor: aor, CallId: "c2", Backend: backend})
	if one[0].GetUser() == two[0].GetUser() {
		t.Fatalf("both picks went to %s", one[0].GetUser())
	}
}

func TestRedisStoreDelete(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	aor := testAOR(t, store)
	route := routeWithExpires("1001", "6060", 600)
	redisPut(t, store, aor, route)
	redisPut(t, store, aor+":c1", route)
	redisPut(t, store, aor+":c2:priority=1", route)

	if err := store.Delete(ctx, aor); err != nil {
		t.Fatal(err)
	}
	if got := redisGet(t, store, aor); got != nil {
		t.Fatalf("aor: %v", got)
	}
	if got := redisGet(t, store, aor+":c1"); got != nil {
		t.Fatalf("call: %v", got)
	}
	left, err := store.client.Keys(ctx, escapeGlob(indexKey(aor))+"*").Result()
	if err != nil || len(left) != 0 {
		t.Fatalf("index keys left: %v %v", left, err)
	}
	if err := store.Delete(ctx, "sip:unknown@redis.test"); err != nil {
		t.Fatalf("deleting an unknown key: %v", err)
	}
}

func TestRedisStoreRoutr2PodsCanStillRead(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	aor := testAOR(t, store)
	redisPut(t, store, aor, routeWithExpires("1001", "6060", 600))
	redisPut(t, store, aor+":c1", routeWithExpires("1001", "6060", 60))

	// What an old pod's get does: SCAN MATCH <aor>:*, then a GET on each
	iter := store.client.Scan(ctx, 0, escapeGlob(aor)+":*", 1000).Iterator()
	seen := 0
	for iter.Next(ctx) {
		value, err := store.client.Get(ctx, iter.Val()).Result()
		if err != nil {
			t.Fatalf("GET %s: %v", iter.Val(), err)
		}
		if err := routeUnmarshal.Unmarshal([]byte(value), &locationpb.Route{}); err != nil {
			t.Fatalf("%s: %v", iter.Val(), err)
		}
		seen++
	}
	if err := iter.Err(); err != nil {
		t.Fatal(err)
	}
	if seen != 2 {
		t.Fatalf("expected 2 keys, saw %d", seen)
	}
}

// oldLayoutPut writes a binding as a Routr 2 pod does: the string, no index.
func oldLayoutPut(t *testing.T, s *RedisStore, key string, route *locationpb.Route) string {
	t.Helper()
	value, err := routeMarshal.Marshal(route)
	if err != nil {
		t.Fatal(err)
	}
	name := bindingKey(key, route)
	if err := s.client.Set(context.Background(), name, value, 600*time.Second).Err(); err != nil {
		t.Fatal(err)
	}
	return name
}

func TestRedisStoreBackfill(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	aor := testAOR(t, store)
	route := routeWithExpires("1001", "6060", 600)
	binding := oldLayoutPut(t, store, aor, route)
	oldLayoutPut(t, store, aor+":c1", route)

	other := fmt.Sprintf("unrelated:%d", time.Now().UnixNano())
	if err := store.client.Set(ctx, other, "not a route", time.Minute).Err(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.client.Del(context.Background(), other).Err() })

	redisBackfill(t, store)

	if got := redisGet(t, store, aor); len(got) != 1 {
		t.Fatalf("aor: %v", got)
	}
	if got := redisGet(t, store, aor+":c1"); len(got) != 1 {
		t.Fatalf("call: %v", got)
	}
	indexTTL, keyTTL := store.client.PTTL(ctx, indexKey(aor)).Val(), store.client.PTTL(ctx, binding).Val()
	if diff := (indexTTL - keyTTL).Abs(); diff > time.Second {
		t.Fatalf("index pttl %v, key pttl %v", indexTTL, keyTTL)
	}
	if got := store.client.Get(ctx, other).Val(); got != "not a route" {
		t.Fatalf("the other key changed: %q", got)
	}

	// A binding written after the first run is indexed by the second, and a
	// third changes nothing
	oldLayoutPut(t, store, aor, routeWithExpires("1001", "6061", 600))
	redisBackfill(t, store)
	if got := redisGet(t, store, aor); len(got) != 2 {
		t.Fatalf("second run: %v", got)
	}
	redisBackfill(t, store)
	if got := redisGet(t, store, aor); len(got) != 2 {
		t.Fatalf("third run: %v", got)
	}
}

func TestRedisStoreMaxContactsAcrossReplicas(t *testing.T) {
	first := newRedisTestStore(t)
	second := newRedisTestStore(t)
	aor := testAOR(t, first)
	replicas := []*Location{New(first), New(second)}

	const contacts, maxContacts = 32, 3
	var added atomic.Int32
	var refused atomic.Int32
	var wg sync.WaitGroup
	for i := range contacts {
		wg.Go(func() {
			req := &locationpb.AddRouteRequest{Aor: aor, Route: routeWithExpires("1001", fmt.Sprint(6000+i), 600), MaxContacts: maxContacts}
			_, err := replicas[i%len(replicas)].AddRoute(context.Background(), req)
			switch status.Code(err) {
			case codes.OK:
				added.Add(1)
			case codes.InvalidArgument:
				refused.Add(1)
			default:
				t.Errorf("AddRoute: %v", err)
			}
		})
	}
	wg.Wait()
	if added.Load() != maxContacts || refused.Load() != contacts-maxContacts {
		t.Fatalf("added %d, refused %d", added.Load(), refused.Load())
	}
}

func TestRedisStoreMaxContactsRefreshAndTransport(t *testing.T) {
	store := newRedisTestStore(t)
	ctx := context.Background()
	aor := testAOR(t, store)
	route := routeWithExpires("1001", "6060", 600)
	if ok, err := store.PutContact(ctx, Key{Base: aor}, route, 1); err != nil || !ok {
		t.Fatalf("first: %v %v", ok, err)
	}
	if ok, err := store.PutContact(ctx, Key{Base: aor}, route, 1); err != nil || !ok {
		t.Fatalf("a refresh never counts: %v %v", ok, err)
	}
	// As in Routr 2's check, the same address over another transport is a new
	// contact
	other := routeWithExpires("1001", "6060", 600)
	other.Transport = common.Transport_UDP
	if ok, err := store.PutContact(ctx, Key{Base: aor}, other, 1); err != nil || ok {
		t.Fatalf("another transport: %v %v", ok, err)
	}
	if ok, err := store.PutContact(ctx, Key{Base: aor}, routeWithExpires("1001", "6061", 600), noContactLimit); err != nil || !ok {
		t.Fatalf("no limit: %v %v", ok, err)
	}
}

func TestRedisStoreCloseStopsTheScheduledBackfill(t *testing.T) {
	store := newRedisStore(redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"}), slog.New(slog.DiscardHandler))
	store.scheduleBackfill(time.Hour)
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatalf("second close: %v", err)
	}
}
