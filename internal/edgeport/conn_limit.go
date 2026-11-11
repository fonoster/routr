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
	"errors"
	"log/slog"
	"net"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// connectionCap counts the TCP, TLS, WS and WSS connections accepted at once,
// over every listening point.
type connectionCap struct {
	max    int64
	active atomic.Int64
}

// capped wraps a stream listener: past the cap a connection is closed before
// any read or handshake, and each accepted one gets a read deadline of the
// idle timeout, so a WS or WSS client that never sends its upgrade request is
// closed too (sipgo's Read replaces the deadline once it reads).
func (e *EdgePort) capped(l net.Listener) net.Listener {
	return &cappedListener{Listener: l, conns: e.conns, idle: e.idleTimeout,
		overflow: func() { e.overflowed(overflowConnections) }}
}

type cappedListener struct {
	net.Listener
	conns    *connectionCap
	idle     time.Duration
	overflow func()
}

// Accept returns an error only when the listener does: any error ends sipgo's
// Serve, and with it the EdgePort, so a connection past the cap is closed and
// counted, and the loop goes on.
func (l *cappedListener) Accept() (net.Conn, error) {
	for {
		conn, err := l.Listener.Accept()
		if err != nil {
			return nil, err
		}
		if l.conns.active.Add(1) > l.conns.max {
			l.conns.active.Add(-1)
			_ = conn.Close()
			l.overflow()
			continue
		}
		c := &cappedConn{Conn: conn, conns: l.conns}
		if err := conn.SetReadDeadline(time.Now().Add(l.idle)); err != nil {
			_ = c.Close()
			continue
		}
		return c, nil
	}
}

// cappedConn gives its slot back on its first Close, whoever calls it.
type cappedConn struct {
	net.Conn
	conns   *connectionCap
	release sync.Once
}

func (c *cappedConn) Close() error {
	c.release.Do(func() { c.conns.active.Add(-1) })
	return c.Conn.Close()
}

// idleCloseHandler is sipgo's log handler: a read that failed on its deadline
// is a connection idle past connectionIdleTimeout, closed on purpose, so it is
// logged at Debug instead of the Error sipgo gives every read error ("Read
// error", "Got TCP error", "Fail to upgrade"). It matches the error, not the
// message.
type idleCloseHandler struct {
	slog.Handler
}

func (h idleCloseHandler) Handle(ctx context.Context, r slog.Record) error {
	var deadline error
	r.Attrs(func(a slog.Attr) bool {
		if err, ok := a.Value.Any().(error); ok && a.Key == "error" && errors.Is(err, os.ErrDeadlineExceeded) {
			deadline = err
			return false
		}
		return true
	})
	if deadline == nil {
		return h.Handler.Handle(ctx, r)
	}
	if !h.Handler.Enabled(ctx, slog.LevelDebug) {
		return nil
	}
	idle := slog.NewRecord(r.Time, slog.LevelDebug, "connection idle, closed", r.PC)
	idle.AddAttrs(slog.String("remote", remoteOf(deadline)))
	return h.Handler.Handle(ctx, idle)
}

func (h idleCloseHandler) Enabled(ctx context.Context, level slog.Level) bool {
	// A deadline error comes at Error and may leave at Debug
	return h.Handler.Enabled(ctx, level)
}

func (h idleCloseHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return idleCloseHandler{h.Handler.WithAttrs(attrs)}
}

func (h idleCloseHandler) WithGroup(name string) slog.Handler {
	return idleCloseHandler{h.Handler.WithGroup(name)}
}

// remoteOf is the peer address a network error names, empty when it names
// none.
func remoteOf(err error) string {
	var op *net.OpError
	if errors.As(err, &op) && op.Addr != nil {
		return op.Addr.String()
	}
	return ""
}

// IdleTimeout is how long a stream connection may receive nothing.
func (e *EdgePort) IdleTimeout() time.Duration { return e.idleTimeout }

// MaxConnections is how many stream connections it accepts at once.
func (e *EdgePort) MaxConnections() int64 { return e.conns.max }
