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
	"bytes"
	"context"
	"crypto/tls"
	"log/slog"
	"net"
	"sync"
	"time"
)

// wsUpgradeHeadLimit is the largest HTTP upgrade request head a WS or WSS
// client may send: the read buffer of the upgrader sipgo uses.
const wsUpgradeHeadLimit = 4096

// wsGate stands between a WS or WSS listening point and sipgo, whose Serve
// accepts a connection and runs its WebSocket upgrade before accepting the
// next: one client that sends nothing kept every other one waiting. The gate
// accepts on its own, and on a goroutine per connection waits for the TLS
// handshake (WSS) and the whole upgrade request head, at most
// wsUpgradeHeadLimit bytes, within wsUpgradeTimeout of the accept. Only then
// does sipgo's Accept get the connection, which replays what was read, so
// its upgrade reads from memory. A connection that overruns either limit is
// closed and never reaches sipgo.
//
// The listener under it is the capped one (conn_limit.go), so a connection
// counts against maxConnections from its accept and the goroutines waiting
// here are bounded by the cap.
type wsGate struct {
	net.Listener
	// tls is the server configuration of a WSS listening point: the listener
	// is raw TCP and the handshake runs here. Nil for WS.
	tls *tls.Config
	// idle is the read deadline a connection is handed over with, as the
	// capped listener gives every stream connection
	idle time.Duration
	log  *slog.Logger

	ready  chan net.Conn
	closed chan struct{}
	close  sync.Once

	mu      sync.Mutex
	pending map[net.Conn]struct{}
	admits  sync.WaitGroup
}

// gated starts the gate of a WS (tlsConfig nil) or WSS listening point over
// its capped listener. Closing the gate closes the listener and stops it.
func (e *EdgePort) gated(l net.Listener, tlsConfig *tls.Config) *wsGate {
	g := &wsGate{
		Listener: l,
		tls:      tlsConfig,
		idle:     e.idleTimeout,
		log:      e.log,
		ready:    make(chan net.Conn),
		closed:   make(chan struct{}),
		pending:  map[net.Conn]struct{}{},
	}
	go g.accept()
	return g
}

// accept is the gate's own accept loop; it ends when the listener is closed.
func (g *wsGate) accept() {
	for {
		conn, err := g.Listener.Accept()
		if err != nil {
			// The capped listener only fails once closed
			g.shut()
			return
		}
		if !g.track(conn) {
			_ = conn.Close()
			return
		}
		go g.admit(conn)
	}
}

// track remembers a connection waiting in the gate, so closing the gate
// closes it; false when the gate is already closed.
func (g *wsGate) track(conn net.Conn) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	select {
	case <-g.closed:
		return false
	default:
	}
	g.pending[conn] = struct{}{}
	g.admits.Add(1)
	return true
}

func (g *wsGate) untrack(conn net.Conn) {
	g.mu.Lock()
	delete(g.pending, conn)
	g.mu.Unlock()
	g.admits.Done()
}

// admit waits for one connection's handshake and upgrade request head, under
// one deadline, and hands it to sipgo; anything else closes it.
func (g *wsGate) admit(raw net.Conn) {
	defer g.untrack(raw)
	// connectionIdleTimeout still bounds a silent connection when it is the
	// shorter of the two
	deadline := time.Now().Add(min(wsUpgradeTimeout, g.idle))
	if err := raw.SetDeadline(deadline); err != nil {
		_ = raw.Close()
		return
	}
	conn := raw
	if g.tls != nil {
		secure := tls.Server(raw, g.tls)
		ctx, cancel := context.WithDeadline(context.Background(), deadline)
		err := secure.HandshakeContext(ctx)
		cancel()
		if err != nil {
			g.log.Debug("websocket connection closed before its tls handshake", "remote", raw.RemoteAddr().String(), "error", err)
			_ = raw.Close()
			return
		}
		conn = secure
	}
	head, ok := readUpgradeHead(conn)
	if !ok {
		g.log.Debug("websocket connection closed before its upgrade request", "remote", raw.RemoteAddr().String())
		_ = conn.Close()
		return
	}
	// sipgo's reads set their own deadline from here on; writes have theirs
	if err := raw.SetDeadline(time.Time{}); err == nil {
		err = raw.SetReadDeadline(time.Now().Add(g.idle))
		if err != nil {
			_ = conn.Close()
			return
		}
	}
	select {
	case g.ready <- &replayConn{Conn: conn, head: head}:
	case <-g.closed:
		_ = conn.Close()
	}
}

// readUpgradeHead reads up to the blank line that ends an HTTP request head;
// false when the connection ends, its deadline passes or wsUpgradeHeadLimit
// bytes arrive without one.
func readUpgradeHead(conn net.Conn) ([]byte, bool) {
	head := make([]byte, 0, wsUpgradeHeadLimit)
	for len(head) < wsUpgradeHeadLimit {
		n, err := conn.Read(head[len(head):wsUpgradeHeadLimit])
		// The end may straddle two reads: look from three bytes back
		from := len(head) - 3
		if from < 0 {
			from = 0
		}
		head = head[:len(head)+n]
		if bytes.Contains(head[from:], []byte("\r\n\r\n")) {
			return head, true
		}
		if err != nil {
			return nil, false
		}
	}
	return nil, false
}

// Accept gives sipgo the next connection whose upgrade request is all here.
// It fails only once the gate is closed, with net.ErrClosed: any other error
// would end sipgo's Serve and stop the EdgePort.
func (g *wsGate) Accept() (net.Conn, error) {
	select {
	case conn := <-g.ready:
		return conn, nil
	case <-g.closed:
		return nil, net.ErrClosed
	}
}

// Close closes the listener and every connection still waiting in the gate.
func (g *wsGate) Close() error {
	err := g.shut()
	g.admits.Wait()
	return err
}

// shut closes the gate without waiting for its goroutines.
func (g *wsGate) shut() error {
	var err error
	g.close.Do(func() {
		g.mu.Lock()
		close(g.closed)
		waiting := make([]net.Conn, 0, len(g.pending))
		for conn := range g.pending {
			waiting = append(waiting, conn)
		}
		g.mu.Unlock()
		err = g.Listener.Close()
		for _, conn := range waiting {
			_ = conn.Close()
		}
	})
	return err
}

// replayConn is a connection whose first bytes were already read: Read gives
// them back before reading on.
type replayConn struct {
	net.Conn
	head []byte
}

func (c *replayConn) Read(b []byte) (int, error) {
	if len(c.head) > 0 {
		n := copy(b, c.head)
		c.head = c.head[n:]
		return n, nil
	}
	return c.Conn.Read(b)
}
