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
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/emiago/sipgo/sip"
)

type clientState uint8

const (
	clientCalling clientState = iota
	clientProceeding
	clientCompleted
	// RFC 6026: a 2xx was passed up, the transaction waits for retransmissions
	clientAccepted
	clientTerminated
)

// timerC is the proxy's Timer C (RFC 3261 sections 16.6 step 11 and 16.8): an
// INVITE a far end answered with a 1xx and then forgot is cancelled when it
// fires. The RFC asks for more than three minutes; T2 (4 s) on top covers the
// far end's longest retransmission gap. Every provisional response resets it.
// It is armed from the first provisional on: before one, Timer B (64*T1) fires
// first anyway, so arming it at the forward would change nothing.
const timerC = 3*time.Minute + 4*time.Second

// clientInfo is what the EdgePort keeps with a client transaction.
type clientInfo struct {
	callID string
	server *ServerTx
	creds  *Credentials
	// replaced is set when an authentication retry took over the server
	// transaction, which then no longer depends on this one
	replaced atomic.Bool
	// byeSent: the leg of a 2xx that crossed a CANCEL got its one BYE
	byeSent atomic.Bool
	// failover is what the processor said of the initial INVITE this
	// transaction carries: the Trunk URIs tried so far, while another one
	// remains (failover.go). Like progressed, it is only read and written in
	// the call's queue.
	failover failoverState
	// progressed: a provisional response other than 100 was relayed to the
	// caller, so the call can no longer move to another URI
	progressed bool
}

// ClientTx is one client transaction: RFC 3261 sections 17.1.1 and 17.1.2 with
// RFC 6026's Accepted state, as a struct in the table driven by the messages that
// arrive and the wheel. It owns no goroutine.
//
// What sipgo's ClientTx does and this one doesn't: Timer K is T4 as RFC 3261
// says, not 32 s, and an ACK to a retransmitted failure goes out at once, not
// after T2 with the transaction's lock held.
//
// mu is never held over a stream write: see ServerTx.
type ClientTx struct {
	layer *txLayer
	key   string
	// origin is read by anyone and changed by no one once the request is sent
	origin   *sip.Request
	conn     sip.Connection
	invite   bool
	reliable bool

	mu     sync.Mutex
	state  clientState
	err    error
	a      time.Duration
	notify bool
	// held is a CANCEL waiting for the first provisional (RFC 3261 section 9.1)
	held *sip.Request
	// cancelled: Timer C fired and the CANCEL went; the 487 is what's awaited
	cancelled bool
	// outbox and writing: as on ServerTx
	outbox  []*sip.Request
	writing bool

	retransmit, life wheelTimer

	info     clientInfo
	released atomic.Bool
}

// Origin is the request the transaction sent.
func (tx *ClientTx) Origin() *sip.Request { return tx.origin }

// Err is why the transaction ended, or nil.
func (tx *ClientTx) Err() error {
	tx.mu.Lock()
	defer tx.mu.Unlock()
	return tx.err
}

func (tx *ClientTx) unlock() {
	_ = tx.flushLocked()
	notify := tx.notify && !tx.writing
	if notify {
		tx.notify = false
	}
	tx.mu.Unlock()
	if notify {
		tx.layer.clientEnded(tx)
	}
}

func (tx *ClientTx) endLocked(err error) {
	if tx.state == clientTerminated {
		return
	}
	tx.state = clientTerminated
	if tx.err == nil {
		tx.err = err
	}
	tx.held = nil
	wheel := tx.layer.wheel
	wheel.cancel(&tx.retransmit)
	wheel.cancel(&tx.life)
	tx.notify = true
}

// sendLocked sends req: at once on a datagram socket, else from the outbox.
func (tx *ClientTx) sendLocked(req *sip.Request) error {
	if tx.reliable {
		tx.outbox = append(tx.outbox, req)
		return nil
	}
	if err := tx.conn.WriteMsg(req); err != nil {
		return tx.sendFailedLocked(err)
	}
	return nil
}

func (tx *ClientTx) sendFailedLocked(err error) error {
	err = fmt.Errorf("%w. %w", err, sip.ErrTransactionTransport)
	tx.endLocked(err)
	return err
}

// flushLocked writes the outbox with mu released around each write, and returns
// the last failure; see ServerTx.flushLocked.
func (tx *ClientTx) flushLocked() error {
	if tx.writing || len(tx.outbox) == 0 {
		return nil
	}
	tx.writing = true
	var failed error
	for len(tx.outbox) > 0 {
		req := tx.outbox[0]
		tx.outbox = tx.outbox[1:]
		tx.mu.Unlock()
		err := tx.layer.writeOut(tx.conn, req)
		tx.mu.Lock()
		if err != nil {
			tx.layer.log.Error("send request failed", "req", req.Short(), "error", err)
			failed = tx.sendFailedLocked(err)
		}
	}
	tx.outbox = nil
	tx.writing = false
	return failed
}

