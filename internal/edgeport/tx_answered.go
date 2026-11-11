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
	"net"
	"net/netip"
	"sync"

	"github.com/emiago/sipgo/sip"
)

// answeredPerTransaction is how many answered transactions the layer keeps for
// each transaction its limit allows. One is the bytes of a response and a key:
// about a sixth of what the transaction that sent it held.
const answeredPerTransaction = 4

// answeredTx is what a non-INVITE server transaction over UDP leaves behind in
// Completed (RFC 3261 section 17.2.2): its final response as it was sent, and
// where to, to send again when the request is retransmitted, until Timer J.
//
// The transaction itself ends when that response leaves, as it does over a
// connection. Kept whole for Timer J's 32 s, with its request, its response and
// their headers, it was most of the EdgePort's memory under load and what its
// garbage collector spent its time on: at 16,000 requests a second, 3 GB and the
// whole transaction table.
//
// It has no lock: it is written before it is in the table and only read after.
type answeredTx struct {
	layer *txLayer
	key   string
	conn  *sip.UDPConnection
	addr  netip.AddrPort
	raw   []byte
	life  wheelTimer
}

// answerBuffers are where a response is written out before it is copied, at its
// own size, into what is kept.
var answerBuffers = sync.Pool{New: func() any { return new(bytes.Buffer) }}

// keepAnswer leaves res in the answered table for tx, which the caller then
// ends, and tells whether it did. It doesn't when the table is full, or the
// response didn't go to an address on the listening socket: the transaction
// then waits out Timer J itself.
func (l *txLayer) keepAnswer(tx *ServerTx, res *sip.Response) bool {
	udp, ok := tx.conn.(*sip.UDPConnection)
	if !ok || udp == nil {
		return false
	}
	// Where UDPConnection.WriteMsg sent it
	host, port, err := sip.ParseAddr(res.Destination())
	if err != nil {
		return false
	}
	ip, err := netip.ParseAddr(host)
	if err != nil || ip.Zone() != "" || port < 0 || port > 65535 {
		return false
	}
	if port == 0 {
		port = sip.DefaultUdpPort
	}
	buf := answerBuffers.Get().(*bytes.Buffer)
	buf.Reset()
	res.StringWrite(buf)
	raw := append([]byte(nil), buf.Bytes()...)
	answerBuffers.Put(buf)
	a := &answeredTx{layer: l, key: tx.key, conn: udp, addr: netip.AddrPortFrom(ip, uint16(port)), raw: raw}
	if _, exists, err := l.answered.insert(tx.key, a); err != nil || exists {
		return false
	}
	l.wheel.schedule(&a.life, sip.Timer_J, a, timerLife)
	return true
}

// resend answers a retransmission of the request with the response it got.
func (a *answeredTx) resend() {
	if _, err := a.conn.WriteTo(a.raw, net.UDPAddrFromAddrPort(a.addr)); err != nil {
		a.layer.log.Debug("unable to send a final response again", "error", err)
	}
}

// fireTimer implements timerTarget: Timer J, the only timer it has.
func (a *answeredTx) fireTimer(kind timerKind, _ uint32) {
	if kind == timerLife {
		a.layer.answered.remove(a.key)
	}
}
