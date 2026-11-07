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
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"google.golang.org/protobuf/proto"
)

// The cases of mods/location/test/memory_store.unit.test.ts, plus the
// sweeper, the per-call index and the copy on Put.

func newTestStore(t *testing.T) (*MemoryStore, *fakeClock) {
	t.Helper()
	clock := newFakeClock()
	store := NewMemoryStore(WithMemoryClock(clock.Now), WithSweepInterval(0))
	t.Cleanup(func() { _ = store.Close() })
	return store, clock
}

func put(t *testing.T, s *MemoryStore, key Key, route *locationpb.Route) {
	t.Helper()
	if err := s.Put(context.Background(), key, route); err != nil {
		t.Fatalf("Put(%s): %v", key, err)
	}
}

func get(t *testing.T, s *MemoryStore, key Key) []*locationpb.Route {
	t.Helper()
	routes, err := s.Get(context.Background(), key)
	if err != nil {
		t.Fatalf("Get(%s): %v", key, err)
	}
	return routes
}

func TestKeyString(t *testing.T) {
	cases := []struct {
		key  Key
		want string
	}{
		{Key{Base: "sip:1001@sip.local"}, "sip:1001@sip.local"},
		{Key{Base: "sip:1001@sip.local", Suffix: "call-01"}, "sip:1001@sip.local:call-01"},
		{Key{Base: "sip:1001@sip.local", Suffix: "call-01:priority=1"}, "sip:1001@sip.local:call-01:priority=1"},
	}
	for _, c := range cases {
		if got := c.key.String(); got != c.want {
			t.Errorf("%+v: got %q, want %q", c.key, got, c.want)
		}
	}
}

func TestMemoryStorePut(t *testing.T) {
	s, clock := newTestStore(t)
	now := clock.Now()
	voice := Key{Base: "sip:voice@sip.local"}
	conference := Key{Base: "sip:conference@sip.local"}
	put(t, s, voice, voiceBackendRoute01(now))
	put(t, s, voice, voiceBackendRoute02(now))
	put(t, s, voice, voiceBackendRoute02(now))
	put(t, s, conference, conferenceBackendRoute01(now))
	put(t, s, conference, conferenceBackendRoute01(now))

	if s.Len() != 2 {
		t.Fatalf("expected 2 collections, got %d", s.Len())
	}
	if got := get(t, s, voice); len(got) != 2 || got[0].GetUser() != "voice02" || got[1].GetUser() != "voice01" {
		t.Fatalf("expected voice02 then voice01, got %v", got)
	}
	if got := get(t, s, conference); len(got) != 1 {
		t.Fatalf("expected one conference route, got %d", len(got))
	}
}

func TestMemoryStoreGetReturnsNewestFirst(t *testing.T) {
	s, clock := newTestStore(t)
	now := clock.Now()
	aor := Key{Base: "sip:1001@sip.local"}
	old := exampleRoute("1001", "10.0.0.1", "5060", common.Transport_UDP, 0, now.Add(-time.Minute))
	old.Expires = 3600
	newer := exampleRoute("1001", "10.0.0.2", "5060", common.Transport_UDP, 0, now)
	newer.Expires = 60
	put(t, s, aor, old)
	put(t, s, aor, newer)
	if got := get(t, s, aor); len(got) != 2 || got[0].GetHost() != "10.0.0.2" || got[1].GetHost() != "10.0.0.1" {
		t.Fatalf("newest registration first: %v", got)
	}
	refreshed := exampleRoute("1001", "10.0.0.1", "5060", common.Transport_UDP, 0, now.Add(time.Second))
	refreshed.Expires = 60
	put(t, s, aor, refreshed)
	if got := get(t, s, aor); len(got) != 2 || got[0].GetHost() != "10.0.0.1" || got[1].GetHost() != "10.0.0.2" {
		t.Fatalf("a refreshed contact is the newest: %v", got)
	}
}

func TestMemoryStorePutRejectsNil(t *testing.T) {
	s, _ := newTestStore(t)
	if err := s.Put(context.Background(), Key{Base: "k"}, nil); err == nil {
		t.Fatal("expected an error for a nil route")
	}
	if s.Len() != 0 {
		t.Fatalf("expected nothing stored, got %d", s.Len())
	}
}

