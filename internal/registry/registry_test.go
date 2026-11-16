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
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	requesterpb "github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func testSpec() Spec {
	return Spec{
		RegisterInterval: 20,
		Cache:            config.Cache{Provider: "memory"},
		EdgePorts:        []EdgePort{{Address: "sip01.edgeport.net:5060"}},
		Methods:          []string{"INVITE"},
	}
}

func testRegistry(t *testing.T, spec Spec, client *fakeTrunks, requester *fakeRequester) *Registry {
	t.Helper()
	r, err := New(spec, Dependencies{Requester: requester, Trunks: client}, Options{Logger: slog.New(slog.DiscardHandler), Now: fixedNow})
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestNewFailures(t *testing.T) {
	requester, client := &fakeRequester{}, &fakeTrunks{}
	redis := testSpec()
	redis.Cache.Provider = "redis"
	redis.Cache.Parameters = "not parameters"
	disk := testSpec()
	disk.Cache.Provider = "disk"
	negative := testSpec()
	negative.RegisterInterval = -1
	for name, tc := range map[string]struct {
		spec Spec
		deps Dependencies
		want string
	}{
		"no requester":     {testSpec(), Dependencies{Trunks: client}, "Requester"},
		"no trunks":        {testSpec(), Dependencies{Requester: requester}, "Trunks"},
		"redis":            {redis, Dependencies{Requester: requester, Trunks: client}, "spec.cache.parameters"},
		"unknown provider": {disk, Dependencies{Requester: requester, Trunks: client}, "unknown provider"},
		"negative":         {negative, Dependencies{Requester: requester, Trunks: client}, "registerInterval"},
	} {
		if _, err := New(tc.spec, tc.deps, Options{}); err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestNewDefaults(t *testing.T) {
	r, err := New(Spec{}, Dependencies{Requester: &fakeRequester{}, Trunks: &fakeTrunks{}}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if r.interval != 60*time.Second || r.seconds != 60 {
		t.Errorf("interval: %v", r.interval)
	}
	if _, isMemory := r.store.(*memoryStore); !isMemory {
		t.Errorf("store: %T", r.store)
	}
}

func TestRoundRegistersTheTrunksThatAreDue(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{
		testTrunk("t1", "one.provider.net", 5060),
		testTrunk("t2", "two.provider.net", 5060),
		testTrunk("t3", "three.provider.net", 5060),
	}}
	requester := &fakeRequester{}
	r := testRegistry(t, testSpec(), client, requester)
	ctx := context.Background()
	if err := r.store.Put(ctx, "t3", entryAt("t3", fixedNow(), 120)); err != nil {
		t.Fatal(err)
	}

	r.round(ctx)

	one, two := requester.sentTo("one.provider.net:5060"), requester.sentTo("two.provider.net:5060")
	if len(one) != 1 || len(two) != 1 {
		t.Fatalf("one REGISTER each: %d %d", len(one), len(two))
	}
	if got := len(requester.sentTo("three.provider.net:5060")); got != 0 {
		t.Errorf("a Trunk in the store gets none: %d", got)
	}
	// CSeq follows the order of the Trunks; extension 0 is the Allow
	if got := one[0].GetMessage().GetExtensions()[1].GetValue(); got != "1 REGISTER" {
		t.Errorf("first CSeq: %s", got)
	}
	if got := two[0].GetMessage().GetExtensions()[1].GetValue(); got != "2 REGISTER" {
		t.Errorf("second CSeq: %s", got)
	}

	entry, ok, err := r.store.Get(ctx, "t1")
	if err != nil || !ok {
		t.Fatalf("t1 is stored: %v %v", ok, err)
	}
	want := Entry{TrunkRef: "t1", TimeOfEntry: fixedNow().UnixMilli(), RetentionTimeInSeconds: 3580, Status: StatusRegistered}
	if entry != want {
		t.Errorf("entry: %+v", entry)
	}

	// The next round sends nothing: both are stored now
	r.round(ctx)
	if len(requester.sentTo("one.provider.net:5060")) != 1 || len(requester.sentTo("two.provider.net:5060")) != 1 {
		t.Error("a registered Trunk waits for its entry to expire")
	}
}

// A Contact without expires reads -1, which is not the end of the registration:
// the Trunk waits for what the REGISTER asked for.
func TestRoundWaitsWhenTheContactHasNoExpires(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{testTrunk("t1", "one.provider.net", 5060)}}
	requester := &fakeRequester{answers: map[string]*requesterpb.SendMessageResponse{"one.provider.net:5060": okResponse(-1)}}
	r := testRegistry(t, testSpec(), client, requester)
	r.round(context.Background())
	r.round(context.Background())
	if got := len(requester.sentTo("one.provider.net:5060")); got != 1 {
		t.Errorf("REGISTERs: %d", got)
	}
}

// blockingRequester holds every REGISTER until released.
type blockingRequester struct {
	fakeRequester
	entered chan struct{}
	release chan struct{}
}

func (f *blockingRequester) SendMessage(ctx context.Context, in *requesterpb.SendMessageRequest, opts ...grpc.CallOption) (*requesterpb.SendMessageResponse, error) {
	f.entered <- struct{}{}
	<-f.release
	return f.fakeRequester.SendMessage(ctx, in, opts...)
}

func TestRoundsDontOverlapOnATrunk(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{testTrunk("t1", "one.provider.net", 5060)}}
	requester := &blockingRequester{entered: make(chan struct{}, 2), release: make(chan struct{})}
	r, err := New(testSpec(), Dependencies{Requester: requester, Trunks: client}, Options{Logger: slog.New(slog.DiscardHandler), Now: fixedNow})
	if err != nil {
		t.Fatal(err)
	}
	first := make(chan struct{})
	go func() {
		defer close(first)
		r.round(context.Background())
	}()
	<-requester.entered

	// A round that finds the REGISTER still out sends nothing, and spends no CSeq
	r.round(context.Background())
	select {
	case <-requester.entered:
		t.Fatal("a second REGISTER went out while the first was unanswered")
	default:
	}
	close(requester.release)
	<-first
	if len(r.inFlight) != 0 {
		t.Errorf("in flight: %v", r.inFlight)
	}
	if got := r.builder.takeCSeq(); got != 2 {
		t.Errorf("next CSeq: %d", got)
	}
}

func refusal(rt sipmessage.ResponseType, extensions ...*sipmessage.Extension) *requesterpb.SendMessageResponse {
	return &requesterpb.SendMessageResponse{Message: &sipmessage.SIPMessage{
		MessageType: &sipmessage.SIPMessage_ResponseType{ResponseType: rt},
		Extensions:  extensions,
	}}
}

func TestRoundBacksOffAfterARefusal(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{testTrunk("t1", "one.provider.net", 5060)}}
	requester := &fakeRequester{answers: map[string]*requesterpb.SendMessageResponse{"one.provider.net:5060": refusal(sipmessage.ResponseType_FORBIDDEN)}}
	r := testRegistry(t, testSpec(), client, requester)
	ctx := context.Background()
	r.round(ctx)
	entry, ok, err := r.store.Get(ctx, "t1")
	if err != nil || !ok {
		t.Fatalf("t1 is stored: %v %v", ok, err)
	}
	if entry.Status != StatusQuarantine || entry.RetentionTimeInSeconds != failedRefreshBackoff {
		t.Errorf("entry: %+v", entry)
	}
}

