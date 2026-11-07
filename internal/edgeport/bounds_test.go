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

	"github.com/emiago/sipgo/sip"
)

func TestCallQueueIsBounded(t *testing.T) {
	block := make(chan struct{})
	q := NewBoundedCallQueue(discardLog(), 2, 3)
	if !q.Run("a", func() { <-block }) {
		t.Fatal("the first goes in")
	}
	// The one running may or may not be off the queue yet; wait until it is
	waitFor(t, func() bool {
		q.mu.Lock()
		defer q.mu.Unlock()
		return q.queued == 0
	})
	if !q.Run("a", func() {}) || !q.Run("a", func() {}) {
		t.Fatal("up to the call's limit")
	}
	if q.Run("a", func() {}) {
		t.Fatal("past the call's limit")
	}
	if !q.Run("b", func() { <-block }) {
		t.Fatal("another call has room")
	}
	waitFor(t, func() bool {
		q.mu.Lock()
		defer q.mu.Unlock()
		return q.queued == 2
	})
	if !q.Run("b", func() {}) {
		t.Fatal("up to the total")
	}
	if q.Run("d", func() {}) {
		t.Fatal("past the total")
	}
	// What releases state is never refused
	released := make(chan struct{})
	q.RunAlways("d", func() { close(released) })
	select {
	case <-released:
	case <-time.After(5 * time.Second):
		t.Fatal("RunAlways did not run")
	}
	close(block)
	waitFor(t, func() bool { return q.Len() == 0 })
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("timed out")
		}
		time.Sleep(time.Millisecond)
	}
}

func TestEstablishedDialogExpiresWhenIdle(t *testing.T) {
	now := time.Unix(1000, 0)
	m := NewBoundedTransactionManager(10, time.Hour)
	m.now = func() time.Time { return now }
	contact := sip.Uri{Scheme: "sip", Host: "10.0.0.2", Port: 7060}
	m.RecordDialogTargets("idle", true, contact)
	m.RecordDialog("idle")
	m.RecordDialogTargets("busy", true, contact)
	m.RecordDialog("busy")
	m.RecordAuthenticated("idle")
	m.RecordOriginalCSeq("idle", sip.BYE, 1)

	// Activity keeps one of them alive past the hour
	for range 7 {
		now = now.Add(10 * time.Minute)
		if _, target := m.IsDialogTarget("busy", contact); !target {
			t.Fatal("an active dialog was forgotten")
		}
	}
	m.RecordDialogTargets("other", true, contact) // Sweeps
	if m.HasDialog("idle") {
		t.Error("an idle dialog outlived its idle time")
	}
	if _, ok := m.targets["idle"]; ok {
		t.Error("its targets stayed")
	}
	if m.CSeqOffset("idle") != 0 {
		t.Error("its CSeq offset stayed")
	}
	if _, ok := m.OriginalCSeq("idle", sip.BYE); ok {
		t.Error("its CSeqs stayed")
	}
	if !m.HasDialog("busy") {
		t.Error("the active one went with it")
	}
	if _, target := m.IsDialogTarget("idle", contact); target {
		t.Error("an expired dialog is no target")
	}
}

func TestIdleMarksDontGrowWithActivity(t *testing.T) {
	now := time.Unix(1000, 0)
	m := NewBoundedTransactionManager(10, time.Hour)
	m.now = func() time.Time { return now }
	contact := sip.Uri{Scheme: "sip", Host: "10.0.0.2", Port: 7060}
	m.RecordDialogTargets("c1", true, contact)
	m.RecordDialog("c1")
	for range 10_000 {
		now = now.Add(100 * time.Millisecond)
		m.IsDialogTarget("c1", contact)
	}
	// 1,000 s of activity at one mark per 1/64 of an hour
	if len(m.idleMarks) > 20 {
		t.Fatalf("%d marks", len(m.idleMarks))
	}
}

func TestDialogTableIsBounded(t *testing.T) {
	m := NewBoundedTransactionManager(1, time.Hour)
	contact := sip.Uri{Scheme: "sip", Host: "10.0.0.2", Port: 7060}
	if !m.CanCreateDialog("c1") {
		t.Fatal("empty")
	}
	m.RecordDialogTargets("c1", true, contact)
	if !m.CanCreateDialog("c1") {
		t.Fatal("a dialog already there fits")
	}
	if m.CanCreateDialog("c2") {
		t.Fatal("past the limit")
	}
}

func TestAuthenticatedWithNoDialogExpires(t *testing.T) {
	now := time.Unix(1000, 0)
	m := NewBoundedTransactionManager(10, time.Hour)
	m.now = func() time.Time { return now }
	m.RecordAuthenticated("register-1")
	if m.CSeqOffset("register-1") != 1 {
		t.Fatal("kept")
	}
	if m.HasDialog("register-1") {
		t.Fatal("it isn't a dialog")
	}
	now = now.Add(2 * time.Hour)
	m.RecordDialogTargets("other", true)
	if m.CSeqOffset("register-1") != 0 {
		t.Error("nothing else would ever release it")
	}
}

func TestLimitsDefaults(t *testing.T) {
	l := Limits{}.withDefaults()
	if l.Transactions != DefaultTransactions || l.UDPReaders < 1 || l.UDPWorkers < 2 || l.UDPQueue != DefaultUDPQueueSize {
		t.Errorf("%+v", l)
	}
	set := Limits{Transactions: 7, UDPReaders: 3, UDPWorkers: 5, UDPQueue: 11}.withDefaults()
	if set.Transactions != 7 || set.UDPReaders != 3 || set.UDPWorkers != 5 || set.UDPQueue != 11 {
		t.Errorf("%+v", set)
	}
}

func TestOverflowCounts(t *testing.T) {
	e := &EdgePort{log: discardLog()}
	e.overflowed(overflowUDPQueue)
	e.overflowed(overflowUDPQueue)
	e.overflowed(overflowDialogs)
	got := e.Overflows()
	if got["udp_queue"] != 2 || got["dialogs"] != 1 || got["transactions"] != 0 {
		t.Errorf("%v", got)
	}
}
