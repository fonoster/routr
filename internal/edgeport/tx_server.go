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
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/emiago/sipgo/sip"
	"go.opentelemetry.io/otel/trace"
)

type serverState uint8

const (
	// An INVITE starts in Proceeding, anything else in Trying
	serverTrying serverState = iota
	serverProceeding
	serverCompleted
	serverConfirmed
	// RFC 6026: a 2xx was sent, the transaction waits for retransmissions
	serverAccepted
	serverTerminated
)

// serverMaxAge is the backstop on a server transaction that nothing ends: a
// request the processor answered only with a provisional response. Everything
// else ends well before it (64*T1 after the last client transaction).
const serverMaxAge = 2 * time.Hour

// ServerTx is one server transaction: RFC 3261 sections 17.2.1 and 17.2.2 with
// RFC 6026's Accepted state, as a struct in the table driven by the messages that
// arrive and the wheel. It owns no goroutine.
//
// What sipgo's ServerTx does and this one doesn't: a 1xx, 2xx or final response
// passed to a Completed transaction is dropped, not kept to be retransmitted on
// the next Timer G; and a CANCEL's own response goes through the state machine.
//
// mu is never held over a write that depends on a peer. A write that may block
// (a stream, or no connection yet) goes in outbox and leaves after mu is
// released, in order, by whichever goroutine queued first; the wheel only takes
// mu, so no timer of any transaction waits on a socket.
type ServerTx struct {
	layer *txLayer
	key   string
	// origin is read by anyone and changed by no one
	origin   *sip.Request
	conn     sip.Connection
	invite   bool
	reliable bool

	mu         sync.Mutex
	state      serverState
	last       *sip.Response
	err        error
	g          time.Duration
	notify     bool
	abandoning bool
	// failed: this INVITE transaction reached Completed, its final is not a 2xx
	failed bool
	// outbox is what waits to be written with mu released; writing says a
	// goroutine is on it, and that goroutine tells the layer of the end
	outbox  []*sip.Response
	writing bool

	trying, retransmit, life, abandoned wheelTimer

	// The EdgePort's bookkeeping. final: a final response was asked to be sent,
	// by the processor's path; a 487 of the state machine's doesn't count. ctx and
	// span are set before the transaction's first work is queued and never again;
	// span is nil with telemetry off
	final    atomic.Bool
	released atomic.Bool
	ctx      context.Context
	span     trace.Span
}

// Origin is the request that made the transaction.
func (tx *ServerTx) Origin() *sip.Request { return tx.origin }

// Err is why the transaction ended, or nil.
func (tx *ServerTx) Err() error {
	tx.mu.Lock()
	defer tx.mu.Unlock()
	return tx.err
}

// start arms what a new transaction starts with. The caller holds nothing:
// the transaction may already be in the table.
func (tx *ServerTx) start() {
	tx.mu.Lock()
	defer tx.mu.Unlock()
	if tx.state == serverTerminated {
		return
	}
	if tx.invite {
		tx.layer.wheel.schedule(&tx.trying, sip.Timer_1xx, tx, timerTrying)
	}
	tx.layer.wheel.schedule(&tx.abandoned, serverMaxAge, tx, timerAbandon)
}

// unlock writes what is waiting, releases mu, then tells the layer if the
// transaction just ended. While another goroutine is writing, the telling stays
// for it: the layer drops the connection, and what is queued goes first. On the
// wheel's goroutine there is never anything to write: a timer doesn't queue
// (fireTimer), and a writer never leaves the outbox with anything in it.
func (tx *ServerTx) unlock() {
	_ = tx.flushLocked()
	notify := tx.notify && !tx.writing
	if notify {
		tx.notify = false
	}
	tx.mu.Unlock()
	if notify {
		tx.layer.serverEnded(tx)
	}
}

// endLocked terminates the transaction. The caller holds mu and leaves through
// unlock.
func (tx *ServerTx) endLocked(err error) {
	if tx.state == serverTerminated {
		return
	}
	tx.state = serverTerminated
	if tx.err == nil {
		tx.err = err
	}
	wheel := tx.layer.wheel
	wheel.cancel(&tx.trying)
	wheel.cancel(&tx.retransmit)
	wheel.cancel(&tx.life)
	wheel.cancel(&tx.abandoned)
	tx.notify = true
}

// mayBlock tells a write that can wait on a peer or on DNS from a datagram sent
// on the listening socket, which waits on neither.
func (tx *ServerTx) mayBlock() bool {
	return tx.reliable || tx.conn == nil
}