func TestRoundLogsADataAPINotReadyAsAWarning(t *testing.T) {
	for name, tc := range map[string]struct {
		err   error
		level string
		msg   string
	}{
		"unavailable": {status.Error(codes.Unavailable, "Service unavailable"), "level=WARN", "Data API not ready, next round in 20s"},
		"unknown":     {status.Error(codes.Unknown, "Unknown error"), "level=ERROR", "failed to retrieve trunks from API"},
	} {
		var logged bytes.Buffer
		requester := &fakeRequester{}
		r, err := New(testSpec(), Dependencies{Requester: requester, Trunks: &fakeTrunks{err: tc.err}},
			Options{Logger: slog.New(slog.NewTextHandler(&logged, &slog.HandlerOptions{Level: slog.LevelWarn})), Now: fixedNow})
		if err != nil {
			t.Fatal(err)
		}
		r.round(context.Background())
		out := logged.String()
		if strings.Count(out, "\n") != 1 || !strings.Contains(out, tc.level) || !strings.Contains(out, tc.msg) {
			t.Errorf("%s: log = %q, want one %s %q", name, out, tc.level, tc.msg)
		}
	}
}

func TestRoundHonorsMinExpires(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{testTrunk("t1", "one.provider.net", 5060)}}
	requester := &fakeRequester{answers: map[string]*requesterpb.SendMessageResponse{
		"one.provider.net:5060": refusal(sipmessage.ResponseType_INTERVAL_TOO_BRIEF, &sipmessage.Extension{Name: "Min-Expires", Value: "1800"}),
	}}
	r := testRegistry(t, testSpec(), client, requester)
	ctx := context.Background()
	r.round(ctx)
	entry, ok, err := r.store.Get(ctx, "t1")
	if err != nil || !ok {
		t.Fatalf("t1 is stored: %v %v", ok, err)
	}
	if entry.RetentionTimeInSeconds != 0 {
		t.Errorf("a 423 goes out again next round: %+v", entry)
	}
	if err := r.store.Delete(ctx, "t1"); err != nil {
		t.Fatal(err)
	}
	r.round(ctx)
	sent := requester.sentTo("one.provider.net:5060")
	if len(sent) != 2 || sent[0].GetMessage().GetExpires().GetExpires() != defaultExpires || sent[1].GetMessage().GetExpires().GetExpires() != 1800 {
		t.Errorf("REGISTERs: %v", sent)
	}
}

