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

package one

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"google.golang.org/protobuf/reflect/protoreflect"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/data"
)

// fakeClock is a clock tests advance by hand.
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

// newTestCache builds a cache on a fake clock with no spread (random 0.5
// is a factor of exactly 1), the defaults otherwise.
func newTestCache(t *testing.T, opts CacheOptions) (*FindCache, *fakeClock) {
	t.Helper()
	clock := &fakeClock{now: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	if opts.Now == nil {
		opts.Now = clock.Now
	}
	if opts.Random == nil {
		opts.Random = func() float64 { return 0.5 }
	}
	c, err := NewFindCache(opts)
	if err != nil {
		t.Fatal(err)
	}
	return c, clock
}

// counting is a load that counts its calls and answers value.
func counting(calls *int32, value any) func() (any, error) {
	return func() (any, error) {
		atomic.AddInt32(calls, 1)
		return value, nil
	}
}

func notEmpty(any) bool { return false }
func empty(any) bool    { return true }

func TestNewFindCacheRejectsNegativeOptions(t *testing.T) {
	for name, opts := range map[string]CacheOptions{
		"ttl":          {TTL: -time.Second},
		"negative ttl": {NegativeTTL: -time.Second},
		"max entries":  {MaxEntries: -1},
	} {
		if _, err := NewFindCache(opts); err == nil {
			t.Errorf("%s: no error", name)
		}
	}
	c, err := NewFindCache(CacheOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if c.opts.TTL != DefaultCacheTTL || c.opts.NegativeTTL != DefaultCacheNegativeTTL || c.opts.MaxEntries != DefaultCacheMaxEntries {
		t.Errorf("defaults are Routr 2's: %+v", c.opts)
	}
}

func TestFindCacheHitAndMiss(t *testing.T) {
	c, _ := newTestCache(t, CacheOptions{})
	var calls int32
	answer := &agents.FindByResponse{Items: []*agents.Agent{{Ref: "agent-01"}}}

	got, err := c.GetOrLoad(data.KindAgent, "username", "1001", counting(&calls, answer), notEmpty)
	if err != nil || got != answer {
		t.Fatalf("miss loads and returns the answer: %v %v", got, err)
	}
	again, _ := c.GetOrLoad(data.KindAgent, "username", "1001", counting(&calls, nil), notEmpty)
	if again != answer || calls != 1 {
		t.Errorf("hit serves the kept answer, same memory, without loading: %v, %d loads", again, calls)
	}
	// Another value, another kind with the same field and value: both misses
	c.GetOrLoad(data.KindAgent, "username", "1002", counting(&calls, answer), notEmpty)
	c.GetOrLoad(data.KindDomain, "username", "1001", counting(&calls, answer), notEmpty)
	if calls != 3 || c.Size() != 3 {
		t.Errorf("keyed by kind, field and value: %d loads, %d entries", calls, c.Size())
	}
}

func TestFindCacheFailedLoadIsNotKept(t *testing.T) {
	c, _ := newTestCache(t, CacheOptions{})
	boom := errors.New("boom")
	_, err := c.GetOrLoad(data.KindAgent, "username", "1001", func() (any, error) { return nil, boom }, notEmpty)
	if !errors.Is(err, boom) || c.Size() != 0 {
		t.Fatalf("the error comes back and nothing is kept: %v, %d entries", err, c.Size())
	}
	var calls int32
	c.GetOrLoad(data.KindAgent, "username", "1001", counting(&calls, "a"), notEmpty)
	if calls != 1 {
		t.Errorf("the next lookup loads again: %d loads", calls)
	}
}

func TestFindCacheOneLoadInFlightPerKey(t *testing.T) {
	c, _ := newTestCache(t, CacheOptions{})
	var calls int32
	release := make(chan struct{})
	load := func() (any, error) {
		atomic.AddInt32(&calls, 1)
		<-release
		return "a", nil
	}

	const callers = 5
	results := make(chan any, callers)
	var wg sync.WaitGroup
	for range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, err := c.GetOrLoad(data.KindAgent, "username", "1001", load, notEmpty)
			if err != nil {
				t.Error(err)
			}
			results <- v
		}()
		// Let each caller reach the cache before the next, so they queue
		// behind the first load
		time.Sleep(20 * time.Millisecond)
	}
	close(release)
	wg.Wait()
	close(results)
	for v := range results {
		if v != "a" {
			t.Errorf("every caller gets the one answer: %v", v)
		}
	}
	if calls != 1 {
		t.Errorf("one load for %d concurrent callers, got %d", callers, calls)
	}
	if c.Size() != 1 {
		t.Errorf("kept once: %d entries", c.Size())
	}
}

