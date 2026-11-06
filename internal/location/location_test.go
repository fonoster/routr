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
	"errors"
	"fmt"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

// The cases of mods/location/test/location.unit.test.ts and
// call_routes.unit.test.ts, plus the validation failures.

// fakeClock is a clock the tests move by hand.
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func newFakeClock() *fakeClock {
	return &fakeClock{now: time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Tick(d time.Duration) {
	c.mu.Lock()
	c.now = c.now.Add(d)
	c.mu.Unlock()
}

// newTestLocation returns a Location over a memory store without a sweeper,
// both on the same fake clock.
func newTestLocation(t *testing.T) (*Location, *MemoryStore, *fakeClock) {
	t.Helper()
	clock := newFakeClock()
	store := NewMemoryStore(WithMemoryClock(clock.Now), WithSweepInterval(0))
	t.Cleanup(func() { _ = store.Close() })
	return New(store, WithClock(clock.Now)), store, clock
}

func addRoute(t *testing.T, l *Location, aor string, route *locationpb.Route, maxContacts int32) {
	t.Helper()
	if _, err := l.AddRoute(context.Background(), &locationpb.AddRouteRequest{Aor: aor, Route: route, MaxContacts: maxContacts}); err != nil {
		t.Fatalf("AddRoute(%s, %s): %v", aor, route.GetUser(), err)
	}
}

func findRoutes(t *testing.T, l *Location, req *locationpb.FindRoutesRequest) []*locationpb.Route {
	t.Helper()
	res, err := l.FindRoutes(context.Background(), req)
	if err != nil {
		t.Fatalf("FindRoutes(%s, %s): %v", req.GetAor(), req.GetCallId(), err)
	}
	return res.GetRoutes()
}

func assertStatus(t *testing.T, err error, code codes.Code, message string) {
	t.Helper()
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected a gRPC status, got %v", err)
	}
	if st.Code() != code || st.Message() != message {
		t.Fatalf("expected %s %q, got %s %q", code, message, st.Code(), st.Message())
	}
}

func backend(algorithm locationpb.FindRoutesRequest_Backend_Algorithm, affinity bool) *locationpb.FindRoutesRequest_Backend {
	return &locationpb.FindRoutesRequest_Backend{Algorithm: algorithm, WithSessionAffinity: affinity}
}

func TestFindRoutesSimple(t *testing.T) {
	l, _, clock := newTestLocation(t)
	now := clock.Now()
	addRoute(t, l, "sip:1001@sip.local", simpleRoute01(now), -1)
	addRoute(t, l, "sip:1001@sip.local", simpleRoute02(now), -1)

	result1 := findRoutes(t, l, &locationpb.FindRoutesRequest{CallId: "3848276298220188511", Aor: "sip:1001@sip.local"})
	if len(result1) != 2 || result1[0].GetUser() != "1001" {
		t.Fatalf("expected two routes of 1001, got %v", result1)
	}

	result2 := findRoutes(t, l, &locationpb.FindRoutesRequest{
		CallId: "3848276298220188511",
		Aor:    "sip:1001@sip.local",
		Labels: map[string]string{"priority": "1"},
	})
	if len(result2) != 1 || result2[0].GetUser() != "1001" || result2[0].GetPort() != "6060" {
		t.Fatalf("expected the priority 1 route, got %v", result2)
	}

	_, err := l.FindRoutes(context.Background(), &locationpb.FindRoutesRequest{
		CallId: "a-non-existent-call-id",
		Aor:    "sip:1001@sip.local",
		Labels: map[string]string{"priority": "2", "region": "us-east01"},
	})
	assertStatus(t, err, codes.NotFound, "no routes found for aor: sip:1001@sip.local")
}

func TestRemoveRoutesDropsCachedLookups(t *testing.T) {
	l, _, clock := newTestLocation(t)
	now := clock.Now()
	addRoute(t, l, "sip:1001@sip.local", simpleRoute01(now), -1)
	addRoute(t, l, "sip:1002@sip.local", simpleRoute01(now), -1)
	req := &locationpb.FindRoutesRequest{CallId: "3848276298220188511", Aor: "sip:1001@sip.local"}

	if got := findRoutes(t, l, req); len(got) != 1 {
		t.Fatalf("expected one route, got %d", len(got))
	}

	if _, err := l.RemoveRoutes(context.Background(), &locationpb.RemoveRoutesRequest{Aor: "sip:1001@sip.local"}); err != nil {
		t.Fatal(err)
	}

	_, err := l.FindRoutes(context.Background(), req)
	assertStatus(t, err, codes.NotFound, "no routes found for aor: sip:1001@sip.local")
	other := findRoutes(t, l, &locationpb.FindRoutesRequest{CallId: req.CallId, Aor: "sip:1002@sip.local"})
	if len(other) != 1 {
		t.Fatalf("expected 1002 to keep its route, got %d", len(other))
	}
}

func TestFindRoutesLeastSessions(t *testing.T) {
	l, _, clock := newTestLocation(t)
	now := clock.Now()
	const aor = "sip:voice_ls@sip.local"
	for _, r := range []*locationpb.Route{
		voiceBackendRoute01(now), voiceBackendRoute02(now), voiceBackendRoute03(now),
		voiceBackendRoute04(now), voiceBackendRoute05(now),
	} {
		addRoute(t, l, aor, r, -1)
	}

	got := findRoutes(t, l, &locationpb.FindRoutesRequest{
		CallId:  "3848276298220188511",
		Aor:     aor,
		Backend: backend(locationpb.FindRoutesRequest_Backend_LEAST_SESSIONS, true),
	})
	if len(got) != 1 || got[0].GetSessionCount() != 3 {
		t.Fatalf("expected voice05 with 3 sessions, got %v", got)
	}
}

func TestFindRoutesLeastSessionsTiesGoRound(t *testing.T) {
	l, _, clock := newTestLocation(t)
	now := clock.Now()
	const aor = "sip:voice_tie@sip.local"
	first, second := voiceBackendRoute01(now), voiceBackendRoute02(now)
	first.SessionCount, second.SessionCount = 1, 1
	addRoute(t, l, aor, first, -1)
	addRoute(t, l, aor, second, -1)

	hosts := map[string]int{}
	for i := range 4 {
		got := findRoutes(t, l, &locationpb.FindRoutesRequest{
			CallId:  fmt.Sprintf("call-%d", i),
			Aor:     aor,
			Backend: backend(locationpb.FindRoutesRequest_Backend_LEAST_SESSIONS, false),
		})
		if len(got) != 1 {
			t.Fatalf("got %v", got)
		}
		hosts[got[0].GetUser()]++
	}
	if hosts[first.GetUser()] != 2 || hosts[second.GetUser()] != 2 {
		t.Errorf("the tied routes share the calls: %v", hosts)
	}
}

func TestFindRoutesRoundRobin(t *testing.T) {
	l, _, clock := newTestLocation(t)
	now := clock.Now()
	const aor = "sip:voice_rr@sip.local"
	for _, r := range []*locationpb.Route{
		voiceBackendRoute05(now), voiceBackendRoute04(now), voiceBackendRoute03(now),
		voiceBackendRoute02(now), voiceBackendRoute01(now),
	} {
		addRoute(t, l, aor, r, -1)
	}

	cases := []struct{ callID, user string }{
		{"01", "voice01"}, {"02", "voice02"}, {"03", "voice03"}, {"04", "voice04"},
		{"05", "voice05"}, {"06", "voice01"}, {"07", "voice02"},
		// the same call gets the same backend
		{"07", "voice02"},
	}
	for _, c := range cases {
		got := findRoutes(t, l, &locationpb.FindRoutesRequest{
			CallId:  c.callID,
			Aor:     aor,
			Backend: backend(locationpb.FindRoutesRequest_Backend_ROUND_ROBIN, false),
		})
		if len(got) != 1 || got[0].GetUser() != c.user {
			t.Fatalf("call %s: expected %s, got %v", c.callID, c.user, got)
		}
	}
}

func TestFindRoutesRoundRobinAfterRoutesShrink(t *testing.T) {
	l, _, clock := newTestLocation(t)
	now := clock.Now()
	const aor = "sip:voice_rr@sip.local"
	addRoute(t, l, aor, voiceBackendRoute02(now), -1)
	addRoute(t, l, aor, voiceBackendRoute01(now), -1)
	rr := backend(locationpb.FindRoutesRequest_Backend_ROUND_ROBIN, false)

	findRoutes(t, l, &locationpb.FindRoutesRequest{CallId: "01", Aor: aor, Backend: rr})
	// voice01 is at the front; drop it so the counter points past the end
	if _, err := l.RemoveRoutes(context.Background(), &locationpb.RemoveRoutesRequest{Aor: aor}); err != nil {
		t.Fatal(err)
	}
	addRoute(t, l, aor, voiceBackendRoute02(now), -1)

	got := findRoutes(t, l, &locationpb.FindRoutesRequest{CallId: "02", Aor: aor, Backend: rr})
	if len(got) != 1 || got[0].GetUser() != "voice02" {
		t.Fatalf("expected the remaining backend, got %v", got)
	}
}

func TestFindRoutesSessionAffinity(t *testing.T) {
	l, _, clock := newTestLocation(t)
	now := clock.Now()
	const aor = "sip:conference@sip.local"
	addRoute(t, l, aor, conferenceWithExpiredRoute(), -1)
	addRoute(t, l, aor, conferenceBackendRoute02(now), -1)
	addRoute(t, l, aor, conferenceBackendRoute01(now), -1)

	for _, callID := range []string{"3848276298220188511", "any-call-id"} {
		got := findRoutes(t, l, &locationpb.FindRoutesRequest{
			CallId:             callID,
			Aor:                aor,
			SessionAffinityRef: "any-session-affinity-ref",
			Backend:            backend(locationpb.FindRoutesRequest_Backend_LEAST_SESSIONS, true),
		})
		if len(got) != 1 || got[0].GetUser() != "conference01" {
			t.Fatalf("call %s: expected conference01, got %v", callID, got)
		}
	}
}

func TestFindRoutesDeprecatedBackendScheme(t *testing.T) {
	l, _, clock := newTestLocation(t)
	addRoute(t, l, "backend:voice_ls", voiceBackendRoute01(clock.Now()), 1)

	got := findRoutes(t, l, &locationpb.FindRoutesRequest{
		CallId: "3848276298220188511",
		Aor:    "backend:voice_ls",
		Backend: &locationpb.FindRoutesRequest_Backend{
			Ref:                 "voice_ls",
			WithSessionAffinity: true,
			Algorithm:           locationpb.FindRoutesRequest_Backend_LEAST_SESSIONS,
		},
	})
	if len(got) != 1 || got[0].GetUser() != "voice01" {
		t.Fatalf("expected voice01, got %v", got)
	}
}

func TestAddRouteMaxContacts(t *testing.T) {
	type step struct {
		route       func(time.Time) *locationpb.Route
		maxContacts int32
		wantErr     string
	}
	cases := []struct {
		name  string
		steps []step
	}{
		{
			name: "rejects the first new route when maxContacts is zero",
			steps: []step{
				{voiceBackendRoute01, 0, "exceeds maximum of 0 allowed contacts"},
			},
		},
		{
			name: "reached with a different route",
			steps: []step{
				{voiceBackendRoute01, 1, ""},
				{voiceBackendRoute02, 1, "exceeds maximum of 1 allowed contacts"},
			},
		},
		{
			name: "not reached by the same route",
			steps: []step{
				{voiceBackendRoute01, 1, ""},
				{voiceBackendRoute01, 1, ""},
				{voiceBackendRoute02, 1, "exceeds maximum of 1 allowed contacts"},
			},
		},
		{
			name: "combining routes",
			steps: []step{
				{voiceBackendRoute01, 2, ""},
				{voiceBackendRoute01, 2, ""},
				{voiceBackendRoute02, 2, ""},
				{voiceBackendRoute03, 1, "exceeds maximum of 1 allowed contacts"},
			},
		},
		{
			name: "unlimited with -1",
			steps: []step{
				{voiceBackendRoute01, -1, ""},
				{voiceBackendRoute02, -1, ""},
				{voiceBackendRoute03, -1, ""},
			},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			l, _, clock := newTestLocation(t)
			for i, s := range c.steps {
				_, err := l.AddRoute(context.Background(), &locationpb.AddRouteRequest{
					Aor: "sip:voice@sip.local", Route: s.route(clock.Now()), MaxContacts: s.maxContacts,
				})
				if s.wantErr == "" {
					if err != nil {
						t.Fatalf("step %d: %v", i, err)
					}
					continue
				}
				assertStatus(t, err, codes.InvalidArgument, s.wantErr)
			}
		})
	}
}