// start arms A or E and B or F, then sends the request, so an answer that races
// the first write finds the timers armed.
func (tx *ClientTx) start() error {
	tx.mu.Lock()
	defer tx.unlock()
	wheel := tx.layer.wheel
	if !tx.reliable {
		tx.a = sip.Timer_A
		wheel.schedule(&tx.retransmit, tx.a, tx, timerRetransmit)
	}
	wheel.schedule(&tx.life, sip.Timer_B, tx, timerLife)
	if err := tx.sendLocked(tx.origin); err != nil {
		return err
	}
	return tx.flushLocked()
}

// holdCancel takes the CANCEL of this INVITE and says whether it goes now. RFC
// 3261 section 9.1: not before a provisional, so it waits for the first one; and
// not after a final response, so it stops there. A held CANCEL goes through the
// clientCancel hook, or is discarded on a final response or on Timer B. A
// transaction that isn't an INVITE's has no such rule.
func (tx *ClientTx) holdCancel(cancel *sip.Request) bool {
	tx.mu.Lock()
	defer tx.unlock()
	if !tx.invite {
		return true
	}
	switch tx.state {
	case clientCalling:
		tx.held = cancel
		return false
	case clientProceeding:
		tx.cancelLocked()
		return true
	}
	return false
}

// cancelLocked notes that a CANCEL goes out for this INVITE, the caller's or
// Timer C's, and waits Timer B for the 487 (RFC 3261 section 9.1). A far end
// that never sends it, as SEET's caller-cancel UAS doesn't, then ends the
// transaction as a timeout; Timer C never cancels it a second time, which
// would hit whoever listens at that address three minutes later.
func (tx *ClientTx) cancelLocked() {
	tx.cancelled = true
	tx.layer.wheel.schedule(&tx.life, sip.Timer_B, tx, timerLife)
}

// receive takes a response that matched the transaction. It runs on the
// goroutine that read the message; passing up only queues.
func (tx *ClientTx) receive(res *sip.Response) {
	tx.mu.Lock()
	defer tx.unlock()
	provisional := res.StatusCode < 200
	success := res.StatusCode >= 200 && res.StatusCode < 300
	wheel := tx.layer.wheel
	if tx.invite {
		switch tx.state {
		case clientCalling, clientProceeding:
			switch {
			case provisional:
				if tx.state == clientCalling {
					tx.state = clientProceeding
					wheel.cancel(&tx.retransmit)
				}
				if !tx.cancelled {
					wheel.schedule(&tx.life, timerC, tx, timerLife)
				}
				tx.layer.hooks.clientResponse(tx, res)
				if held := tx.held; held != nil {
					tx.held = nil
					tx.cancelLocked()
					tx.layer.hooks.clientCancel(tx, held)
				}
			case success:
				tx.state = clientAccepted
				tx.held = nil
				tx.layer.hooks.clientResponse(tx, res)
				wheel.cancel(&tx.retransmit)
				wheel.schedule(&tx.life, sip.Timer_M, tx, timerLife)
			default:
				tx.state = clientCompleted
				tx.held = nil
				tx.ackLocked(res)
				tx.layer.hooks.clientResponse(tx, res)
				wheel.cancel(&tx.retransmit)
				if tx.reliable {
					// Timer D is zero over a stream
					tx.endLocked(sip.ErrTransactionTerminated)
				} else if tx.state != clientTerminated {
					wheel.schedule(&tx.life, sip.Timer_D, tx, timerLife)
				}
			}
		case clientAccepted:
			if success {
				// The 2xx again: a proxy relays it (RFC 6026 section 7.2)
				tx.layer.hooks.clientResponse(tx, res)
			}
		case clientCompleted:
			if !provisional && !success {
				tx.ackLocked(res)
			}
		}
		return
	}
	switch tx.state {
	case clientCalling, clientProceeding:
		if provisional {
			tx.state = clientProceeding
			tx.a = sip.T2
			tx.layer.hooks.clientResponse(tx, res)
			return
		}
		tx.state = clientCompleted
		tx.layer.hooks.clientResponse(tx, res)
		wheel.cancel(&tx.retransmit)
		if tx.reliable {
			// Timer K is zero over a stream
			tx.endLocked(sip.ErrTransactionTerminated)
			return
		}
		wheel.schedule(&tx.life, sip.Timer_K, tx, timerLife)
	}
}

// ackLocked sends the ACK to a failure, on the transaction's connection and to
// where the INVITE went.
func (tx *ClientTx) ackLocked(res *sip.Response) {
	if err := tx.sendLocked(newFailureAck(tx.origin, res, tx.reliable)); err != nil {
		tx.layer.log.Error("send ACK request failed", "invite", tx.origin.Short(), "response", res.Short(), "error", err)
	}
}