// sendLocked sends res as the state's response: at once on a datagram socket,
// else from the outbox. A failure ends the transaction unless the state keeps
// going after one (Accepted, RFC 6026 section 7.1).
func (tx *ServerTx) sendLocked(res *sip.Response) error {
	if tx.mayBlock() {
		tx.outbox = append(tx.outbox, res)
		return nil
	}
	if err := tx.conn.WriteMsg(res); err != nil {
		return tx.sendFailedLocked(err)
	}
	return nil
}

func (tx *ServerTx) sendFailedLocked(err error) error {
	err = fmt.Errorf("%w. %w", err, sip.ErrTransactionTransport)
	switch tx.state {
	case serverAccepted, serverTerminated:
		tx.err = err
	default:
		tx.endLocked(err)
	}
	return err
}

// flushLocked writes the outbox with mu released around each write, and returns
// the last failure. A goroutine that finds a writer at it leaves what it queued
// to that writer, so order holds and nobody waits for anybody else's peer.
func (tx *ServerTx) flushLocked() error {
	if tx.writing || len(tx.outbox) == 0 {
		return nil
	}
	tx.writing = true
	var failed error
	for len(tx.outbox) > 0 {
		res := tx.outbox[0]
		tx.outbox = tx.outbox[1:]
		tx.mu.Unlock()
		err := tx.layer.writeOut(tx.conn, res)
		tx.mu.Lock()
		if err != nil {
			failed = tx.sendFailedLocked(err)
		}
	}
	tx.outbox = nil
	tx.writing = false
	return failed
}

// completeInviteLocked is the move to Completed on a 300+: G on an unreliable
// transport, and H.
func (tx *ServerTx) completeInviteLocked(res *sip.Response) error {
	tx.state = serverCompleted
	tx.failed = true
	tx.last = res
	if err := tx.sendLocked(res); err != nil {
		return err
	}
	wheel := tx.layer.wheel
	if !tx.reliable {
		tx.g = sip.Timer_G
		wheel.schedule(&tx.retransmit, tx.g, tx, timerRetransmit)
	}
	wheel.schedule(&tx.life, sip.Timer_H, tx, timerLife)
	return nil
}

// Respond sends a response the transaction's state takes and drops any other.
// It is safe from any goroutine; it may block on a stream transport's write,
// with mu released and for no longer than that transport's write timeout.
func (tx *ServerTx) Respond(res *sip.Response) error {
	tx.mu.Lock()
	defer tx.unlock()
	tx.layer.wheel.cancel(&tx.trying)
	if tx.state == serverTerminated {
		if tx.err != nil {
			return tx.err
		}
		return sip.ErrTransactionTerminated
	}
	err := tx.respondLocked(res)
	if ferr := tx.flushLocked(); err == nil {
		err = ferr
	}
	return err
}

// heldFailure tells whether this INVITE transaction answered with a non-2xx
// final, whatever came of the transaction since.
func (tx *ServerTx) heldFailure() bool {
	tx.mu.Lock()
	defer tx.mu.Unlock()
	return tx.failed
}

// awaitingFinal tells whether a final response made here would still leave: none
// was asked for, and the state takes one.
func (tx *ServerTx) awaitingFinal() bool {
	if tx.final.Load() {
		return false
	}
	tx.mu.Lock()
	defer tx.mu.Unlock()
	return tx.state == serverTrying || tx.state == serverProceeding
}

func (tx *ServerTx) respondLocked(res *sip.Response) error {
	provisional := res.StatusCode < 200
	success := res.StatusCode >= 200 && res.StatusCode < 300
	if tx.invite {
		switch tx.state {
		case serverProceeding:
			switch {
			case provisional:
				tx.last = res
				return tx.sendLocked(res)
			case success:
				tx.state = serverAccepted
				tx.last = res
				err := tx.sendLocked(res)
				tx.layer.wheel.schedule(&tx.life, sip.Timer_L, tx, timerLife)
				return err
			default:
				return tx.completeInviteLocked(res)
			}
		case serverAccepted:
			if success {
				// RFC 6026 section 7.1: the TU's retransmission goes out
				tx.last = res
				return tx.sendLocked(res)
			}
		}
		return nil
	}
	switch tx.state {
	case serverTrying, serverProceeding:
		tx.last = res
		if provisional {
			tx.state = serverProceeding
			return tx.sendLocked(res)
		}
		tx.state = serverCompleted
		if err := tx.sendLocked(res); err != nil {
			return err
		}
		if tx.reliable {
			tx.endLocked(sip.ErrTransactionTerminated)
			return nil
		}
		// Over UDP the response stays for Timer J, to answer the request's
		// retransmissions: on its own when it can (tx_answered.go), so the
		// transaction ends here as it does over a connection
		if tx.layer.keepAnswer(tx, res) {
			tx.endLocked(sip.ErrTransactionTerminated)
			return nil
		}
		tx.layer.wheel.schedule(&tx.life, sip.Timer_J, tx, timerLife)
	}
	return nil
}