func TestMemoryStorePutCopiesTheRoute(t *testing.T) {
	s, clock := newTestStore(t)
	route := voiceBackendRoute01(clock.Now())
	put(t, s, Key{Base: "sip:voice@sip.local"}, route)
	route.User = "changed"

	got := get(t, s, Key{Base: "sip:voice@sip.local"})
	if got[0].GetUser() != "voice01" {
		t.Fatalf("the store shares the caller's message: got %q", got[0].GetUser())
	}
}

func TestMemoryStoreRefreshReplacesTheSameEndpoint(t *testing.T) {
	s, clock := newTestStore(t)
	key := Key{Base: "sip:voice@sip.local"}
	put(t, s, key, voiceBackendRoute01(clock.Now()))
	clock.Tick(500 * time.Second)
	refreshed := voiceBackendRoute01(clock.Now())
	refreshed.SessionCount = 7
	put(t, s, key, refreshed)

	got := get(t, s, key)
	if len(got) != 1 || got[0].GetSessionCount() != 7 {
		t.Fatalf("expected the refreshed route alone, got %v", got)
	}
	clock.Tick(200 * time.Second)
	if got := get(t, s, key); len(got) != 1 {
		t.Fatalf("expected the refreshed route to outlive the first, got %v", got)
	}
}

func TestMemoryStoreExpiresZeroUnregisters(t *testing.T) {
	s, clock := newTestStore(t)
	key := Key{Base: "sip:voice@sip.local"}
	put(t, s, key, voiceBackendRoute01(clock.Now()))
	put(t, s, key, voiceBackendRoute02(clock.Now()))

	gone := voiceBackendRoute01(clock.Now())
	gone.Expires = 0
	put(t, s, key, gone)

	got := get(t, s, key)
	if len(got) != 1 || got[0].GetUser() != "voice02" {
		t.Fatalf("expected voice01 unregistered, got %v", got)
	}

	gone = voiceBackendRoute02(clock.Now())
	gone.Expires = 0
	put(t, s, key, gone)
	if s.Len() != 0 {
		t.Fatalf("expected the empty collection dropped, got %d", s.Len())
	}
}

func TestMemoryStoreDelete(t *testing.T) {
	s, clock := newTestStore(t)
	now := clock.Now()
	voice := Key{Base: "sip:voice@sip.local"}
	put(t, s, voice, voiceBackendRoute01(now))
	put(t, s, voice, voiceBackendRoute02(now))
	put(t, s, Key{Base: voice.Base, Suffix: "call-01"}, voiceBackendRoute01(now))
	put(t, s, Key{Base: voice.Base, Suffix: "call-02:region=us-east01"}, voiceBackendRoute01(now))
	put(t, s, Key{Base: "sip:other@sip.local"}, voiceBackendRoute01(now))
	put(t, s, Key{Base: "sip:other@sip.local", Suffix: "call-03"}, voiceBackendRoute01(now))

	if err := s.Delete(context.Background(), voice.Base); err != nil {
		t.Fatal(err)
	}

	for _, key := range []Key{voice, {Base: voice.Base, Suffix: "call-01"}, {Base: voice.Base, Suffix: "call-02:region=us-east01"}} {
		if got := get(t, s, key); len(got) != 0 {
			t.Fatalf("expected %s gone, got %v", key, got)
		}
	}
	if s.Len() != 2 {
		t.Fatalf("expected the other AOR and its call kept, got %d collections", s.Len())
	}
	if err := s.Delete(context.Background(), "sip:unknown@sip.local"); err != nil {
		t.Fatalf("deleting an unknown key: %v", err)
	}
}

func TestMemoryStoreGetFiltersExpired(t *testing.T) {
	s, clock := newTestStore(t)
	key := Key{Base: "sip:conference@sip.local"}
	put(t, s, key, conferenceBackendRoute01(clock.Now()))
	put(t, s, key, conferenceWithExpiredRoute())

	if got := get(t, s, key); len(got) != 1 || got[0].GetUser() != "conference01" {
		t.Fatalf("expected the live route alone, got %v", got)
	}
	if got := get(t, s, Key{Base: "sip:unknown@sip.local"}); got != nil {
		t.Fatalf("expected nothing for an unknown key, got %v", got)
	}

	clock.Tick(601 * time.Second)
	if got := get(t, s, key); len(got) != 0 {
		t.Fatalf("expected the registration expired, got %v", got)
	}
}

