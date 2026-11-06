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
func fillPairs(m *TransactionManager, n int) ([]*sip.ClientTx, []*sip.ServerTx) {
	clients := make([]*sip.ClientTx, n)
	servers := make([]*sip.ServerTx, n)
	for i := range n {
		clients[i], servers[i] = &sip.ClientTx{}, &sip.ServerTx{}
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
			client, server := &sip.ClientTx{}, &sip.ServerTx{}
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
	client, retry, other := &sip.ClientTx{}, &sip.ClientTx{}, &sip.ClientTx{}
	server, next := &sip.ServerTx{}, &sip.ServerTx{}

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
	m.RemoveClientTransaction("none", &sip.ClientTx{})
	m.RemoveServerTransaction("none", &sip.ServerTx{})
	m.UpdateClientTransaction("none", &sip.ClientTx{}, &sip.ClientTx{})
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