func TestFindCacheTTLWithSpread(t *testing.T) {
	for name, tc := range map[string]struct {
		random   float64
		lives    time.Duration
		expiresA time.Duration
	}{
		"no spread":     {0.5, 300 * time.Second, 300 * time.Second},
		"minus 20 %":    {0, 240 * time.Second, 240 * time.Second},
		"plus 20 %":     {1, 360 * time.Second, 360 * time.Second},
		"empty, spread": {0.5, 60 * time.Second, 60 * time.Second},
	} {
		t.Run(name, func(t *testing.T) {
			isEmpty := notEmpty
			if name == "empty, spread" {
				isEmpty = empty
			}
			c, clock := newTestCache(t, CacheOptions{Random: func() float64 { return tc.random }})
			var calls int32
			c.GetOrLoad(data.KindAgent, "username", "1001", counting(&calls, "a"), isEmpty)
			clock.Advance(tc.lives - time.Second)
			c.GetOrLoad(data.KindAgent, "username", "1001", counting(&calls, "a"), isEmpty)
			if calls != 1 {
				t.Errorf("still kept a second before %s: %d loads", tc.expiresA, calls)
			}
			clock.Advance(time.Second)
			c.GetOrLoad(data.KindAgent, "username", "1001", counting(&calls, "a"), isEmpty)
			if calls != 2 {
				t.Errorf("expired at %s and loaded again: %d loads", tc.expiresA, calls)
			}
		})
	}
}

func TestFindCacheBound(t *testing.T) {
	c, clock := newTestCache(t, CacheOptions{MaxEntries: 2})
	var calls int32
	c.GetOrLoad(data.KindAgent, "username", "1", counting(&calls, "a"), notEmpty)
	c.GetOrLoad(data.KindAgent, "username", "2", counting(&calls, "a"), notEmpty)
	got, err := c.GetOrLoad(data.KindAgent, "username", "3", counting(&calls, "c"), notEmpty)
	if err != nil || got != "c" || c.Size() != 2 {
		t.Fatalf("full of live entries, the answer is served but not kept: %v %v, %d entries", got, err, c.Size())
	}
	c.GetOrLoad(data.KindAgent, "username", "3", counting(&calls, "c"), notEmpty)
	if calls != 4 {
		t.Errorf("the unkept answer loads again: %d loads", calls)
	}
	// A kept key is refreshed in place, not counted twice
	c.Invalidate(data.KindAgent, &agents.Agent{Username: "1"})
	c.GetOrLoad(data.KindAgent, "username", "1", counting(&calls, "a"), notEmpty)
	if c.Size() != 2 {
		t.Errorf("replacing keeps the count: %d entries", c.Size())
	}
	// Once the live entries expire, a store sweeps them and keeps the answer
	clock.Advance(DefaultCacheTTL + time.Minute)
	c.GetOrLoad(data.KindAgent, "username", "3", counting(&calls, "c"), notEmpty)
	if c.Size() != 1 {
		t.Errorf("expired entries swept, the new one kept: %d entries", c.Size())
	}
}

func seed(t *testing.T, c *FindCache, kind data.Kind, field, value string) {
	t.Helper()
	if _, err := c.GetOrLoad(kind, field, value, func() (any, error) { return value, nil }, notEmpty); err != nil {
		t.Fatal(err)
	}
}

func kept(c *FindCache, kind data.Kind, field, value string) bool {
	loaded := false
	c.GetOrLoad(kind, field, value, func() (any, error) { loaded = true; return value, nil }, notEmpty)
	return !loaded
}

