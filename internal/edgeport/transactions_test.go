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
	"strconv"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
)

// fillPairs puts n paired transactions in m, one call each, and returns them.
func fillPairs(m *TransactionManager, n int) ([]*ClientTx, []*ServerTx) {
	clients := make([]*ClientTx, n)
	servers := make([]*ServerTx, n)
	for i := range n {
		clients[i], servers[i] = &ClientTx{}, &ServerTx{}
		m.PutTransactions("c"+strconv.Itoa(i), clients[i], servers[i])
	}
	return clients, servers
}

// TestRemoveServerTransactionDoesNotScan releases every server transaction
// of a large table. The scan this replaced (ROUTR3.md section 1: 720 to
// 2,000 calls/s) made this quadratic, minutes at this size; the reverse index
// makes it linear, well under a second even with the race detector.
func TestRemoveServerTransactionDoesNotScan(t *testing.T) {
	const n = 50_000
	m := NewTransactionManager()
	_, servers := fillPairs(m, n)

	start := time.Now()
	for i, server := range servers {
		m.RemoveServerTransaction("c"+strconv.Itoa(i), server)
	}
	if elapsed := time.Since(start); elapsed > 10*time.Second {
		t.Fatalf("releasing %d server transactions took %s: a scan is back", n, elapsed)
	}
	if len(m.serverByClient) != 0 || len(m.clientsByServer) != 0 || len(m.servers) != 0 {
		t.Errorf("pairings left: %d by client, %d by server, %d calls",
			len(m.serverByClient), len(m.clientsByServer), len(m.servers))
	}
}

func BenchmarkRemoveServerTransaction(b *testing.B) {
	for _, n := range []int{1_000, 100_000} {
		b.Run(strconv.Itoa(n), func(b *testing.B) {
			m := NewTransactionManager()
			fillPairs(m, n)
			// One extra pair, released and put back on every iteration, so the
			// table stays at n throughout
			client, server := &ClientTx{}, &ServerTx{}
			b.ResetTimer()
			for range b.N {
				m.PutTransactions("bench", client, server)
				m.RemoveServerTransaction("bench", server)
			}
		})
	}
}

func TestTransactionManagerIndexesStayConsistent(t *testing.T) {
	m := NewTransactionManager()
	client, retry, other := &ClientTx{}, &ClientTx{}, &ClientTx{}
	server, next := &ServerTx{}, &ServerTx{}

	// Two clients answer for one server (a challenged request and its retry)
	m.PutTransactions("c1", client, server)
	m.UpdateClientTransaction("c1", client, retry)
	m.PutTransactions("c1", other, server)
	if m.ServerTransactionFor(client) != nil {
		t.Error("the challenged transaction keeps its pairing")
	}
	if len(m.clientsByServer[server]) != 2 {
		t.Errorf("server answered for by %d clients, want 2", len(m.clientsByServer[server]))
	}

	// Pairing a client with another server moves it out of the first's set
	m.PutTransactions("c1", other, next)
	if m.ServerTransactionFor(other) != next || len(m.clientsByServer[server]) != 1 {
		t.Error("repointed client left in the previous server's set")
	}

	// Releasing a client empties its server's set; releasing the server
	// forgets every client that still answered for it
	m.RemoveClientTransaction("c1", other)
	if _, ok := m.clientsByServer[next]; ok {
		t.Error("empty reverse entry kept")
	}
	m.RemoveServerTransaction("c1", server)
	if m.ServerTransactionFor(retry) != nil {
		t.Error("retry still paired with a released server")
	}
	if len(m.serverByClient) != 0 || len(m.clientsByServer) != 0 {
		t.Errorf("pairings left: %v %v", m.serverByClient, m.clientsByServer)
	}

	// Releasing what was never stored is a no-op
	m.RemoveClientTransaction("none", &ClientTx{})
	m.RemoveServerTransaction("none", &ServerTx{})
	m.UpdateClientTransaction("none", &ClientTx{}, &ClientTx{})
	m.PutTransactions("c2", client, nil)
	if m.ServerTransactionFor(client) != nil || m.ClientTransaction("c2") != client {
		t.Error("a client without a server is stored unpaired")
	}
}

func TestTransactionManagerOriginalCSeqsPerMethod(t *testing.T) {
	m := NewTransactionManager()
	m.RecordOriginalCSeq("c1", sip.INVITE, 1)
	m.RecordOriginalCSeq("c1", sip.BYE, 2)
	m.RecordOriginalCSeq("c2", sip.BYE, 3)
	m.RemoveOriginalCSeq("c1", sip.INVITE)
	m.RemoveOriginalCSeq("c1", sip.OPTIONS)
	m.RemoveOriginalCSeq("none", sip.OPTIONS)
	if _, ok := m.OriginalCSeq("c1", sip.INVITE); ok {
		t.Error("removed method kept")
	}
	if seq, ok := m.OriginalCSeq("c1", sip.BYE); !ok || seq != 2 {
		t.Error("other method of the same call lost")
	}
	m.RemoveDialog("c1")
	if _, ok := m.OriginalCSeq("c1", sip.BYE); ok {
		t.Error("dialog's numbers kept")
	}
	if seq, ok := m.OriginalCSeq("c2", sip.BYE); !ok || seq != 3 {
		t.Error("another dialog's numbers lost")
	}
	if _, ok := m.originalCSeqs["c1"]; ok {
		t.Error("empty call entry kept")
	}
}

