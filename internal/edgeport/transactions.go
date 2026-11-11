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

// DefaultMaxDialogs and DefaultDialogIdle bound the dialog table.
const (
	DefaultMaxDialogs = 500_000
	// A dialog whose BYE this EdgePort never saw (a far end that vanished, a BYE
	// that went another way) can't stay forever. An idle day is past any call
	// that sends nothing (session timers refresh far sooner), and a refresh or
	// any in-dialog request starts the day again.
	DefaultDialogIdle = 24 * time.Hour
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
	// minIdleMarksToCompact keeps a quiet EdgePort from rebuilding its idle
	// queue for a few marks
	minIdleMarksToCompact = 1024
)

// dialogTargets is where the requests of a dialog may go: its Contacts, as
// updated by target refreshes, and the proxies of its Record-Route.
type dialogTargets struct {
	targets []string
	// established: a 2xx answered the INVITE and no BYE ended the dialog yet.
	// Only then deadline is the idle one, which activity pushes back
	established bool
	deadline    time.Time
	// marked: deadline is in idleMarks
	marked bool
	// ended: RemoveDialog ended it, here or on the EdgePort that shared it
	ended bool
	// shared: the dialog was established, so its record is what the EdgePorts
	// that keep their dialogs in one place read (dialog_share.go). A change to
	// it is told to onShare
	shared bool
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
	clients map[string]*ClientTx
	servers map[string]*ServerTx
	// the server transaction each client transaction answers for
	serverByClient map[*ClientTx]*ServerTx
	// the reverse of serverByClient: the client transactions that answer for
	// a server transaction, so releasing it needn't scan the pairings
	clientsByServer map[*ServerTx]map[*ClientTx]struct{}

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
	// endedMarks is the same for dialogs that ended: their entries are what a
	// full table gives up first, oldest first, so this queue is what it reads
	endedMarks []dialogMark
	// idleMarks is the same for established dialogs, whose deadlines are
	// dialogIdle from when they were set. Its own queue, because the two
	// durations don't keep one in order
	idleMarks []dialogMark
	// dialogIdle is how long an established dialog lasts with no activity;
	// maxDialogs how many entries targets may hold
	dialogIdle time.Duration
	maxDialogs int

	// onShare is told the call of every shared dialog that changed, with mu
	// held: it must only take note. Nil when the dialogs stay in this process
	onShare func(callID string)

	now func() time.Time
}

// NewTransactionManager returns an empty manager with the default limits.
func NewTransactionManager() *TransactionManager {
	return NewBoundedTransactionManager(DefaultMaxDialogs, DefaultDialogIdle)
}