// TestAddRouteMaxContactsUnderLoad registers distinct contacts of one AOR
// at once with maxContacts 1 over a store whose reads come back late:
// exactly one may win. Without the AOR's lock every registration read the
// empty collection, passed the check and was stored.
func TestAddRouteMaxContactsUnderLoad(t *testing.T) {
	clock := newFakeClock()
	store := NewMemoryStore(WithMemoryClock(clock.Now), WithSweepInterval(0))
	t.Cleanup(func() { _ = store.Close() })
	slow := &slowStore{Store: store, delay: 20 * time.Millisecond}
	l := New(slow, WithClock(clock.Now))

	const registrations = 8
	var (
		wg     sync.WaitGroup
		mu     sync.Mutex
		ok     int
		errors []error
	)
	wg.Add(registrations)
	for i := 0; i < registrations; i++ {
		go func(i int) {
			defer wg.Done()
			route := exampleRoute("voice", "192.168.1."+strconv.Itoa(10+i), "5060", common.Transport_TCP, -1, clock.Now())
			_, err := l.AddRoute(context.Background(), &locationpb.AddRouteRequest{Aor: "sip:voice@sip.local", Route: route, MaxContacts: 1})
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				ok++
			} else {
				errors = append(errors, err)
			}
		}(i)
	}
	wg.Wait()

	if ok != 1 {
		t.Errorf("%d registrations passed the maxContacts check, want 1", ok)
	}
	for _, err := range errors {
		assertStatus(t, err, codes.InvalidArgument, "exceeds maximum of 1 allowed contacts")
	}
	routes, _ := store.Get(context.Background(), Key{Base: "sip:voice@sip.local"})
	if len(routes) != 1 {
		t.Errorf("%d routes stored, want 1", len(routes))
	}
}

