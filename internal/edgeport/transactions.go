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

	"github.com/emiago/sipgo/sip"
)

// cancelMemory is how long a cancel is remembered: 64 * T1, the longest an
// INVITE client transaction can still be answered (RFC 3261 section 17.1.1.2).
const cancelMemory = 64 * 500 * time.Millisecond

// cancelMark is one remembered cancel, in the order it was marked.
type cancelMark struct {
	callID string
	at     time.Time
}

// TransactionManager is io.routr.utils.TransactionManager: the pairing of the
// transactions a request was forwarded on, keyed by call ID and by client
// transaction, and the dialog state the EdgePort keeps.
//
// Every operation is O(1) in the size of the tables (ROUTR3.md section 3.5):
// the pairing is indexed both ways, the original CSeqs are nested by call and
// the cancel memory expires from a queue, so no operation scans a table.
type TransactionManager struct {
	mu sync.Mutex

	// call ID -> the last client and server transaction forwarded for it
	clients map[string]*sip.ClientTx
	servers map[string]*sip.ServerTx
	// the server transaction each client transaction answers for
	serverByClient map[*sip.ClientTx]*sip.ServerTx
	// the reverse of serverByClient: the client transactions that answer for
	// a server transaction, so releasing it needn't scan the pairings
	clientsByServer map[*sip.ServerTx]map[*sip.ClientTx]struct{}

	cseqOffsets map[string]int
	// call ID -> method -> the caller's CSeq number, nested by call so a
	// dialog's numbers are released with the dialog, not by a prefix scan
	originalCSeqs map[string]map[sip.RequestMethod]uint32
	dialogs       map[string]bool
	cancelledAt   map[string]time.Time
	// cancels in marking order; a mark whose time no longer matches
	// cancelledAt was superseded or released and is skipped when it expires
	cancels []cancelMark

	now func() time.Time
}

// NewTransactionManager returns an empty manager.
func NewTransactionManager() *TransactionManager {
	return &TransactionManager{
		clients:         map[string]*sip.ClientTx{},
		servers:         map[string]*sip.ServerTx{},
		serverByClient:  map[*sip.ClientTx]*sip.ServerTx{},
		clientsByServer: map[*sip.ServerTx]map[*sip.ClientTx]struct{}{},
		cseqOffsets:     map[string]int{},
		originalCSeqs:   map[string]map[sip.RequestMethod]uint32{},
		dialogs:         map[string]bool{},
		cancelledAt:     map[string]time.Time{},
		now:             time.Now,
	}
}

// MarkCancelled records that the caller of a call cancelled it.
func (m *TransactionManager) MarkCancelled(callID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	m.expireCancels(now)
	m.cancelledAt[callID] = now
	m.cancels = append(m.cancels, cancelMark{callID: callID, at: now})
}

// expireCancels forgets the cancels older than 64 * T1. The marks are in
// time order, so this stops at the first one still remembered: amortized
// O(1) per mark. The caller holds mu.
func (m *TransactionManager) expireCancels(now time.Time) {
	i := 0
	for ; i < len(m.cancels); i++ {
		mark := m.cancels[i]
		if now.Sub(mark.at) <= cancelMemory {
			break
		}
		if at, ok := m.cancelledAt[mark.callID]; ok && at.Equal(mark.at) {
			delete(m.cancelledAt, mark.callID)
		}
	}
	if i == len(m.cancels) {
		m.cancels = nil
		return
	}
	// A queue: the head moves forward and append reallocates the live tail
	// once the capacity runs out, so the expired marks don't pin the array
	m.cancels = m.cancels[i:]
}

// IsCancelled tells whether the caller cancelled the call within 64 * T1.
func (m *TransactionManager) IsCancelled(callID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	at, ok := m.cancelledAt[callID]
	return ok && m.now().Sub(at) <= cancelMemory
}

// RecordDialog records a dialog this EdgePort proxied.
func (m *TransactionManager) RecordDialog(callID string) {
	m.mu.Lock()
	m.dialogs[callID] = true
	m.mu.Unlock()
}

// HasDialog tells whether this EdgePort proxied the dialog.
func (m *TransactionManager) HasDialog(callID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.dialogs[callID]
}

// RecordAuthenticated adds one to the dialog's CSeq offset.
func (m *TransactionManager) RecordAuthenticated(callID string) {
	m.mu.Lock()
	m.cseqOffsets[callID]++
	m.mu.Unlock()
}

