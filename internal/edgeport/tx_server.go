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

	trying, retransmit, life, abandoned wheelTimer

	// The EdgePort's bookkeeping. final and code: the last final response asked
	// to be sent, by the processor's path; a 487 of the state machine's doesn't
	// count. ctx and span are set before the transaction's first work is queued
	// and never again; span is nil with telemetry off
	final    atomic.Bool
	code     atomic.Int32
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

// unlock releases mu, then tells the layer if the transaction just ended.
func (tx *ServerTx) unlock() {
	notify := tx.notify
	tx.notify = false
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

func (tx *ServerTx) writeLocked(res *sip.Response) error {
	if tx.conn == nil {
		return tx.layer.writeNoConn(res)
	}
	return tx.conn.WriteMsg(res)
}

// sendLocked sends res as the state's response: a failure ends the transaction
// unless the state keeps going after one (Accepted, RFC 6026 section 7.1).
func (tx *ServerTx) sendLocked(res *sip.Response) error {
	err := tx.writeLocked(res)
	if err == nil {
		return nil
	}
	err = fmt.Errorf("%w. %w", err, sip.ErrTransactionTransport)
	if tx.state == serverAccepted {
		tx.err = err
		return err
	}
	tx.endLocked(err)
	return err
}

// completeInviteLocked is the move to Completed on a 300+: G on an unreliable
// transport, and H.
func (tx *ServerTx) completeInviteLocked(res *sip.Response) error {
	tx.state = serverCompleted
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
// It is safe from any goroutine; it may block on a stream transport's write.
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
	return tx.respondLocked(res)
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
			if tx.reliable {
				tx.endLocked(sip.ErrTransactionTerminated)
			} else {
				wheel.schedule(&tx.life, sip.Timer_I, tx, timerLife)
			}
			tx.layer.hooks.serverAck(tx, req)
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

// fireTimer implements timerTarget. It runs on the wheel's goroutine: only the
// 100 Trying can write to a stream, and that leaves the wheel.
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
		if tx.reliable {
			tx.layer.async(func() { _ = tx.Respond(res) })
			return
		}
		tx.last = res
		_ = tx.sendLocked(res)
	case timerRetransmit:
		if gen != tx.retransmit.gen || tx.state != serverCompleted {
			return
		}
		if tx.sendLocked(tx.last) != nil {
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