func TestAORLock(t *testing.T) {
	l := New(NewMemoryStore(WithSweepInterval(0)))
	if l.aorLock("sip:1001@sip.local") != l.aorLock("sip:1001@sip.local") {
		t.Error("the same AOR must lock the same stripe")
	}
	stripes := map[*sync.Mutex]bool{}
	for i := 0; i < 1000; i++ {
		stripes[l.aorLock("sip:"+strconv.Itoa(i)+"@sip.local")] = true
	}
	if len(stripes) < aorLockStripes/2 {
		t.Errorf("1000 AORs spread over %d stripes, want most of %d", len(stripes), aorLockStripes)
	}
}

// slowStore is a Store whose reads come back delay late, widening the window
// between the check and the put: every registration reads before any writes.
type slowStore struct {
	Store
	delay time.Duration
}

func (s *slowStore) Get(ctx context.Context, key Key) ([]*locationpb.Route, error) {
	routes, err := s.Store.Get(ctx, key)
	time.Sleep(s.delay)
	return routes, err
}

func TestAddRouteValidation(t *testing.T) {
	l, _, clock := newTestLocation(t)
	cases := []struct {
		name    string
		req     *locationpb.AddRouteRequest
		code    codes.Code
		message string
	}{
		{
			name:    "unsupported scheme",
			req:     &locationpb.AddRouteRequest{Aor: "tel:1001", Route: simpleRoute01(clock.Now()), MaxContacts: -1},
			code:    codes.InvalidArgument,
			message: `aor tel:1001 has an invalid schema, only "sip:" or "backend:" are allowed`,
		},
		{
			name:    "empty aor",
			req:     &locationpb.AddRouteRequest{Route: simpleRoute01(clock.Now()), MaxContacts: -1},
			code:    codes.InvalidArgument,
			message: `aor  has an invalid schema, only "sip:" or "backend:" are allowed`,
		},
		{
			name:    "missing route",
			req:     &locationpb.AddRouteRequest{Aor: "sip:1001@sip.local", MaxContacts: -1},
			code:    codes.InvalidArgument,
			message: "route is required",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := l.AddRoute(context.Background(), c.req)
			assertStatus(t, err, c.code, c.message)
		})
	}
}