func TestFindCacheInvalidateDropsTheRowsKeys(t *testing.T) {
	c, _ := newTestCache(t, CacheOptions{})
	seed(t, c, data.KindAgent, "username", "1001")
	seed(t, c, data.KindAgent, "ref", "agent-01")
	seed(t, c, data.KindAgent, "username", "1002")
	seed(t, c, data.KindAgent, "privacy", "NONE")
	seed(t, c, data.KindAgent, "enabled", "true")

	c.Invalidate(data.KindAgent, &agents.Agent{Ref: "agent-01", Username: "1001", Privacy: agents.Privacy_NONE, Enabled: true,
		Domain: &domains.Domain{Ref: "domain-01"}})
	for _, key := range [][2]string{{"username", "1001"}, {"ref", "agent-01"}, {"privacy", "NONE"}, {"enabled", "true"}} {
		if kept(c, data.KindAgent, key[0], key[1]) {
			t.Errorf("%s=%s of the written row still kept", key[0], key[1])
		}
	}
	if !kept(c, data.KindAgent, "username", "1002") {
		t.Error("another row's entry dropped")
	}
}

func TestFindCacheInvalidateDropsTheEmbeddingKinds(t *testing.T) {
	c, _ := newTestCache(t, CacheOptions{})
	seed(t, c, data.KindAgent, "username", "1001")
	seed(t, c, data.KindDomain, "domainUri", "sip.local")
	seed(t, c, data.KindTrunk, "inboundUri", "trunk.local")

	// An Agent embeds its Domain: a Domain write drops every Agent
	c.Invalidate(data.KindDomain, &domains.Domain{Ref: "domain-02"})
	if kept(c, data.KindAgent, "username", "1001") || kept(c, data.KindDomain, "domainUri", "sip.local") {
		t.Error("the domain's and the agents' entries still kept")
	}
	if !kept(c, data.KindTrunk, "inboundUri", "trunk.local") {
		t.Error("the trunks, which embed no domain, dropped")
	}
	if c.Size() != 3 {
		t.Errorf("the count follows: %d entries", c.Size())
	}

	// A Delete only knows the ref
	c.Invalidate(data.KindTrunk, &agents.DeleteAgentRequest{Ref: "trunk-01"})
	seed(t, c, data.KindTrunk, "ref", "trunk-01")
	c.Invalidate(data.KindTrunk, &agents.DeleteAgentRequest{Ref: "trunk-01"})
	if kept(c, data.KindTrunk, "ref", "trunk-01") {
		t.Error("the deleted ref still kept")
	}
	// A write of a kind nothing embeds, with no row
	c.Invalidate(data.KindPeer, nil)
}

func TestFindCacheInvalidateDiscardsALoadInFlight(t *testing.T) {
	c, _ := newTestCache(t, CacheOptions{})
	release := make(chan struct{})
	started := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		c.GetOrLoad(data.KindAgent, "username", "1001", func() (any, error) {
			close(started)
			<-release
			return "stale", nil
		}, notEmpty)
	}()
	<-started
	c.Invalidate(data.KindAgent, &agents.Agent{Username: "1002"})
	close(release)
	<-done
	if c.Size() != 0 {
		t.Errorf("a load that began before the write is not kept: %d entries", c.Size())
	}
}

func TestFindCacheClear(t *testing.T) {
	c, _ := newTestCache(t, CacheOptions{})
	seed(t, c, data.KindAgent, "username", "1001")
	seed(t, c, data.KindDomain, "domainUri", "sip.local")
	c.Clear()
	if c.Size() != 0 || kept(c, data.KindAgent, "username", "1001") {
		t.Error("everything dropped")
	}
}

func TestScalarText(t *testing.T) {
	agent := &agents.Agent{Ref: "agent-01", Username: "1001", Privacy: agents.Privacy_NONE, Enabled: true, MaxContacts: 3,
		Domain: &domains.Domain{Ref: "domain-01"}}
	want := map[string]string{"ref": "agent-01", "username": "1001", "privacy": "NONE", "enabled": "true", "maxContacts": "3"}
	got := map[string]string{}
	agent.ProtoReflect().Range(func(fd protoreflect.FieldDescriptor, v protoreflect.Value) bool {
		if text, ok := scalarText(fd, v); ok {
			got[fd.JSONName()] = text
		}
		return true
	})
	if len(got) != len(want) {
		t.Fatalf("scalars only, by JSON name: %v", got)
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s: got %q, want %q", k, got[k], v)
		}
	}
}
