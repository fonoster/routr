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
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/fonoster/routr/internal/data"
)

func TestCacheStaleServesAndRefreshesOnce(t *testing.T) {
	now := time.Unix(1000, 0)
	var mu sync.Mutex
	clock := func() time.Time { mu.Lock(); defer mu.Unlock(); return now }
	c, err := NewFindCache(CacheOptions{TTL: time.Minute, Stale: time.Minute, Now: clock, Random: func() float64 { return 0.5 }})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	var loads atomic.Int32
	release := make(chan struct{})
	load := func(context.Context) (any, error) {
		n := loads.Add(1)
		if n > 1 {
			<-release
		}
		return int(n), nil
	}
	ctx := context.Background()
	if v, _ := c.Load(ctx, data.KindAgent, "f", "v", load, notEmpty); v != 1 {
		t.Fatalf("got %v", v)
	}
	mu.Lock()
	now = now.Add(90 * time.Second)
	mu.Unlock()
	// Past the TTL: the old answer, at once, for everybody, with one load behind it
	for range 5 {
		if v, _ := c.Load(ctx, data.KindAgent, "f", "v", load, notEmpty); v != 1 {
			t.Fatalf("got %v", v)
		}
	}
	close(release)
	deadline := time.Now().Add(5 * time.Second)
	for {
		v, _ := c.Load(ctx, data.KindAgent, "f", "v", load, notEmpty)
		if v == 2 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the refresh never landed")
		}
		time.Sleep(time.Millisecond)
	}
	if loads.Load() != 2 {
		t.Errorf("%d loads", loads.Load())
	}
}

func TestCacheStaleEndsAndDoesNotCoverEmptyOrWrites(t *testing.T) {
	now := time.Unix(1000, 0)
	c, err := NewFindCache(CacheOptions{TTL: time.Minute, NegativeTTL: time.Minute, Stale: time.Minute,
		Now: func() time.Time { return now }, Random: func() float64 { return 0.5 }})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	ctx := context.Background()
	var loads int
	load := func(context.Context) (any, error) { loads++; return loads, nil }

	_, _ = c.Load(ctx, data.KindAgent, "f", "gone", load, notEmpty)
	now = now.Add(3 * time.Minute)
	if v, _ := c.Load(ctx, data.KindAgent, "f", "gone", load, notEmpty); v != 2 {
		t.Errorf("past TTL + Stale it loads: %v", v)
	}

	empty := func(any) bool { return true }
	_, _ = c.Load(ctx, data.KindAgent, "f", "none", load, empty)
	now = now.Add(90 * time.Second)
	before := loads
	_, _ = c.Load(ctx, data.KindAgent, "f", "none", load, empty)
	if loads != before+1 {
		t.Error("an empty answer is never served stale")
	}

	_, _ = c.Load(ctx, data.KindDomain, "f", "row", load, notEmpty)
	now = now.Add(90 * time.Second)
	c.Invalidate(data.KindDomain, nil)
	before = loads
	_, _ = c.Load(ctx, data.KindDomain, "f", "row", load, notEmpty)
	if loads != before+1 {
		t.Error("a write drops a stale answer too")
	}
}

func TestCacheColdBurstIsBoundedAndSingleFlight(t *testing.T) {
	const maxLoads = 4
	c, err := NewFindCache(CacheOptions{MaxLoads: maxLoads})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	var running, peak, total atomic.Int32
	load := func(context.Context) (any, error) {
		total.Add(1)
		n := running.Add(1)
		for {
			p := peak.Load()
			if n <= p || peak.CompareAndSwap(p, n) {
				break
			}
		}
		time.Sleep(time.Millisecond)
		running.Add(-1)
		return 1, nil
	}
	var wg sync.WaitGroup
	const keys, callers = 40, 25
	wg.Add(keys * callers)
	for k := range keys {
		for range callers {
			go func() {
				defer wg.Done()
				if _, err := c.Load(context.Background(), data.KindAgent, "f", string(rune('a'+k)), load, notEmpty); err != nil {
					t.Error(err)
				}
			}()
		}
	}
	wg.Wait()
	if peak.Load() > maxLoads {
		t.Errorf("%d loads at once", peak.Load())
	}
	if total.Load() > keys {
		t.Errorf("%d loads for %d keys", total.Load(), keys)
	}
}

// One caller leaving must not take the others with it.
func TestCacheCallerThatLeavesDoesNotFailTheOthers(t *testing.T) {
	c, err := NewFindCache(CacheOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	ctx, cancel := context.WithCancel(context.Background())
	started := make(chan struct{})
	release := make(chan struct{})
	var loadErr atomic.Value
	first := make(chan error, 1)
	go func() {
		_, err := c.Load(ctx, data.KindAgent, "f", "v", func(loadCtx context.Context) (any, error) {
			close(started)
			<-release
			if err := loadCtx.Err(); err != nil {
				loadErr.Store(err)
			}
			return 1, nil
		}, notEmpty)
		first <- err
	}()
	<-started
	second := make(chan any, 1)
	go func() {
		v, _ := c.Load(context.Background(), data.KindAgent, "f", "v", func(context.Context) (any, error) {
			return nil, errors.New("not this load")
		}, notEmpty)
		second <- v
	}()
	cancel()
	time.Sleep(5 * time.Millisecond)
	close(release)
	if v := <-second; v != 1 {
		t.Errorf("the second caller got %v", v)
	}
	if err := <-first; err != nil {
		t.Errorf("the load itself succeeded: %v", err)
	}
	if v := loadErr.Load(); v != nil {
		t.Errorf("the load saw its caller's cancellation: %v", v)
	}
	// A caller waiting on someone else's load can leave on its own
	block := make(chan struct{})
	began := make(chan struct{})
	go func() {
		_, _ = c.Load(context.Background(), data.KindAgent, "f", "slow", func(context.Context) (any, error) {
			close(began)
			<-block
			return 1, nil
		}, notEmpty)
	}()
	<-began
	waiter, stop := context.WithCancel(context.Background())
	stop()
	if _, err := c.Load(waiter, data.KindAgent, "f", "slow", func(context.Context) (any, error) { return 2, nil }, notEmpty); !errors.Is(err, context.Canceled) {
		t.Errorf("err %v", err)
	}
	close(block)
}

func TestCacheRejectsNegativeStaleAndLoads(t *testing.T) {
	if _, err := NewFindCache(CacheOptions{Stale: -time.Second}); err == nil {
		t.Error("negative stale")
	}
	if _, err := NewFindCache(CacheOptions{MaxLoads: -1}); err == nil {
		t.Error("negative max loads")
	}
}

func BenchmarkCacheHit(b *testing.B) {
	c, err := NewFindCache(CacheOptions{})
	if err != nil {
		b.Fatal(err)
	}
	defer c.Close()
	load := func(context.Context) (any, error) { return 1, nil }
	ctx := context.Background()
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		_, _ = c.Load(ctx, data.KindAgent, "username", "1001", load, notEmpty)
	}
}