func TestMinExpiresOf(t *testing.T) {
	for value, want := range map[string]int32{"1800": 1800, " 60 ": 60, "soon": 0, "-1": 0} {
		message := &sipmessage.SIPMessage{Extensions: []*sipmessage.Extension{{Name: "min-expires", Value: value}}}
		if got := minExpiresOf(message); got != want {
			t.Errorf("%q: %d", value, got)
		}
	}
	if got := minExpiresOf(&sipmessage.SIPMessage{}); got != 0 {
		t.Errorf("no header: %d", got)
	}
}

func TestRoundStoresNothingWhenARequestFails(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{
		testTrunk("t1", "one.provider.net", 5060),
		testTrunk("t2", "two.provider.net", 5060),
		testTrunk("t3", "three.provider.net", 5060),
	}}
	requester := &fakeRequester{
		errs:    map[string]error{"one.provider.net:5060": status.Error(codes.Unavailable, "no requester")},
		answers: map[string]*requesterpb.SendMessageResponse{"two.provider.net:5060": {}},
	}
	r := testRegistry(t, testSpec(), client, requester)
	ctx := context.Background()
	r.round(ctx)
	if _, ok, _ := r.store.Get(ctx, "t1"); ok {
		t.Error("a failed send stores nothing")
	}
	if _, ok, _ := r.store.Get(ctx, "t2"); ok {
		t.Error("an answer without a message stores nothing")
	}
	if _, ok, _ := r.store.Get(ctx, "t3"); !ok {
		t.Error("the other Trunks go on")
	}
}

func TestRoundSkipsATrunkItCannotBuild(t *testing.T) {
	noURIs := testTrunk("t1", "one.provider.net", 5060)
	noURIs.Uris = nil
	client := &fakeTrunks{items: []*trunks.Trunk{noURIs, testTrunk("t2", "two.provider.net", 5060)}}
	requester := &fakeRequester{}
	r := testRegistry(t, testSpec(), client, requester)
	r.round(context.Background())
	if got := len(requester.sentTo("two.provider.net:5060")); got != 1 {
		t.Errorf("the good Trunk goes out: %d", got)
	}
}