func TestTransactionManagerCancelsExpireInOrder(t *testing.T) {
	m := NewTransactionManager()
	now := time.Unix(1000, 0)
	m.now = func() time.Time { return now }

	m.MarkCancelled("old")
	now = now.Add(cancelMemory / 2)
	m.MarkCancelled("mid")
	// Marked again later: the newer time wins over the stale mark
	now = now.Add(cancelMemory / 4)
	m.MarkCancelled("old")
	m.RemoveDialog("mid")

	// Past the first marks' memory but not the re-mark's
	now = now.Add(cancelMemory/2 + time.Millisecond)
	m.MarkCancelled("new")
	if !m.IsCancelled("old") {
		t.Error("a re-marked cancel expired with its stale mark")
	}
	if m.IsCancelled("mid") {
		t.Error("released dialog remembered")
	}
	// The stale marks of "old" expired; "mid" is still inside the memory
	if len(m.cancels) != 3 {
		t.Errorf("%d marks kept, want mid, the re-mark and the new one", len(m.cancels))
	}

	now = now.Add(cancelMemory + time.Millisecond)
	m.MarkCancelled("last")
	if m.IsCancelled("old") || m.IsCancelled("new") || !m.IsCancelled("last") {
		t.Error("expiry")
	}
	if len(m.cancelledAt) != 1 || len(m.cancels) != 1 {
		t.Errorf("tables: %d cancelled, %d marks, want 1 and 1", len(m.cancelledAt), len(m.cancels))
	}
}

func TestDialogTargets(t *testing.T) {
	now := time.Now()
	m := NewTransactionManager()
	m.now = func() time.Time { return now }
	contact := sip.Uri{Scheme: "sip", User: "1002", Host: "10.0.0.2", Port: 7060}
	check := func(uri sip.Uri, wantKnown, wantTarget bool) {
		t.Helper()
		known, target := m.IsDialogTarget("c1", uri)
		if known != wantKnown || target != wantTarget {
			t.Errorf("%s: known %v, target %v", uri.String(), known, target)
		}
	}

	check(contact, false, false)
	m.RecordDialogTargets("c1", false, contact)
	check(contact, false, false) // Only what creates a dialog makes the entry

	m.RecordDialogTargets("c1", true, contact)
	check(contact, true, true)
	check(sip.Uri{Scheme: "sip", User: "anyone", Host: "10.0.0.2", Port: 7060}, true, true)
	check(sip.Uri{Scheme: "sip", User: "1002", Host: "10.0.0.2", Port: 7061}, true, false)
	check(sip.Uri{Scheme: "sip", User: "1002", Host: "198.51.100.1", Port: 7060}, true, false)

	// A target refresh adds to what is there
	refreshed := sip.Uri{Scheme: "sip", Host: "10.0.0.3", Port: 7060}
	m.RecordDialogTargets("c1", false, refreshed)
	check(refreshed, true, true)

	// Unanswered, it lasts dialogLinger; answered, until the BYE and then that long
	now = now.Add(dialogLinger - time.Second)
	m.RecordDialog("c1")
	now = now.Add(time.Hour)
	check(contact, true, true)
	m.RemoveDialog("c1")
	if m.HasDialog("c1") {
		t.Error("the dialog is over")
	}
	now = now.Add(dialogLinger - time.Second)
	check(contact, true, true)
	now = now.Add(2 * time.Second)
	check(contact, false, false)
	m.RecordDialogTargets("other", true, contact) // Sweeps
	if _, ok := m.targets["c1"]; ok {
		t.Error("the entry was not released")
	}

	// An INVITE no one answered goes the same way
	m.RecordDialogTargets("c2", true, contact)
	now = now.Add(dialogLinger + time.Second)
	m.RecordDialogTargets("other", false)
	if _, ok := m.targets["c2"]; ok {
		t.Error("an unanswered INVITE was kept")
	}
}

func TestDialogTargetsAreBounded(t *testing.T) {
	m := NewTransactionManager()
	first := sip.Uri{Host: "first.example"}
	m.RecordDialogTargets("c1", true, first)
	for i := range maxDialogTargets {
		m.RecordDialogTargets("c1", false, sip.Uri{Host: "10.0.0.1", Port: 1000 + i})
	}
	if got := len(m.targets["c1"].targets); got != maxDialogTargets {
		t.Errorf("targets: %d", got)
	}
	if _, target := m.IsDialogTarget("c1", first); target {
		t.Error("the oldest goes first")
	}
}

func TestTargetKey(t *testing.T) {
	params := func(k, v string) sip.HeaderParams {
		p := sip.NewParams()
		p.Add(k, v)
		return p
	}
	for _, tc := range []struct {
		uri  sip.Uri
		want string
	}{
		{sip.Uri{Scheme: "sip", Host: "HOST.example"}, "host.example:5060"},
		{sip.Uri{Scheme: "sips", Host: "host.example"}, "host.example:5061"},
		{sip.Uri{Scheme: "sip", Host: "host.example", UriParams: params("transport", "tls")}, "host.example:5061"},
		{sip.Uri{Scheme: "sip", User: "u", Host: "host.example", Port: 6060}, "host.example:6060"},
		{sip.Uri{Scheme: "sip", Host: "[::1]"}, "::1:5060"},
		{sip.Uri{Scheme: "sip", Host: "host.example", UriParams: params("maddr", "10.0.0.9")}, "10.0.0.9:5060"},
	} {
		if got := targetKey(tc.uri); got != tc.want {
			t.Errorf("%v: %s, want %s", tc.uri, got, tc.want)
		}
	}
}
