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
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	locationpb "github.com/fonoster/routr/internal/common/pb/location"
)

// The cases of mods/location/test/utils.unit.test.ts.

func TestIsLive(t *testing.T) {
	now := time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)
	old := simpleRoute01(now)
	old.RegisteredOn = 1647038272294
	fresh := simpleRoute01(now)
	atTheEdge := simpleRoute01(now.Add(-600 * time.Second))
	unregistered := simpleRoute01(now)
	unregistered.Expires = 0

	cases := []struct {
		name  string
		route *locationpb.Route
		want  bool
	}{
		{"registered in 2022", old, false},
		{"registered now", fresh, true},
		{"expires this instant", atTheEdge, false},
		{"expires zero", unregistered, false},
		{"nil", nil, false},
		{"never registered", &locationpb.Route{Expires: 600}, false},
	}
	for _, c := range cases {
		if got := isLive(c.route, now); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestSameEndpointAndContact(t *testing.T) {
	now := time.Now()
	base := simpleRoute01(now)
	base.Host, base.Port = "sip.local", "5060"
	same := simpleRoute01(now)
	same.Host, same.Port = "sip.local", "5060"
	otherPort := simpleRoute01(now)
	otherPort.Host, otherPort.Port = "sip.local", "5061"
	otherTransport := simpleRoute01(now)
	otherTransport.Host, otherTransport.Port, otherTransport.Transport = "sip.local", "5060", common.Transport_UDP
	otherUser := simpleRoute01(now)
	otherUser.Host, otherUser.Port, otherUser.User = "sip.local", "5060", "1002"

	cases := []struct {
		name         string
		other        *locationpb.Route
		wantEndpoint bool
		wantContact  bool
	}{
		{name: "same", other: same, wantEndpoint: true, wantContact: true},
		{name: "another port", other: otherPort},
		{name: "another transport", other: otherTransport},
		{name: "another user", other: otherUser, wantEndpoint: true},
	}
	for _, c := range cases {
		if got := sameEndpoint(base, c.other); got != c.wantEndpoint {
			t.Errorf("sameEndpoint %s: got %v, want %v", c.name, got, c.wantEndpoint)
		}
		if got := sameContact(base, c.other); got != c.wantContact {
			t.Errorf("sameContact %s: got %v, want %v", c.name, got, c.wantContact)
		}
	}
}

func TestLabelsKey(t *testing.T) {
	cases := []struct {
		name   string
		labels map[string]string
		want   string
	}{
		{"none", nil, ""},
		{"empty", map[string]string{}, ""},
		{"one", map[string]string{"priority": "1"}, "priority=1"},
		{"sorted by key", map[string]string{"region": "us-east01", "priority": "2"}, "priority=2;region=us-east01"},
	}
	for _, c := range cases {
		if got := labelsKey(c.labels); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestMatchesLabels(t *testing.T) {
	now := time.Now()
	labeled := voiceBackendRoute01(now) // region=us-east01
	unlabeled := voiceBackendRoute02(now)
	cases := []struct {
		name      string
		requested map[string]string
		route     *locationpb.Route
		want      bool
	}{
		{"exact", map[string]string{"region": "us-east01"}, labeled, true},
		{"another value", map[string]string{"region": "us-west01"}, unlabeled, false},
		{"more labels than the route", map[string]string{"region": "us-east01", "priority": "1"}, labeled, false},
		{"route without labels", map[string]string{"region": "us-east01"}, unlabeled, false},
		{"no labels requested, route without labels", map[string]string{}, unlabeled, false},
	}
	for _, c := range cases {
		if got := matchesLabels(c.requested, c.route); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}

	got := withLabels([]*locationpb.Route{unlabeled, labeled}, map[string]string{"region": "us-east01"})
	if len(got) != 1 || got[0] != labeled {
		t.Fatalf("withLabels: expected the labeled route, got %v", got)
	}
}

func TestLeastSessions(t *testing.T) {
	now := time.Now()
	if got := leastSessions(nil, nil); got != nil {
		t.Fatalf("expected nil for no routes, got %v", got)
	}
	tie1 := voiceBackendRoute01(now)
	tie2 := voiceBackendRoute02(now)
	tie2.SessionCount = tie1.SessionCount
	routes := []*locationpb.Route{voiceBackendRoute04(now), tie1, tie2, voiceBackendRoute03(now)}
	if got := leastSessions(routes, nil); got != tie1 {
		t.Fatalf("expected the first of the tied routes, got %v", got)
	}
	turns := 0
	turn := func() int {
		turns++
		return turns - 1
	}
	for _, want := range []*locationpb.Route{tie1, tie2, tie1} {
		if got := leastSessions(routes, turn); got != want {
			t.Fatalf("turn %d: expected %v, got %v", turns, want, got)
		}
	}
	routes = append(routes, voiceBackendRoute05(now))
	used := turns
	if got := leastSessions(routes, turn); got.GetUser() != "voice05" {
		t.Fatalf("expected voice05, got %v", got)
	}
	if turns != used {
		t.Error("a call with no tie takes no turn")
	}
}

func TestBucketOf(t *testing.T) {
	cases := []struct {
		registeredOn int64
		expires      int32
		want         int64
	}{
		{1_000_000, 10, 1_010}, // on the second
		{1_000_001, 10, 1_011}, // one millisecond in: the next second
		{1_000_999, 10, 1_011}, // nearly the next second
		{1_000_000, 0, 1_000},  // expires zero
	}
	for _, c := range cases {
		r := &locationpb.Route{RegisteredOn: c.registeredOn, Expires: c.expires}
		if got := bucketOf(r); got != c.want {
			t.Errorf("registered %d expires %d: got %d, want %d", c.registeredOn, c.expires, got, c.want)
		}
	}
}
