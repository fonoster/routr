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
	"testing"
	"time"
)

type firedTimer struct {
	kind timerKind
	gen  uint32
}

type wheelProbe struct {
	fired []firedTimer
}

func (p *wheelProbe) fireTimer(kind timerKind, gen uint32) {
	p.fired = append(p.fired, firedTimer{kind, gen})
}

// stepFor moves the hand by d, in ticks.
func stepFor(w *timerWheel, d time.Duration) {
	for range int(d / wheelTick) {
		w.step()
	}
}

func TestWheelNeverFiresEarlyAndAtMostTwoTicksLate(t *testing.T) {
	for _, d := range []time.Duration{0, time.Millisecond, wheelTick, 15 * time.Millisecond, 500 * time.Millisecond, 32 * time.Second} {
		w := newTimerWheel()
		probe := &wheelProbe{}
		var timer wheelTimer
		w.schedule(&timer, d, probe, timerLife)
		stepFor(w, d-d%wheelTick)
		if d >= wheelTick && d%wheelTick == 0 && len(probe.fired) != 0 {
			t.Errorf("%s: fired early", d)
		}
		w.step()
		w.step()
		if len(probe.fired) != 1 {
			t.Errorf("%s: fired %d times by two ticks past its time", d, len(probe.fired))
		}
	}
}

func TestWheelBeyondOneTurn(t *testing.T) {
	w := newTimerWheel()
	probe := &wheelProbe{}
	var timer wheelTimer
	d := 3*wheelSlots*wheelTick + 50*time.Millisecond
	w.schedule(&timer, d, probe, timerLife)
	stepFor(w, d)
	if len(probe.fired) != 0 {
		t.Fatalf("a timer past one turn fired after %s", d)
	}
	w.step()
	w.step()
	if len(probe.fired) != 1 {
		t.Fatalf("fired %d times", len(probe.fired))
	}
}

func TestWheelCancelAndMove(t *testing.T) {
	w := newTimerWheel()
	probe := &wheelProbe{}
	var cancelled, moved, kept wheelTimer
	w.schedule(&cancelled, 100*time.Millisecond, probe, timerRetransmit)
	w.schedule(&moved, 100*time.Millisecond, probe, timerLife)
	w.schedule(&kept, 100*time.Millisecond, probe, timerAbandon)
	w.cancel(&cancelled)
	w.schedule(&moved, time.Second, probe, timerLife)
	stepFor(w, 200*time.Millisecond)
	if len(probe.fired) != 1 || probe.fired[0].kind != timerAbandon {
		t.Fatalf("fired %v", probe.fired)
	}
	stepFor(w, time.Second)
	if len(probe.fired) != 2 || probe.fired[1].kind != timerLife || probe.fired[1].gen != moved.gen {
		t.Fatalf("fired %v", probe.fired)
	}
}

// A target can arm its own timer again while the wheel is firing it.
type rearmingProbe struct {
	w     *timerWheel
	timer wheelTimer
	times int
}

func (p *rearmingProbe) fireTimer(kind timerKind, _ uint32) {
	p.times++
	if p.times < 3 {
		p.w.schedule(&p.timer, wheelTick, p, kind)
	}
}

func TestWheelTargetRearmsFromItsFire(t *testing.T) {
	w := newTimerWheel()
	p := &rearmingProbe{w: w}
	w.schedule(&p.timer, wheelTick, p, timerRetransmit)
	stepFor(w, 10*wheelTick)
	if p.times != 3 {
		t.Fatalf("fired %d times", p.times)
	}
}

func TestWheelStartAndClose(t *testing.T) {
	w := newTimerWheel()
	w.start()
	fired := make(chan struct{})
	var timer wheelTimer
	w.schedule(&timer, wheelTick, closeProbe{fired}, timerLife)
	select {
	case <-fired:
	case <-time.After(5 * time.Second):
		t.Fatal("the running wheel fired nothing")
	}
	w.Close(true)
	w.Close(true)
}

type closeProbe struct{ ch chan struct{} }

func (p closeProbe) fireTimer(timerKind, uint32) { close(p.ch) }

// BenchmarkWheelArmCancel is the cost a transaction pays per timer, with the
// wheel holding what 2,500 calls/s would.
func BenchmarkWheelArmCancel(b *testing.B) {
	w := newTimerWheel()
	probe := &wheelProbe{}
	held := make([]wheelTimer, 250_000)
	for i := range held {
		w.schedule(&held[i], time.Duration(i%32)*time.Second, probe, timerLife)
	}
	var timer wheelTimer
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		w.schedule(&timer, 32*time.Second, probe, timerLife)
		w.cancel(&timer)
	}
}
