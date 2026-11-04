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
	"strings"
	"sync"
	"time"

	"github.com/emiago/sipgo/sip"
)

// cancelMemory is how long a cancel is remembered: 64 * T1, the longest an
// INVITE client transaction can still be answered (RFC 3261 section 17.1.1.2).
const cancelMemory = 64 * 500 * time.Millisecond

// TransactionManager is io.routr.utils.TransactionManager: the pairing of the
// transactions a request was forwarded on, keyed by call ID and by client
// transaction, and the dialog state the EdgePort keeps.
type TransactionManager struct {
	mu sync.Mutex

	// call ID -> the last client and server transaction forwarded for it
	clients map[string]*sip.ClientTx
	servers map[string]*sip.ServerTx
	// the server transaction each client transaction answers for
	serverByClient map[*sip.ClientTx]*sip.ServerTx

	cseqOffsets   map[string]int
	originalCSeqs map[string]uint32
	dialogs       map[string]bool
	cancelledAt   map[string]time.Time

	now func() time.Time
}

// NewTransactionManager returns an empty manager.
func NewTransactionManager() *TransactionManager {
	return &TransactionManager{
		clients:        map[string]*sip.ClientTx{},
		servers:        map[string]*sip.ServerTx{},
		serverByClient: map[*sip.ClientTx]*sip.ServerTx{},
		cseqOffsets:    map[string]int{},
		originalCSeqs:  map[string]uint32{},
		dialogs:        map[string]bool{},
		cancelledAt:    map[string]time.Time{},
		now:            time.Now,
	}
}

// MarkCancelled records that the caller of a call cancelled it.
func (m *TransactionManager) MarkCancelled(callID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	for id, at := range m.cancelledAt {
		if now.Sub(at) > cancelMemory {
			delete(m.cancelledAt, id)
		}
	}
	m.cancelledAt[callID] = now
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

func cseqKey(callID string, method sip.RequestMethod) string {
	return callID + "_" + string(method)
}

// RecordOriginalCSeq records the caller's CSeq number before it is shifted.
func (m *TransactionManager) RecordOriginalCSeq(callID string, method sip.RequestMethod, seq uint32) {
	m.mu.Lock()
	m.originalCSeqs[cseqKey(callID, method)] = seq
	m.mu.Unlock()
}

// OriginalCSeq returns the caller's CSeq number and whether one was recorded.
func (m *TransactionManager) OriginalCSeq(callID string, method sip.RequestMethod) (uint32, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	seq, ok := m.originalCSeqs[cseqKey(callID, method)]
	return seq, ok
}

// RemoveOriginalCSeq drops a recorded CSeq number.
func (m *TransactionManager) RemoveOriginalCSeq(callID string, method sip.RequestMethod) {
	m.mu.Lock()
	delete(m.originalCSeqs, cseqKey(callID, method))
	m.mu.Unlock()
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
		m.serverByClient[client] = server
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
	delete(m.serverByClient, tx)
}

// RemoveServerTransaction releases the slots a terminated server transaction
// still holds.
func (m *TransactionManager) RemoveServerTransaction(callID string, tx *sip.ServerTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.servers[callID] == tx {
		delete(m.servers, callID)
	}
	for client, server := range m.serverByClient {
		if server == tx {
			delete(m.serverByClient, client)
		}
	}
}

// RemoveDialog releases the dialog-scoped state.
func (m *TransactionManager) RemoveDialog(callID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.dialogs, callID)
	delete(m.cseqOffsets, callID)
	delete(m.cancelledAt, callID)
	prefix := callID + "_"
	for key := range m.originalCSeqs {
		if strings.HasPrefix(key, prefix) {
			delete(m.originalCSeqs, key)
		}
	}
}

// UpdateClientTransaction replaces the call's client transaction after an
// authentication retry, moving the server pairing of the challenged
// transaction to the retry.
func (m *TransactionManager) UpdateClientTransaction(callID string, previous, client *sip.ClientTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if server, ok := m.serverByClient[previous]; ok {
		delete(m.serverByClient, previous)
		m.serverByClient[client] = server
	}
	m.clients[callID] = client
}
