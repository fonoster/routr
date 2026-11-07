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
	"log/slog"
	"net"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/emiago/sipgo/sip"
)

// asyncSends bounds the 100 Trying in flight on stream transports, the one
// timer whose write can block: a peer that stopped reading must not hold the wheel.
const asyncSends = 256

// The decision behind this file (ROUTR3.md § 2 and § 3.5, milestone 4). Reading
// sipgo's transaction layer: its timers are time.AfterFunc and it holds no
// goroutine per transaction. The 172,000 goroutines at 1,900 calls/s fit the
// EdgePort's own, about three per call for 32 s (1,900 * 3 * 32 = 182,400; read from
// the code, no goroutine profile was taken): the reader of ClientTx.Responses and of
// ServerTx.Acks, which sipgo's unbuffered pass-up channels force on anyone using
// them, and a waiter on abandon. So those could go by a smaller change, for
// everything but a reader until each final response. The table stays ours for
// what that change can't reach: ten timers of which sipgo gets K wrong (32 s for
// every non-INVITE client transaction, the BYE of every call), five timers, two
// mutexes, two channels and a closure each per transaction, one lock per
// direction, a `go` per message, a read loop that parses inline and a table with
// no limit. Parser and connections stay sipgo's.

// txHooks are what the layer tells the EdgePort. They run with the transaction's
// lock held or on the goroutine reading the socket: they queue, never wait.
type txHooks struct {
	// request is a new request, with its transaction; an ACK that matched none
	// has none
	request func(req *sip.Request, tx *ServerTx)
	// serverCancel is a CANCEL that matched an INVITE in Proceeding, answered
	// with 200 already; the 487 follows
	serverCancel func(tx *ServerTx, cancel *sip.Request)
	// serverAck is an ACK that matched a transaction waiting for one
	serverAck func(tx *ServerTx, ack *sip.Request)
	// serverEnd and clientEnd are the end of a transaction, outside its lock
	serverEnd func(tx *ServerTx)
	clientEnd func(tx *ClientTx)
	// clientResponse is a response to pass up, retransmitted 2xx included
	clientResponse func(tx *ClientTx, res *sip.Response)
	// stray is a response no transaction matched
	stray func(res *sip.Response)
	// overflow counts a table that refused a transaction
	overflow func(what overflowKind)
	// noConn answers on a stream whose connection is gone
	noConn func(res *sip.Response) error
}

// txLayer is the transaction table and the wheel that drives it, on sipgo's
// parser and connections.
type txLayer struct {
	tpl     *sip.TransportLayer
	wheel   *timerWheel
	servers *txTable[*ServerTx]
	clients *txTable[*ClientTx]
	hooks   txHooks
	log     *slog.Logger
	// udp is the listening socket's connection, what every server transaction
	// over UDP answers on; nil with no UDP listening point
	udp atomic.Pointer[sip.UDPConnection]

	sends chan struct{}

	closeOnce sync.Once
	started   bool
}

func newTxLayer(tpl *sip.TransportLayer, log *slog.Logger, limit int, hooks txHooks) *txLayer {
	return &txLayer{
		tpl:     tpl,
		wheel:   newTimerWheel(),
		servers: newTxTable[*ServerTx](limit),
		clients: newTxTable[*ClientTx](limit),
		hooks:   hooks,
		log:     log,
		sends:   make(chan struct{}, asyncSends),
	}
}

func (l *txLayer) start() {
	l.started = true
	l.wheel.start()
}

// Close ends every transaction; nothing it ended fires afterwards.
func (l *txLayer) Close() {
	l.closeOnce.Do(func() {
		l.wheel.Close(l.started)
		for _, tx := range l.clients.snapshot() {
			tx.Terminate()
		}
		for _, tx := range l.servers.snapshot() {
			tx.Terminate()
		}
	})
}

