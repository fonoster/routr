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
	"strings"
	"sync"
	"time"

	"github.com/emiago/sipgo/sip"
)

// cancelMemory is how long a cancel is remembered: 64 * T1, the longest an
// INVITE client transaction can still be answered (RFC 3261 section 17.1.1.2).
const cancelMemory = 64 * 500 * time.Millisecond

const (
	// dialogLinger is how long a dialog's targets outlive its BYE, or an
	// INVITE no one answered. REFER's final NOTIFY comes after the BYE when the
	// transferor hangs up first and can wait for the new call to be answered:
	// Timer C's three minutes (RFC 3261 section 16.6), plus a margin.
	dialogLinger = 4 * time.Minute
	// maxDialogTargets bounds what one dialog can make the EdgePort keep. Each
	// target refresh may add one; past it the oldest goes.
	maxDialogTargets = 24
)

// dialogTargets is where the requests of a dialog may go: its Contacts, as
// updated by target refreshes, and the proxies of its Record-Route.
type dialogTargets struct {
	targets []string
	// established: a 2xx answered the INVITE and no BYE ended the dialog yet.
	// Only then the entry has no deadline.
	established bool
	deadline    time.Time
}

// dialogMark is one deadline of a dialog, in the order they were set.
type dialogMark struct {
	callID string
	at     time.Time
}

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
// the pairing is indexed both ways, the original CSeqs are nested by call, and
// the cancel memory and the targets of ended dialogs expire from queues, so no
// operation scans a table.
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

	// call ID -> where the dialog's requests may go
	targets map[string]*dialogTargets
	// the deadlines in the order set; one that no longer matches its entry's
	// was superseded and is skipped when it expires
	targetMarks []dialogMark

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
		targets:         map[string]*dialogTargets{},
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
	defer m.mu.Unlock()
	m.dialogs[callID] = true
	if entry := m.targets[callID]; entry != nil {
		entry.established = true
	}
}

// RecordDialogTargets adds where the dialog's requests may go. Only what
// creates a dialog, an INVITE this EdgePort forwards and the answers it gets,
// may create the entry; anything else adds to one that is there. An entry not
// established yet, or whose dialog ended, lasts dialogLinger from now.
func (m *TransactionManager) RecordDialogTargets(callID string, create bool, uris ...sip.Uri) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	m.expireDialogTargets(now)
	entry := m.targets[callID]
	if entry == nil {
		if !create {
			return
		}
		entry = &dialogTargets{}
		m.targets[callID] = entry
	}
	for _, uri := range uris {
		entry.add(targetKey(uri))
	}
	if !entry.established && create {
		m.lingerDialogTargets(callID, entry, now)
	}
}

func (d *dialogTargets) add(key string) {
	for _, target := range d.targets {
		if target == key {
			return
		}
	}
	if len(d.targets) == maxDialogTargets {
		d.targets = append(d.targets[:0], d.targets[1:]...)
	}
	d.targets = append(d.targets, key)
}

// IsDialogTarget tells whether the EdgePort knows the dialog and whether the
// URI is one of its targets.
func (m *TransactionManager) IsDialogTarget(callID string, uri sip.Uri) (known, target bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry := m.targets[callID]
	if entry == nil || (!entry.established && m.now().After(entry.deadline)) {
		return false, false
	}
	key := targetKey(uri)
	for _, t := range entry.targets {
		if t == key {
			return true, true
		}
	}
	return true, false
}

// lingerDialogTargets gives an entry its deadline. The caller holds mu.
func (m *TransactionManager) lingerDialogTargets(callID string, entry *dialogTargets, now time.Time) {
	entry.deadline = now.Add(dialogLinger)
	m.targetMarks = append(m.targetMarks, dialogMark{callID: callID, at: entry.deadline})
}

// expireDialogTargets forgets the entries past their deadline. All deadlines
// are the same time from when they were set, so the marks are in order and
// this stops at the first one still ahead: amortized O(1) per mark. The caller
// holds mu.
func (m *TransactionManager) expireDialogTargets(now time.Time) {
	i := 0
	for ; i < len(m.targetMarks); i++ {
		mark := m.targetMarks[i]
		if now.Before(mark.at) {
			break
		}
		entry := m.targets[mark.callID]
		if entry != nil && !entry.established && entry.deadline.Equal(mark.at) {
			delete(m.targets, mark.callID)
		}
	}
	if i == len(m.targetMarks) {
		m.targetMarks = nil
		return
	}
	m.targetMarks = m.targetMarks[i:]
}

// targetKey is the address a URI sends a request to: its maddr or host and its
// port, 5061 for TLS and 5060 otherwise when it names none, as NextHop reads
// them. The user is not part of it: what this guards is where a request goes.
func targetKey(uri sip.Uri) string {
	host := uri.Host
	if maddr, ok := uri.UriParams.Get("maddr"); ok && maddr != "" {
		host = maddr
	}
	port := uri.Port
	if port <= 0 {
		port = 5060
		transport, _ := uri.UriParams.Get("transport")
		if strings.EqualFold(uri.Scheme, "sips") || strings.EqualFold(transport, "tls") {
			port = 5061
		}
	}
	return strings.ToLower(strings.Trim(host, "[]")) + ":" + strconv.Itoa(port)
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

// RemoveDialog releases the dialog-scoped state. The targets stay for
// dialogLinger, for what may still follow the end of a dialog (REFER's final
// NOTIFY, a BYE sent again on a new transaction).
func (m *TransactionManager) RemoveDialog(callID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.dialogs, callID)
	delete(m.cseqOffsets, callID)
	delete(m.cancelledAt, callID)
	delete(m.originalCSeqs, callID)
	now := m.now()
	m.expireDialogTargets(now)
	if entry := m.targets[callID]; entry != nil {
		entry.established = false
		m.lingerDialogTargets(callID, entry, now)
	}
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