func TestRoundStopsWhenTheAPIFails(t *testing.T) {
	requester := &fakeRequester{}
	r := testRegistry(t, testSpec(), &fakeTrunks{err: errors.New("no API")}, requester)
	r.round(context.Background())
	if len(requester.requests) != 0 {
		t.Errorf("nothing is sent: %v", requester.requests)
	}
}

// failingStore fails its List.
type failingStore struct{ Store }

func (failingStore) List(context.Context) ([]Entry, error) {
	return nil, errors.New("no store")
}

func TestRoundStopsWhenTheStoreFails(t *testing.T) {
	client := &fakeTrunks{items: []*trunks.Trunk{testTrunk("t1", "one.provider.net", 5060)}}
	requester := &fakeRequester{}
	r, err := New(testSpec(), Dependencies{Requester: requester, Trunks: client, Store: failingStore{}}, Options{Logger: slog.New(slog.DiscardHandler)})
	if err != nil {
		t.Fatal(err)
	}
	r.round(context.Background())
	if len(requester.requests) != 0 {
		t.Errorf("nothing is sent: %v", requester.requests)
	}
}

func TestRunRegistersUntilTheContextEnds(t *testing.T) {
	spec := testSpec()
	spec.RegisterInterval = 0.01
	client := &fakeTrunks{items: []*trunks.Trunk{testTrunk("t1", "one.provider.net", 5060)}}
	requester := &fakeRequester{sent: make(chan struct{}, 1)}
	r := testRegistry(t, spec, client, requester)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() {
		defer close(done)
		r.Run(ctx)
	}()

	select {
	case <-requester.sent:
	case <-time.After(5 * time.Second):
		t.Fatal("no REGISTER went out")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return after the context ended")
	}
}

func TestRetentionSeconds(t *testing.T) {
	for name, tc := range map[string]struct {
		message *sipmessage.SIPMessage
		want    float64
	}{
		"contact wins":    {&sipmessage.SIPMessage{Contact: &sipmessage.Contact{Expires: 3600}, Expires: &sipmessage.Expires{Expires: 300}}, 3580},
		"contact without": {&sipmessage.SIPMessage{Contact: &sipmessage.Contact{Expires: -1}, Expires: &sipmessage.Expires{Expires: 300}}, 280},
		"contact nothing": {&sipmessage.SIPMessage{Contact: &sipmessage.Contact{Expires: -1}}, 580},
		"contact of zero": {&sipmessage.SIPMessage{Contact: &sipmessage.Contact{}}, -20},
		"expires header":  {&sipmessage.SIPMessage{Expires: &sipmessage.Expires{Expires: 300}}, 280},
		"neither is 600":  {&sipmessage.SIPMessage{}, 580},
	} {
		if got := retentionSeconds(tc.message, 20); got != tc.want {
			t.Errorf("%s: %v", name, got)
		}
	}
}

func TestStatusOf(t *testing.T) {
	response := func(rt sipmessage.ResponseType) *sipmessage.SIPMessage {
		return &sipmessage.SIPMessage{MessageType: &sipmessage.SIPMessage_ResponseType{ResponseType: rt}}
	}
	if got := statusOf(response(sipmessage.ResponseType_OK)); got != StatusRegistered {
		t.Errorf("200: %s", got)
	}
	for _, rt := range []sipmessage.ResponseType{sipmessage.ResponseType_UNAUTHORIZED, sipmessage.ResponseType_REQUEST_TIMEOUT, sipmessage.ResponseType_ACCEPTED} {
		if got := statusOf(response(rt)); got != StatusQuarantine {
			t.Errorf("%v: %s", rt, got)
		}
	}
}