// async runs a send that may block away from the wheel, up to asyncSends at
// once; past that it is dropped. Only a 100 Trying comes here, which a request
// retransmission and the real answer both make up for.
func (l *txLayer) async(fn func()) {
	select {
	case l.sends <- struct{}{}:
		go func() {
			defer func() { <-l.sends }()
			safely(l.log, fn)
		}()
	default:
		l.hooks.overflow(overflowAsyncSends)
	}
}

// handle takes a parsed message: on a parsing worker for UDP, on the connection's
// reader for a stream.
func (l *txLayer) handle(msg sip.Message) {
	switch m := msg.(type) {
	case *sip.Request:
		l.handleRequest(m)
	case *sip.Response:
		l.handleResponse(m)
	}
}

func (l *txLayer) handleRequest(req *sip.Request) {
	if req.IsCancel() {
		// A CANCEL is answered here when it matches its INVITE (RFC 3261 section 9.2)
		key, err := serverTxKey(req, sip.INVITE)
		if err != nil {
			l.rejectMalformed(req, err)
			return
		}
		if tx, ok := l.servers.get(key); ok {
			res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", nil)
			l.aimResponse(res)
			if err := l.writeStateless(tx.conn, res); err != nil {
				l.log.Error("failed to respond 200 for CANCEL", "error", err)
				return
			}
			tx.receive(req)
			return
		}
	}
	key, err := serverTxKey(req, "")
	if err != nil {
		l.rejectMalformed(req, err)
		return
	}
	if tx, ok := l.servers.get(key); ok {
		tx.receive(req)
		return
	}
	if req.IsAck() {
		// The ACK to a 2xx is its own transaction, one with no state here
		l.hooks.request(req, nil)
		return
	}
	conn := l.serverConnection(req)
	tx := &ServerTx{
		layer:    l,
		key:      key,
		origin:   req,
		conn:     conn,
		invite:   req.IsInvite(),
		reliable: sip.IsReliable(req.Transport()),
	}
	if !tx.invite {
		tx.state = serverTrying
	} else {
		tx.state = serverProceeding
	}
	existing, exists, err := l.servers.insert(key, tx)
	if err != nil {
		l.releaseConn(conn)
		l.hooks.overflow(overflowTransactions)
		l.rejectOverload(req, conn)
		return
	}
	if exists {
		l.releaseConn(conn)
		existing.receive(req)
		return
	}
	tx.start()
	l.hooks.request(req, tx)
}

func (l *txLayer) handleResponse(res *sip.Response) {
	key, err := sip.ClientTxKeyMake(res)
	if err != nil {
		l.log.Error("client tx failed to handle response", "error", err)
		return
	}
	if tx, ok := l.clients.get(key); ok {
		tx.receive(res)
		return
	}
	l.hooks.stray(res)
}

// request starts a client transaction for req. The transaction carries info
// from before its first byte goes out, so its answer finds it complete.
func (l *txLayer) request(ctx context.Context, req *sip.Request, callID string, server *ServerTx, creds *Credentials) (*ClientTx, error) {
	if req.IsAck() {
		return nil, fmt.Errorf("ACK request must be sent directly through transport")
	}
	key, err := sip.ClientTxKeyMake(req)
	if err != nil {
		return nil, err
	}
	conn, err := l.tpl.ClientRequestConnection(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("client transaction failed to request connection: %w", err)
	}
	tx := &ClientTx{
		layer:    l,
		key:      key,
		origin:   req,
		conn:     conn,
		invite:   req.IsInvite(),
		reliable: sip.IsReliable(req.Transport()),
	}
	tx.info.callID = callID
	tx.info.server = server
	tx.info.creds = creds
	_, exists, err := l.clients.insert(key, tx)
	if err != nil {
		_, _ = conn.TryClose()
		l.hooks.overflow(overflowTransactions)
		return nil, err
	}
	if exists {
		_, _ = conn.TryClose()
		return nil, fmt.Errorf("client transaction %q already exists", key)
	}
	if err := tx.start(); err != nil {
		return nil, err
	}
	return tx, nil
}