// newFailureAck is the ACK of RFC 3261 section 17.1.1.3: one Via, the INVITE's
// top one, and otherwise sipgo's, header for header. A destination that is a
// name was resolved when the INVITE was sent, and the ACK must go to the same
// address: only a clone carries that.
func newFailureAck(invite *sip.Request, res *sip.Response, reliable bool) *sip.Request {
	ack := sip.NewRequest(sip.ACK, *invite.Recipient.Clone())
	ack.SipVersion = invite.SipVersion
	if via := invite.Via(); via != nil {
		ack.AppendHeader(via.Clone())
	}
	if len(invite.GetHeaders("Route")) > 0 {
		sip.CopyHeaders("Route", invite, ack)
	}
	maxForwards := sip.MaxForwardsHeader(70)
	ack.AppendHeader(&maxForwards)
	if h := invite.From(); h != nil {
		ack.AppendHeader(sip.HeaderClone(h))
	}
	if h := res.To(); h != nil {
		ack.AppendHeader(sip.HeaderClone(h))
	}
	if h := invite.CallID(); h != nil {
		ack.AppendHeader(sip.HeaderClone(h))
	}
	if h := invite.CSeq(); h != nil {
		ack.AppendHeader(&sip.CSeqHeader{SeqNo: h.SeqNo, MethodName: sip.ACK})
	}
	if h := invite.Contact(); h != nil {
		ack.AppendHeader(sip.HeaderClone(h))
	}
	ack.SetBody(nil)
	ack.SetTransport(invite.Transport())
	ack.SetSource(invite.Source())
	ack.SetDestination(invite.Destination())
	ack.Laddr = invite.Laddr
	if reliable {
		return ack
	}
	return toResolvedAddress(invite, ack)
}

// toResolvedAddress makes out, which belongs to invite's transaction, go to the
// address invite went to. Only a clone of the INVITE carries an address resolved
// from a name, and it needs to be written on the INVITE's connection: asking the
// transport layer for one resolves the name again.
func toResolvedAddress(invite, out *sip.Request) *sip.Request {
	if destinationIsIP(invite.Destination()) {
		return out
	}
	resolved := invite.Clone()
	resolved.Method = out.Method
	for _, h := range invite.Headers() {
		resolved.RemoveHeader(h.Name())
	}
	for _, h := range out.Headers() {
		resolved.AppendHeader(h)
	}
	resolved.SetBody(nil)
	return resolved
}

func destinationIsIP(destination string) bool {
	host, _, err := net.SplitHostPort(destination)
	if err != nil {
		host = destination
	}
	return net.ParseIP(host) != nil
}

// Terminate ends the transaction now.
func (tx *ClientTx) Terminate() {
	tx.mu.Lock()
	defer tx.unlock()
	tx.err = sip.ErrTransactionCanceled
	tx.endLocked(sip.ErrTransactionTerminated)
}

// fireTimer implements timerTarget.
func (tx *ClientTx) fireTimer(kind timerKind, gen uint32) {
	tx.mu.Lock()
	defer tx.unlock()
	switch kind {
	case timerRetransmit:
		if gen != tx.retransmit.gen || (tx.state != clientCalling && tx.state != clientProceeding) {
			return
		}
		if tx.invite {
			// Timer A doubles with no cap
			tx.a *= 2
		} else {
			// Timer E: doubles to T2, and T2 from the first 1xx on
			tx.a *= 2
			if tx.a > sip.T2 {
				tx.a = sip.T2
			}
		}
		if err := tx.conn.WriteMsg(tx.origin); err != nil {
			tx.endLocked(fmt.Errorf("%w. %w", err, sip.ErrTransactionTransport))
			return
		}
		tx.layer.wheel.schedule(&tx.retransmit, tx.a, tx, timerRetransmit)
	case timerLife:
		if gen != tx.life.gen {
			return
		}
		switch tx.state {
		case clientProceeding:
			if tx.invite && !tx.cancelled {
				// Timer C with a provisional received (RFC 3261 section 16.8):
				// the CANCEL goes downstream and the caller gets its 408
				// through the hook; the transaction waits Timer B more for
				// the 487 and its ACK, so the far end's leg ends cleanly
				tx.cancelLocked()
				tx.layer.hooks.clientTimerC(tx)
				return
			}
			fallthrough
		case clientCalling:
			name := "Timer_B"
			switch {
			case !tx.invite:
				name = "Timer_F"
			case tx.cancelled:
				name = "Timer_C"
			}
			tx.endLocked(fmt.Errorf("%s timed out. %w", name, sip.ErrTransactionTimeout))
		default:
			tx.endLocked(sip.ErrTransactionTerminated)
		}
	}
}