// NewBoundedTransactionManager is NewTransactionManager with the limits given;
// zero or less takes the default.
func NewBoundedTransactionManager(maxDialogs int, dialogIdle time.Duration) *TransactionManager {
	if maxDialogs <= 0 {
		maxDialogs = DefaultMaxDialogs
	}
	if dialogIdle <= 0 {
		dialogIdle = DefaultDialogIdle
	}
	return &TransactionManager{
		maxDialogs:      maxDialogs,
		dialogIdle:      dialogIdle,
		clients:         map[string]*ClientTx{},
		servers:         map[string]*ServerTx{},
		serverByClient:  map[*ClientTx]*ServerTx{},
		clientsByServer: map[*ServerTx]map[*ClientTx]struct{}{},
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
	now := m.now()
	m.expireDialogTargets(now)
	m.dialogs[callID] = true
	entry := m.targets[callID]
	if entry == nil {
		// A dialog with no targets yet still has to expire with the others
		entry = &dialogTargets{}
		m.targets[callID] = entry
	}
	entry.established = true
	entry.ended = false
	first := !entry.shared
	entry.shared = true
	m.idleDialog(callID, entry, now)
	if first {
		m.share(callID)
	}
}

// share tells onShare that a shared dialog changed. The caller holds mu.
func (m *TransactionManager) share(callID string) {
	if m.onShare != nil {
		m.onShare(callID)
	}
}

// CanCreateDialog tells whether the table has room for this call's dialog. The
// caller answers 503 when it hasn't; a dialog already there always fits. A full
// table first gives up the oldest dialog that already ended: those only wait out
// dialogLinger, and at a steady 2,000 calls/s they alone would fill the default
// table and refuse calls with hardly any dialog alive.
func (m *TransactionManager) CanCreateDialog(callID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.expireDialogTargets(m.now())
	if _, ok := m.targets[callID]; ok {
		return true
	}
	return len(m.targets) < m.maxDialogs || m.evictEndedDialog()
}

// evictEndedDialog forgets the oldest dialog still lingering after its end and
// tells whether there was one. A mark that no longer matches its entry's
// deadline was superseded and goes for good: amortized O(1) per mark. The caller
// holds mu.
func (m *TransactionManager) evictEndedDialog() bool {
	for len(m.endedMarks) > 0 {
		mark := m.endedMarks[0]
		m.endedMarks = m.endedMarks[1:]
		entry := m.targets[mark.callID]
		if entry != nil && !entry.established && entry.deadline.Equal(mark.at) {
			m.forgetCall(mark.callID)
			return true
		}
	}
	m.endedMarks = nil
	return false
}

// idleDialog gives an established dialog its idle deadline. The queue takes a
// mark only when the deadline moved by more than 1/64 of the idle time, so a
// chatty dialog doesn't fill it; the deadline in the entry is always one with a
// mark. The caller holds mu.
func (m *TransactionManager) idleDialog(callID string, entry *dialogTargets, now time.Time) {
	deadline := now.Add(m.dialogIdle)
	if !entry.deadline.IsZero() && entry.marked && deadline.Sub(entry.deadline) < m.dialogIdle/64 {
		return
	}
	entry.deadline = deadline
	entry.marked = true
	m.idleMarks = append(m.idleMarks, dialogMark{callID: callID, at: deadline})
	if entry.shared {
		// The shared record expires with this deadline: it moves too
		m.share(callID)
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
	added := false
	for _, uri := range uris {
		if entry.add(targetKey(uri)) {
			added = true
		}
	}
	if added && entry.shared {
		m.share(callID)
	}
	if !entry.established && create {
		m.lingerDialogTargets(callID, entry, now)
	}
	if entry.established {
		m.idleDialog(callID, entry, now)
	}
}

// add adds a target and tells whether it was new.
func (d *dialogTargets) add(key string) bool {
	for _, target := range d.targets {
		if target == key {
			return false
		}
	}
	if len(d.targets) == maxDialogTargets {
		d.targets = append(d.targets[:0], d.targets[1:]...)
	}
	d.targets = append(d.targets, key)
	return true
}

// IsDialogTarget tells whether the EdgePort knows the dialog and whether the
// URI is one of its targets.
func (m *TransactionManager) IsDialogTarget(callID string, uri sip.Uri) (known, target bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry := m.targets[callID]
	now := m.now()
	if entry == nil || now.After(entry.deadline) {
		return false, false
	}
	if entry.established {
		// Any request on the dialog counts as activity
		m.idleDialog(callID, entry, now)
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
	entry.marked = false
	entry.deadline = now.Add(dialogLinger)
	m.targetMarks = append(m.targetMarks, dialogMark{callID: callID, at: entry.deadline})
}

// expireDialogTargets forgets the dialogs past their deadline, and with them
// everything kept under the call. All deadlines in a queue are the same time
// from when they were set, so its marks are in order and this stops at the first
// one still ahead: amortized O(1) per mark. The caller holds mu.
func (m *TransactionManager) expireDialogTargets(now time.Time) {
	m.targetMarks = m.expireLingering(m.targetMarks, now)
	m.endedMarks = m.expireLingering(m.endedMarks, now)

	i := 0
	for ; i < len(m.idleMarks); i++ {
		mark := m.idleMarks[i]
		if now.Before(mark.at) {
			break
		}
		entry := m.targets[mark.callID]
		if entry == nil || !entry.established || !entry.deadline.Equal(mark.at) {
			continue
		}
		m.forgetCall(mark.callID)
	}
	if i == len(m.idleMarks) {
		m.idleMarks = nil
	} else {
		m.idleMarks = m.idleMarks[i:]
	}
	m.compactIdleMarks()
}

// compactIdleMarks drops the idle marks nothing uses. A dialog that ends (or
// whose deadline moves) leaves its old mark in the queue until that deadline,
// dialogIdle (a day) away, and each mark pins its Call-ID: at a steady 1,300
// calls/s that is hundreds of MB an hour. The queue is rebuilt, in order, once
// it is over twice the entries there are plus a floor, so it never holds more
// than about that many marks and a rebuild is amortized O(1) per mark. The
// caller holds mu.
func (m *TransactionManager) compactIdleMarks() {
	if len(m.idleMarks) <= 2*len(m.targets)+minIdleMarksToCompact {
		return
	}
	live := make([]dialogMark, 0, len(m.targets))
	for _, mark := range m.idleMarks {
		entry := m.targets[mark.callID]
		if entry != nil && entry.established && entry.marked && entry.deadline.Equal(mark.at) {
			live = append(live, mark)
		}
	}
	m.idleMarks = live
}

// expireLingering is expireDialogTargets for one queue of entries that aren't
// established, and returns what is left of the queue. The caller holds mu.
func (m *TransactionManager) expireLingering(marks []dialogMark, now time.Time) []dialogMark {
	i := 0
	for ; i < len(marks); i++ {
		mark := marks[i]
		if now.Before(mark.at) {
			break
		}
		entry := m.targets[mark.callID]
		if entry != nil && !entry.established && entry.deadline.Equal(mark.at) {
			m.forgetCall(mark.callID)
		}
	}
	if i == len(marks) {
		return nil
	}
	return marks[i:]
}

// forgetCall drops what the manager keeps under a dialog. The caller holds mu.
func (m *TransactionManager) forgetCall(callID string) {
	delete(m.targets, callID)
	delete(m.dialogs, callID)
	delete(m.cseqOffsets, callID)
	delete(m.originalCSeqs, callID)
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
	defer m.mu.Unlock()
	m.cseqOffsets[callID]++
	// What has no dialog (a REGISTER, a MESSAGE) has no BYE to release this: an
	// entry with no targets gives it the idle expiry
	now := m.now()
	entry := m.targets[callID]
	if entry == nil {
		entry = &dialogTargets{established: true}
		m.targets[callID] = entry
	}
	if entry.established {
		m.idleDialog(callID, entry, now)
	}
	if entry.shared {
		m.share(callID)
	}
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
func (m *TransactionManager) PutTransactions(callID string, client *ClientTx, server *ServerTx) {
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
func (m *TransactionManager) link(client *ClientTx, server *ServerTx) {
	m.unlink(client)
	m.serverByClient[client] = server
	clients := m.clientsByServer[server]
	if clients == nil {
		clients = map[*ClientTx]struct{}{}
		m.clientsByServer[server] = clients
	}
	clients[client] = struct{}{}
}

// unlink forgets client's server transaction, in both indexes. The caller
// holds mu.
func (m *TransactionManager) unlink(client *ClientTx) {
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
func (m *TransactionManager) ClientTransaction(callID string) *ClientTx {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.clients[callID]
}

// ServerTransaction returns the last server transaction of a call.
func (m *TransactionManager) ServerTransaction(callID string) *ServerTx {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.servers[callID]
}

// ServerTransactionFor returns the server transaction a client transaction
// forwards for, or nil.
func (m *TransactionManager) ServerTransactionFor(client *ClientTx) *ServerTx {
	if client == nil {
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.serverByClient[client]
}

// RemoveClientTransaction releases the slots a terminated client transaction
// still holds.
func (m *TransactionManager) RemoveClientTransaction(callID string, tx *ClientTx) {
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
func (m *TransactionManager) RemoveServerTransaction(callID string, tx *ServerTx) {
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
		m.endDialog(callID, entry, now)
		if entry.shared {
			m.share(callID)
		}
	}
}

// endDialog leaves an entry its targets for dialogLinger. The caller holds mu.
func (m *TransactionManager) endDialog(callID string, entry *dialogTargets, now time.Time) {
	entry.established = false
	entry.ended = true
	entry.marked = false
	entry.deadline = now.Add(dialogLinger)
	m.endedMarks = append(m.endedMarks, dialogMark{callID: callID, at: entry.deadline})
}

// DialogRecord is what another EdgePort needs to carry on with a dialog: where
// its requests may go, whether it ended, and the CSeq offset of its downstream
// leg.
type DialogRecord struct {
	Targets    []string
	Ended      bool
	CSeqOffset int
}

// SharedDialog returns the record of a shared dialog and how long it has left,
// or false for a dialog that was never established or is past its deadline.
func (m *TransactionManager) SharedDialog(callID string) (DialogRecord, time.Duration, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry := m.targets[callID]
	now := m.now()
	if entry == nil || !entry.shared || !now.Before(entry.deadline) {
		return DialogRecord{}, 0, false
	}
	return DialogRecord{
		Targets:    append([]string(nil), entry.targets...),
		Ended:      !entry.established,
		CSeqOffset: m.cseqOffsets[callID],
	}, entry.deadline.Sub(now), true
}

// RestoreDialog takes in the record of a dialog another EdgePort established,
// or this one before it restarted, and tells whether the table holds it now. A
// dialog already here gains the record's targets; one that ended here stays
// ended, whatever an older record says. A full table refuses it, as it refuses
// a new call.
func (m *TransactionManager) RestoreDialog(callID string, rec DialogRecord) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	m.expireDialogTargets(now)
	entry := m.targets[callID]
	if entry == nil {
		if len(m.targets) >= m.maxDialogs && !m.evictEndedDialog() {
			return false
		}
		entry = &dialogTargets{}
		m.targets[callID] = entry
	}
	for _, target := range rec.Targets {
		entry.add(target)
	}
	entry.shared = true
	switch {
	case entry.ended:
	case rec.Ended:
		delete(m.dialogs, callID)
		delete(m.cseqOffsets, callID)
		delete(m.originalCSeqs, callID)
		m.endDialog(callID, entry, now)
	default:
		m.dialogs[callID] = true
		if rec.CSeqOffset > m.cseqOffsets[callID] {
			m.cseqOffsets[callID] = rec.CSeqOffset
		}
		entry.established = true
		m.idleDialog(callID, entry, now)
	}
	return true
}

// UpdateClientTransaction replaces the call's client transaction after an
// authentication retry, moving the server pairing of the challenged
// transaction to the retry.
func (m *TransactionManager) UpdateClientTransaction(callID string, previous, client *ClientTx) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if server, ok := m.serverByClient[previous]; ok {
		m.unlink(previous)
		m.link(client, server)
	}
	m.clients[callID] = client
}
