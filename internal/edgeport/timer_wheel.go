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
package edgeport

import (
	"sync"
	"time"
)

// The wheel's geometry: a 10 ms tick over 40.96 s, which holds every RFC 3261
// timer in one turn (the longest is 64*T1, 32 s). A longer timer waits out
// whole turns on its rounds counter.
const (
	wheelTick  = 10 * time.Millisecond
	wheelSlots = 1 << 12
	wheelMask  = wheelSlots - 1
)

type timerKind uint8

const (
	// timerRetransmit is A or E on a client transaction, G on a server one
	timerRetransmit timerKind = iota
	// timerLife ends a transaction's current state: B, C, F, D or K on a
	// client transaction; H, I, J or L on a server one
	timerLife
	// timerTrying is the server's 100 Trying after 200 ms (RFC 3261 section 17.2.1)
	timerTrying
	// timerAbandon releases a server transaction that will get no final response
	timerAbandon
)

// timerTarget gets the timers that fire. fireTimer runs on the wheel's
// goroutine and must not block; gen tells a timer that fired from one that was
// cancelled or moved between leaving the wheel and getting here.
type timerTarget interface {
	fireTimer(kind timerKind, gen uint32)
}

// wheelTimer is a timer held inside its transaction, so a transaction's timers
// cost no allocation. The owner arms and cancels it under its own lock; gen is
// written with that lock and the wheel's held, so either one reads it safely.
type wheelTimer struct {
	next, prev *wheelTimer
	slot       int32 // the slot it waits in, plus one; 0 is not armed
	rounds     uint32
	gen        uint32
	kind       timerKind
	target     timerTarget
}

// dueTimer is a timer taken off the wheel, on its way to fire.
type dueTimer struct {
	target timerTarget
	kind   timerKind
	gen    uint32
}

// timerWheel is the one clock of the transaction layer: every timer of every
// transaction sits in one of its slots and one goroutine, stopped by Close,
// moves the hand. Arming, moving and cancelling are O(1); a tick costs the
// timers in its slot.
//
// A timer never fires early and fires at most two ticks late: 20 ms on top of
// the value RFC 3261 gives, which is under its own precision for T1.
type timerWheel struct {
	mu    sync.Mutex
	slots [wheelSlots]*wheelTimer
	// hand is the last tick done
	hand uint64
	due  []dueTimer
	// started is when the hand started, read by schedule; zero until then
	started time.Time

	stopOnce sync.Once
	stop     chan struct{}
	done     chan struct{}
}

func newTimerWheel() *timerWheel {
	return &timerWheel{stop: make(chan struct{}), done: make(chan struct{})}
}

// start moves the hand until Close. The hand follows the monotonic clock, not
// the ticks it was given: after a stall it catches up and fires what is due.
func (w *timerWheel) start() {
	started := time.Now()
	w.mu.Lock()
	w.started = started
	w.mu.Unlock()
	go func() {
		defer close(w.done)
		ticker := time.NewTicker(wheelTick)
		defer ticker.Stop()
		for {
			select {
			case <-w.stop:
				return
			case <-ticker.C:
				target := uint64(time.Since(started) / wheelTick)
				for w.currentHand() < target {
					w.step()
				}
			}
		}
	}()
}

// Close stops the hand and waits for it; what is still armed never fires. A
// wheel that never started just closes.
func (w *timerWheel) Close(started bool) {
	w.stopOnce.Do(func() { close(w.stop) })
	if started {
		<-w.done
	}
}

func (w *timerWheel) currentHand() uint64 {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.hand
}

// schedule arms t to fire after d, replacing what it was armed for, and
// returns the generation that will fire. The caller holds the lock of t's
// owner. It counts from the clock when the hand is behind it: from the hand, a
// timer armed while the wheel catches up would fire early by the lag.
func (w *timerWheel) schedule(t *wheelTimer, d time.Duration, target timerTarget, kind timerKind) {
	ticks := uint64(0)
	if d > 0 {
		ticks = uint64((d + wheelTick - 1) / wheelTick)
	}
	// The tick in progress is partly gone: one more keeps it from firing early
	ticks++

	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.started.IsZero() {
		if now := uint64(time.Since(w.started) / wheelTick); now > w.hand {
			ticks += now - w.hand
		}
	}
	w.unlink(t)
	t.gen++
	t.target = target
	t.kind = kind
	t.rounds = uint32((ticks - 1) / wheelSlots)
	slot := int32((w.hand + ticks) & wheelMask)
	t.slot = slot + 1
	t.prev = nil
	t.next = w.slots[slot]
	if t.next != nil {
		t.next.prev = t
	}
	w.slots[slot] = t
}

// cancel disarms t. The caller holds the lock of t's owner. Cancelling a timer
// that isn't armed only moves its generation.
func (w *timerWheel) cancel(t *wheelTimer) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.unlink(t)
	t.gen++
}

// unlink takes t out of its slot. The caller holds mu.
func (w *timerWheel) unlink(t *wheelTimer) {
	if t.slot == 0 {
		return
	}
	if t.prev != nil {
		t.prev.next = t.next
	} else {
		w.slots[t.slot-1] = t.next
	}
	if t.next != nil {
		t.next.prev = t.prev
	}
	t.next, t.prev, t.slot = nil, nil, 0
}

// step moves the hand one tick and fires what is due, outside the lock: a
// target takes its own lock and that lock is held around schedule and cancel.
func (w *timerWheel) step() {
	w.mu.Lock()
	w.hand++
	slot := w.hand & wheelMask
	due := w.due[:0]
	var next *wheelTimer
	for t := w.slots[slot]; t != nil; t = next {
		next = t.next
		if t.rounds > 0 {
			t.rounds--
			continue
		}
		w.unlink(t)
		due = append(due, dueTimer{target: t.target, kind: t.kind, gen: t.gen})
	}
	// Owned by this goroutine from here on: schedule never touches due
	w.due = nil
	w.mu.Unlock()

	for i := range due {
		due[i].target.fireTimer(due[i].kind, due[i].gen)
		due[i].target = nil
	}

	w.mu.Lock()
	w.due = due[:0]
	w.mu.Unlock()
}
