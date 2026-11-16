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
	"testing"
	"time"

	locationpb "github.com/fonoster/routr/internal/common/pb/location"
)

func liveRoute(now time.Time, host string) *locationpb.Route {
	return &locationpb.Route{Host: host, Port: "5060", RegisteredOn: now.UnixMilli(), Expires: 60}
}

func TestMemoryStorePinsAreBounded(t *testing.T) {
	now := time.Unix(1000, 0)
	ctx := context.Background()
	s := NewMemoryStore(WithMemoryClock(func() time.Time { return now }), WithSweepInterval(0), WithMaxCallPins(2))
	defer func() { _ = s.Close() }()

	for _, call := range []string{"c1", "c2"} {
		if err := s.Put(ctx, Key{Base: "a", Suffix: call}, liveRoute(now, "h")); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.Put(ctx, Key{Base: "a", Suffix: "c3"}, liveRoute(now, "h")); !errors.Is(err, ErrPinsFull) {
		t.Fatalf("past the limit: %v", err)
	}
	// A pin already there can be replaced, and a binding is no pin
	if err := s.Put(ctx, Key{Base: "a", Suffix: "c1"}, liveRoute(now, "h2")); err != nil {
		t.Fatal(err)
	}
	if err := s.Put(ctx, Key{Base: "a"}, liveRoute(now, "h")); err != nil {
		t.Fatal(err)
	}

	// Room comes back with expiry
	now = now.Add(2 * time.Minute)
	s.Sweep(now)
	if s.pins != 0 {
		t.Fatalf("%d pins after they all expired", s.pins)
	}
	if err := s.Put(ctx, Key{Base: "a", Suffix: "c3"}, liveRoute(now, "h")); err != nil {
		t.Fatal(err)
	}

	// And with Delete
	if err := s.Delete(ctx, "a"); err != nil {
		t.Fatal(err)
	}
	if s.pins != 0 {
		t.Fatalf("%d pins after Delete", s.pins)
	}
}

// A full pin table costs the call its pin, not its route.
func TestFindRoutesWithNoRoomForThePinStillRoutes(t *testing.T) {
	now := time.Unix(1000, 0)
	ctx := context.Background()
	s := NewMemoryStore(WithMemoryClock(func() time.Time { return now }), WithSweepInterval(0), WithMaxCallPins(1))
	defer func() { _ = s.Close() }()
	l := New(s, WithClock(func() time.Time { return now }))
	if err := s.Put(ctx, Key{Base: "sip:a@b"}, liveRoute(now, "h")); err != nil {
		t.Fatal(err)
	}
	for _, call := range []string{"c1", "c2"} {
		res, err := l.FindRoutes(ctx, &locationpb.FindRoutesRequest{Aor: "sip:a@b", CallId: call})
		if err != nil {
			t.Fatal(err)
		}
		if len(res.GetRoutes()) != 1 {
			t.Fatalf("%s: %d routes", call, len(res.GetRoutes()))
		}
	}
	if l.PinsRefused() != 1 {
		t.Errorf("refused %d", l.PinsRefused())
	}
}