func (l *txLayer) serverEnded(tx *ServerTx) {
	l.servers.remove(tx.key)
	l.releaseConn(tx.conn)
	l.hooks.serverEnd(tx)
}

func (l *txLayer) clientEnded(tx *ClientTx) {
	l.clients.remove(tx.key)
	if _, err := tx.conn.TryClose(); err != nil {
		l.log.Info("closing connection returned error", "error", err)
	}
	l.hooks.clientEnd(tx)
}

// serverConnection is the connection the answers of a request go on: the
// listening socket for UDP, and the connection it arrived on for a stream
// (RFC 3261 section 18.2.2). Nil when that connection is gone already; writeNoConn
// then tries the Via.
func (l *txLayer) serverConnection(req *sip.Request) sip.Connection {
	if !sip.IsReliable(req.Transport()) {
		if udp := l.udp.Load(); udp != nil {
			return udp
		}
	}
	conn, err := l.tpl.GetConnection(req.Transport(), req.Source())
	if err != nil {
		l.log.Debug("no connection to answer on", "source", req.Source(), "error", err)
		return nil
	}
	return conn
}

// releaseConn drops the reference a transaction held. The listening socket's
// connection is the layer's own and holds no count.
func (l *txLayer) releaseConn(conn sip.Connection) {
	if conn == nil {
		return
	}
	if udp, ok := conn.(*sip.UDPConnection); ok && udp == l.udp.Load() {
		return
	}
	if _, err := conn.TryClose(); err != nil {
		l.log.Info("closing connection returned error", "error", err)
	}
}

func (l *txLayer) writeNoConn(res *sip.Response) error {
	return l.hooks.noConn(res)
}

func (l *txLayer) writeStateless(conn sip.Connection, res *sip.Response) error {
	if conn == nil {
		return l.writeNoConn(res)
	}
	return conn.WriteMsg(res)
}

// aimResponse points a response the stack makes at the top Via (RFC 3581): where
// it says, when that is an address. A name stays what sipgo aimed it at, the
// request's source: no wheel or reader waits on DNS.
func (l *txLayer) aimResponse(res *sip.Response) {
	hop, ok := ResponseHop(res)
	if !ok {
		return
	}
	host := strings.Trim(hop.Host, "[]")
	if net.ParseIP(host) != nil {
		res.SetDestination(net.JoinHostPort(host, strconv.Itoa(hop.Port)))
	}
}

// rejectMalformed is sipgo's stateless 400 to a request it can't make a key of:
// without it the sender retransmits for 32 s.
func (l *txLayer) rejectMalformed(req *sip.Request, reason error) {
	l.log.Error("server tx failed to handle request", "error", reason, "req", req.StartLine())
	res := sip.NewResponseFromRequest(req, sip.StatusBadRequest, "Bad Request", nil)
	l.answerStateless(req, res)
}

// rejectOverload answers a request the table can't hold: 503, which RFC 3261
// section 21.5.4 gives exactly this meaning. No state is kept, so the
// sender's retransmissions get it again or, if room appeared, a transaction.
func (l *txLayer) rejectOverload(req *sip.Request, conn sip.Connection) {
	res := sip.NewResponseFromRequest(req, sip.StatusServiceUnavailable, ReasonPhrase(sip.StatusServiceUnavailable), nil)
	l.aimResponse(res)
	if conn != nil && !sip.IsReliable(req.Transport()) {
		if err := conn.WriteMsg(res); err != nil {
			l.log.Debug("unable to send the 503 of a full table", "error", err)
		}
		return
	}
	l.answerStateless(req, res)
}

func (l *txLayer) answerStateless(req *sip.Request, res *sip.Response) {
	l.aimResponse(res)
	conn := l.serverConnection(req)
	defer l.releaseConn(conn)
	if err := l.writeStateless(conn, res); err != nil {
		l.log.Debug("unable to answer statelessly", "code", res.StatusCode, "error", err)
	}
}