// receive takes a request that matched the transaction: a retransmission, the
// ACK or the CANCEL. It runs on the goroutine that read the message and doesn't
// wait on anything but its own write.
func (tx *ServerTx) receive(req *sip.Request) {
	tx.mu.Lock()
	defer tx.unlock()
	tx.layer.wheel.cancel(&tx.trying)
	switch {
	case req.Method == tx.origin.Method:
		if tx.last != nil && (tx.state == serverProceeding || tx.state == serverCompleted) {
			_ = tx.sendLocked(tx.last)
		}
	case req.IsAck():
		switch tx.state {
		case serverCompleted:
			wheel := tx.layer.wheel
			wheel.cancel(&tx.retransmit)
			wheel.cancel(&tx.life)
			tx.state = serverConfirmed
			// The ACK to a failure ends here (RFC 3261 section 17.2.1). Completed
			// holds a non-2xx even when the processor's path asked for a 2xx that
			// was dropped, a 2xx crossing a CANCEL
			if tx.reliable {
				tx.endLocked(sip.ErrTransactionTerminated)
			} else {
				wheel.schedule(&tx.life, sip.Timer_I, tx, timerLife)
			}
		case serverAccepted:
			tx.layer.hooks.serverAck(tx, req)
		}
	case req.IsCancel():
		if tx.invite && tx.state == serverProceeding {
			// Told before the 487 leaves: the caller's next move can't beat the mark
			tx.layer.hooks.serverCancel(tx, req)
			tx.err = sip.ErrTransactionCanceled
			res := sip.NewResponseFromRequest(tx.origin, sip.StatusRequestTerminated, "Request Terminated", nil)
			tx.layer.aimResponse(res)
			_ = tx.completeInviteLocked(res)
		}
	}
}

// Terminate ends the transaction now, with no response.
func (tx *ServerTx) Terminate() {
	tx.mu.Lock()
	defer tx.unlock()
	tx.endLocked(sip.ErrTransactionTerminated)
}

// abandon ends the transaction after d unless a final response is sent by then.
func (tx *ServerTx) abandon(d time.Duration) {
	tx.mu.Lock()
	defer tx.mu.Unlock()
	if tx.state == serverTerminated || tx.abandoning || tx.final.Load() {
		return
	}
	tx.abandoning = true
	tx.layer.wheel.schedule(&tx.abandoned, d, tx, timerAbandon)
}

// fireTimer implements timerTarget. It runs on the wheel's goroutine, and what
// may block leaves it: the 100 Trying over a stream, and anything with no
// connection to write on.
func (tx *ServerTx) fireTimer(kind timerKind, gen uint32) {
	tx.mu.Lock()
	defer tx.unlock()
	switch kind {
	case timerTrying:
		if gen != tx.trying.gen || tx.state != serverProceeding || tx.last != nil {
			return
		}
		res := sip.NewResponseFromRequest(tx.origin, sip.StatusTrying, "Trying", nil)
		tx.layer.aimResponse(res)
		if tx.mayBlock() {
			tx.layer.async(func() { _ = tx.Respond(res) })
			return
		}
		tx.last = res
		_ = tx.sendLocked(res)
	case timerRetransmit:
		if gen != tx.retransmit.gen || tx.state != serverCompleted {
			return
		}
		if tx.conn == nil {
			last := tx.last
			tx.layer.async(func() { _ = tx.layer.writeNoConn(last) })
		} else if tx.sendLocked(tx.last) != nil {
			return
		}
		tx.g *= 2
		if tx.g > sip.T2 {
			tx.g = sip.T2
		}
		tx.layer.wheel.schedule(&tx.retransmit, tx.g, tx, timerRetransmit)
	case timerLife:
		if gen == tx.life.gen {
			tx.endLocked(sip.ErrTransactionTerminated)
		}
	case timerAbandon:
		if gen == tx.abandoned.gen && !tx.final.Load() {
			tx.endLocked(sip.ErrTransactionTerminated)
		}
	}
}