func TestMemoryStoreSweep(t *testing.T) {
	s, clock := newTestStore(t)
	now := clock.Now()
	voice := Key{Base: "sip:voice@sip.local"}
	put(t, s, voice, voiceBackendRoute01(now))
	short := voiceBackendRoute02(now)
	short.Expires = 10
	put(t, s, voice, short)
	put(t, s, Key{Base: voice.Base, Suffix: "call-01"}, short)
	put(t, s, Key{Base: "sip:conference@sip.local"}, conferenceWithExpiredRoute())

	// The route that expired in 2022 is never stored
	if s.Len() != 2 {
		t.Fatalf("expected 2 collections, got %d", s.Len())
	}

	clock.Tick(10 * time.Second)
	s.Sweep(clock.Now())
	if s.Len() != 1 {
		t.Fatalf("expected the short-lived call dropped and the AOR kept, got %d", s.Len())
	}
	if got := get(t, s, voice); len(got) != 1 || got[0].GetUser() != "voice01" {
		t.Fatalf("expected voice01 kept, got %v", got)
	}
	if len(s.buckets) != 1 {
		t.Fatalf("expected one bucket left (voice01's), got %d", len(s.buckets))
	}

	clock.Tick(590 * time.Second)
	s.Sweep(clock.Now())
	if s.Len() != 0 || len(s.buckets) != 0 || len(s.children) != 0 {
		t.Fatalf("expected an empty store, got %d collections, %d buckets, %d indexes", s.Len(), len(s.buckets), len(s.children))
	}
}

func TestMemoryStoreSweepKeepsRefreshedRoutes(t *testing.T) {
	s, clock := newTestStore(t)
	key := Key{Base: "sip:voice@sip.local"}
	first := voiceBackendRoute01(clock.Now())
	first.Expires = 10
	put(t, s, key, first)
	clock.Tick(5 * time.Second)
	put(t, s, key, voiceBackendRoute01(clock.Now()))

	// The first route's bucket comes due; the refreshed one must survive
	clock.Tick(5 * time.Second)
	s.Sweep(clock.Now())
	if got := get(t, s, key); len(got) != 1 {
		t.Fatalf("expected the refreshed route kept, got %v", got)
	}
}

func TestMemoryStoreSweepAfterAClockJump(t *testing.T) {
	s, clock := newTestStore(t)
	put(t, s, Key{Base: "sip:voice@sip.local"}, voiceBackendRoute01(clock.Now()))
	put(t, s, Key{Base: "sip:other@sip.local"}, voiceBackendRoute01(clock.Now()))

	// Further than there are buckets: the sweeper visits the buckets instead
	clock.Tick(24 * time.Hour)
	s.Sweep(clock.Now())
	if s.Len() != 0 || len(s.buckets) != 0 {
		t.Fatalf("expected an empty store, got %d collections, %d buckets", s.Len(), len(s.buckets))
	}
	// Sweeping the same second again is a no-op
	s.Sweep(clock.Now())
}

func TestMemoryStoreSweeperRunsAndStops(t *testing.T) {
	clock := newFakeClock()
	s := NewMemoryStore(WithMemoryClock(clock.Now), WithSweepInterval(time.Millisecond))
	short := voiceBackendRoute01(clock.Now())
	short.Expires = 1
	put(t, s, Key{Base: "sip:voice@sip.local"}, short)

	clock.Tick(2 * time.Second)
	deadline := time.Now().Add(5 * time.Second)
	for s.Len() != 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if s.Len() != 0 {
		t.Fatal("the sweeper did not drop the expired route")
	}

	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-s.done:
	case <-time.After(time.Second):
		t.Fatal("the sweeper did not stop")
	}
	if err := s.Close(); err != nil {
		t.Fatalf("second Close: %v", err)
	}
}

func TestMemoryStoreGetReturnsTheStoredRoutes(t *testing.T) {
	s, clock := newTestStore(t)
	route := voiceBackendRoute01(clock.Now())
	put(t, s, Key{Base: "sip:voice@sip.local"}, route)
	got := get(t, s, Key{Base: "sip:voice@sip.local"})
	if !proto.Equal(got[0], route) {
		t.Fatalf("expected %v, got %v", route, got[0])
	}
}