func TestFindRoutesUnknownAOR(t *testing.T) {
	l, store, _ := newTestLocation(t)
	req := &locationpb.FindRoutesRequest{Aor: "sip:nobody@sip.local", CallId: "call-01"}

	// Used to answer 500: the empty answer was stored under the call
	for i := 0; i < 2; i++ {
		_, err := l.FindRoutes(context.Background(), req)
		assertStatus(t, err, codes.NotFound, "no routes found for aor: sip:nobody@sip.local")
	}
	if store.Len() != 0 {
		t.Fatalf("expected nothing stored, got %d entries", store.Len())
	}
}

func TestFindRoutesPinsTheCallForAWhile(t *testing.T) {
	l, store, clock := newTestLocation(t)
	const aor = "sip:1001@sip.local"
	route := simpleRoute01(clock.Now())
	addRoute(t, l, aor, route, -1)

	got := findRoutes(t, l, &locationpb.FindRoutesRequest{Aor: aor, CallId: "call-01"})
	if !proto.Equal(got[0], route) {
		t.Fatalf("expected the registered route back, got %v", got[0])
	}
	pinned, _ := store.Get(context.Background(), Key{Base: aor, Suffix: "call-01"})
	if len(pinned) != 1 || pinned[0].GetExpires() != 60 || pinned[0].GetRegisteredOn() != clock.Now().UnixMilli() {
		t.Fatalf("expected the call pinned for %s, got %v", CallRouteTTL, pinned)
	}

	clock.Tick(CallRouteTTL + time.Second)

	pinned, _ = store.Get(context.Background(), Key{Base: aor, Suffix: "call-01"})
	if len(pinned) != 0 {
		t.Fatalf("expected the pin gone, got %v", pinned)
	}
	registered, _ := store.Get(context.Background(), Key{Base: aor})
	if len(registered) != 1 {
		t.Fatalf("expected the registration kept, got %v", registered)
	}
}