// CSeqOffset returns the dialog's CSeq offset (0 when never authenticated).
func (m *TransactionManager) CSeqOffset(callID string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cseqOffsets[callID]
}

// RecordOriginalCSeq records the caller's CSeq number before it is shifted.
func (m *TransactionManager) RecordOriginalCSeq(callID string, method sip.RequestMethod, seq uint32) {
	m.mu.Lock()
	defer m.mu.Unlock()
	seqs := m.originalCSeqs[callID]
	if seqs == nil {
		seqs = map[sip.RequestMethod]uint32{}
		m.originalCSeqs[callID] = seqs
	}
	seqs[method] = seq
}

// OriginalCSeq returns the caller's CSeq number and whether one was recorded.
func (m *TransactionManager) OriginalCSeq(callID string, method sip.RequestMethod) (uint32, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	seq, ok := m.originalCSeqs[callID][method]
	return seq, ok
}

// RemoveOriginalCSeq drops a recorded CSeq number.
func (m *TransactionManager) RemoveOriginalCSeq(callID string, method sip.RequestMethod) {
	m.mu.Lock()
	defer m.mu.Unlock()
	seqs, ok := m.originalCSeqs[callID]
	if !ok {
		return
	}
	delete(seqs, method)
	if len(seqs) == 0 {
		delete(m.originalCSeqs, callID)
	}
}

// PutTransactions stores the pair a request was forwarded on.
func (m *TransactionManager) PutTransactions(callID string, client *sip.ClientTx, server *sip.ServerTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clients[callID] = client
	if server != nil {
		m.servers[callID] = server
	} else {
		delete(m.servers, callID)
	}
	if client != nil && server != nil {
		m.link(client, server)
	}
}

// link records that client answers for server, in both indexes. The caller
// holds mu.
func (m *TransactionManager) link(client *sip.ClientTx, server *sip.ServerTx) {
	m.unlink(client)
	m.serverByClient[client] = server
	clients := m.clientsByServer[server]
	if clients == nil {
		clients = map[*sip.ClientTx]struct{}{}
		m.clientsByServer[server] = clients
	}
	clients[client] = struct{}{}
}

// unlink forgets client's server transaction, in both indexes. The caller
// holds mu.
func (m *TransactionManager) unlink(client *sip.ClientTx) {
	server, ok := m.serverByClient[client]
	if !ok {
		return
	}
	delete(m.serverByClient, client)
	clients := m.clientsByServer[server]
	delete(clients, client)
	if len(clients) == 0 {
		delete(m.clientsByServer, server)
	}
}

// ClientTransaction returns the last client transaction of a call.
func (m *TransactionManager) ClientTransaction(callID string) *sip.ClientTx {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.clients[callID]
}

// ServerTransaction returns the last server transaction of a call.
func (m *TransactionManager) ServerTransaction(callID string) *sip.ServerTx {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.servers[callID]
}

// ServerTransactionFor returns the server transaction a client transaction
// forwards for, or nil.
func (m *TransactionManager) ServerTransactionFor(client *sip.ClientTx) *sip.ServerTx {
	if client == nil {
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.serverByClient[client]
}

// RemoveClientTransaction releases the slots a terminated client transaction
// still holds.
func (m *TransactionManager) RemoveClientTransaction(callID string, tx *sip.ClientTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.clients[callID] == tx {
		delete(m.clients, callID)
	}
	m.unlink(tx)
}

// RemoveServerTransaction releases the slots a terminated server transaction
// still holds: its call slot and every pairing that answered for it, found
// through the reverse index rather than a scan of the pairings.
func (m *TransactionManager) RemoveServerTransaction(callID string, tx *sip.ServerTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.servers[callID] == tx {
		delete(m.servers, callID)
	}
	for client := range m.clientsByServer[tx] {
		delete(m.serverByClient, client)
	}
	delete(m.clientsByServer, tx)
}

// RemoveDialog releases the dialog-scoped state.
func (m *TransactionManager) RemoveDialog(callID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.dialogs, callID)
	delete(m.cseqOffsets, callID)
	delete(m.cancelledAt, callID)
	delete(m.originalCSeqs, callID)
}

// UpdateClientTransaction replaces the call's client transaction after an
// authentication retry, moving the server pairing of the challenged
// transaction to the retry.
func (m *TransactionManager) UpdateClientTransaction(callID string, previous, client *sip.ClientTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if server, ok := m.serverByClient[previous]; ok {
		m.unlink(previous)
		m.link(client, server)
	}
	m.clients[callID] = client
}