func TestFindRoutesWithBackendPinsUnderLabels(t *testing.T) {
	l, store, clock := newTestLocation(t)
	const aor = "sip:voice@sip.local"
	addRoute(t, l, aor, voiceBackendRoute01(clock.Now()), -1)

	got := findRoutes(t, l, &locationpb.FindRoutesRequest{
		Aor: aor, CallId: "call-01",
		Labels:  map[string]string{"region": "us-east01"},
		Backend: backend(locationpb.FindRoutesRequest_Backend_ROUND_ROBIN, false),
	})
	if len(got) != 1 || got[0].GetUser() != "voice01" {
		t.Fatalf("expected voice01, got %v", got)
	}
	pinned, _ := store.Get(context.Background(), Key{Base: aor, Suffix: "call-01:region=us-east01"})
	if len(pinned) != 1 {
		t.Fatalf("expected the call pinned under its labels, got %d", store.Len())
	}
}

func TestFindRoutesDoesNotMutateTheRequest(t *testing.T) {
	l, _, clock := newTestLocation(t)
	const aor = "sip:voice@sip.local"
	route := voiceBackendRoute01(clock.Now())
	addRoute(t, l, aor, route, -1)
	before := proto.Clone(route).(*locationpb.Route)

	req := &locationpb.FindRoutesRequest{Aor: aor, CallId: "call-01"}
	want := proto.Clone(req).(*locationpb.FindRoutesRequest)
	findRoutes(t, l, req)

	if !proto.Equal(req, want) {
		t.Fatal("FindRoutes changed its request")
	}
	if !proto.Equal(route, before) {
		t.Fatal("AddRoute changed the route it was given")
	}
}

// failingStore is a Store whose every operation fails.
type failingStore struct{ err error }

func (f failingStore) Put(context.Context, Key, *locationpb.Route) error { return f.err }
func (f failingStore) Get(context.Context, Key) ([]*locationpb.Route, error) {
	return nil, f.err
}
func (f failingStore) Delete(context.Context, string) error { return f.err }
func (f failingStore) Close() error                         { return nil }

func TestStoreFailuresAnswerUnavailable(t *testing.T) {
	l := New(failingStore{err: errors.New("connection refused")})
	ctx := context.Background()

	_, err := l.AddRoute(ctx, &locationpb.AddRouteRequest{Aor: "sip:a@b", Route: &locationpb.Route{}, MaxContacts: -1})
	assertStatus(t, err, codes.Unavailable, "location store get: connection refused")

	_, err = l.FindRoutes(ctx, &locationpb.FindRoutesRequest{Aor: "sip:a@b", CallId: "c"})
	assertStatus(t, err, codes.Unavailable, "location store get: connection refused")

	_, err = l.RemoveRoutes(ctx, &locationpb.RemoveRoutesRequest{Aor: "sip:a@b"})
	assertStatus(t, err, codes.Unavailable, "location store delete: connection refused")
}
