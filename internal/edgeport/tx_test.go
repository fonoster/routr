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
	"errors"
	"io"
	"log/slog"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
)

// The state machines against a fake connection, with the wheel moved by hand:
// the RFC 3261 values below are the proof that A, B, D, E, F, G, H, I, J and K
// are what section 17 says, retransmission by retransmission.

const (
	inviteMsg = "INVITE sip:1002@10.0.0.9 SIP/2.0\r\n" +
		"Via: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-a;rport=5070;received=10.0.0.2\r\n" +
		"Max-Forwards: 70\r\nFrom: <sip:1001@sip.local>;tag=f1\r\nTo: <sip:1002@sip.local>\r\n" +
		"Call-ID: call-1\r\nCSeq: 1 INVITE\r\nContact: <sip:1001@10.0.0.2:5070>\r\nContent-Length: 0\r\n\r\n"
	byeMsg = "BYE sip:1002@10.0.0.9 SIP/2.0\r\n" +
		"Via: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-b;rport=5070;received=10.0.0.2\r\n" +
		"Max-Forwards: 70\r\nFrom: <sip:1001@sip.local>;tag=f1\r\nTo: <sip:1002@sip.local>;tag=t1\r\n" +
		"Call-ID: call-1\r\nCSeq: 2 BYE\r\nContent-Length: 0\r\n\r\n"
)

type fakeConn struct {
	mu      sync.Mutex
	written []sip.Message
	fail    error
	closes  int
}

func (c *fakeConn) LocalAddr() net.Addr { return &net.UDPAddr{IP: net.IPv4(10, 0, 0, 1), Port: 5060} }
func (c *fakeConn) WriteMsg(msg sip.Message) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.fail != nil {
		return c.fail
	}
	c.written = append(c.written, msg)
	return nil
}
func (c *fakeConn) Ref(int) int { return 1 }
func (c *fakeConn) TryClose() (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.closes++
	return 0, nil
}
func (c *fakeConn) Close() error { return nil }
func (c *fakeConn) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.written)
}

type txProbe struct {
	requests    []*sip.Request
	cancels     int
	acks        int
	serverEnds  int
	clientEnds  int
	responses   []*sip.Response
	strays      int
	overflows   []overflowKind
	failNoConns int
}

func newTestLayer(limit int) (*txLayer, *txProbe) {
	p := &txProbe{}
	l := newTxLayer(nil, slog.New(slog.NewTextHandler(io.Discard, nil)), limit, txHooks{
		request:        func(req *sip.Request, _ *ServerTx) { p.requests = append(p.requests, req) },
		serverCancel:   func(*ServerTx, *sip.Request) { p.cancels++ },
		serverAck:      func(*ServerTx, *sip.Request) { p.acks++ },
		serverEnd:      func(*ServerTx) { p.serverEnds++ },
		clientEnd:      func(*ClientTx) { p.clientEnds++ },
		clientResponse: func(_ *ClientTx, res *sip.Response) { p.responses = append(p.responses, res) },
		stray:          func(*sip.Response) { p.strays++ },
		overflow:       func(k overflowKind) { p.overflows = append(p.overflows, k) },
		noConn:         func(*sip.Response) error { p.failNoConns++; return errors.New("no connection") },
	})
	return l, p
}

func parseRequest(t *testing.T, text, transport string) *sip.Request {
	t.Helper()
	msg, err := sip.ParseMessage([]byte(text))
	if err != nil {
		t.Fatal(err)
	}
	req := msg.(*sip.Request)
	req.SetTransport(transport)
	req.SetSource("10.0.0.2:5070")
	req.SetDestination("10.0.0.9:5060")
	return req
}

func newServerTx(t *testing.T, l *txLayer, text, transport string) (*ServerTx, *fakeConn) {
	t.Helper()
	req := parseRequest(t, text, transport)
	key, err := serverTxKey(req, "")
	if err != nil {
		t.Fatal(err)
	}
	conn := &fakeConn{}
	tx := &ServerTx{layer: l, key: key, origin: req, conn: conn, invite: req.IsInvite(), reliable: sip.IsReliable(transport)}
	if tx.invite {
		tx.state = serverProceeding
	}
	if _, _, err := l.servers.insert(key, tx); err != nil {
		t.Fatal(err)
	}
	tx.start()
	return tx, conn
}

func newClientTx(t *testing.T, l *txLayer, text, transport string) (*ClientTx, *fakeConn) {
	t.Helper()
	req := parseRequest(t, text, transport)
	key, err := sip.ClientTxKeyMake(req)
	if err != nil {
		t.Fatal(err)
	}
	conn := &fakeConn{}
	tx := &ClientTx{layer: l, key: key, origin: req, conn: conn, invite: req.IsInvite(), reliable: sip.IsReliable(transport)}
	if _, _, err := l.clients.insert(key, tx); err != nil {
		t.Fatal(err)
	}
	if err := tx.start(); err != nil {
		t.Fatal(err)
	}
	return tx, conn
}

func answer(req *sip.Request, code int) *sip.Response {
	return sip.NewResponseFromRequest(req, code, "x", nil)
}

// expectWrites moves the wheel tick by tick and checks the gap before each next
// write: never under the value given, and at most the wheel's two ticks over it.
func expectWrites(t *testing.T, w *timerWheel, conn *fakeConn, base int, gaps ...time.Duration) {
	t.Helper()
	for i, gap := range gaps {
		var waited time.Duration
		for conn.count()-base == i {
			if waited > gap+2*wheelTick {
				t.Fatalf("write %d did not come within %s of the one before", i+1, gap)
			}
			w.step()
			waited += wheelTick
		}
		if waited < gap {
			t.Fatalf("write %d came %s after the one before, under %s", i+1, waited, gap)
		}
	}
}

func TestClientInviteTimerADoublesWithNoCapUntilB(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newClientTx(t, l, inviteMsg, "UDP")
	if conn.count() != 1 {
		t.Fatal("the INVITE goes out at start")
	}
	const t1 = 500 * time.Millisecond
	// A at T1, then 2T1, 4T1, 8T1, 16T1, 32T1
	expectWrites(t, l.wheel, conn, 1, t1, 2*t1, 4*t1, 8*t1, 16*t1, 32*t1)
	if p.clientEnds != 0 {
		t.Fatal("ended before B")
	}
	stepFor(l.wheel, t1+3*wheelTick)
	if p.clientEnds != 1 || !errors.Is(tx.Err(), sip.ErrTransactionTimeout) {
		t.Fatalf("B: ends %d, err %v", p.clientEnds, tx.Err())
	}
	if l.clients.len() != 0 {
		t.Error("left in the table")
	}
	if conn.closes != 1 {
		t.Error("the connection's reference was not released")
	}
}

func TestClientInviteProceedingStopsAAndBAndHasALimit(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newClientTx(t, l, inviteMsg, "UDP")
	tx.receive(answer(tx.origin, 180))
	stepFor(l.wheel, 10*time.Minute)
	if conn.count() != 1 || p.clientEnds != 0 {
		t.Fatalf("Proceeding: %d writes, %d ends", conn.count(), p.clientEnds)
	}
	stepFor(l.wheel, inviteProceedingLimit)
	if p.clientEnds != 1 {
		t.Fatal("a Proceeding INVITE has to end some day")
	}
}

func TestClientInviteFailureAcksAndTimerD(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newClientTx(t, l, inviteMsg, "UDP")
	res := answer(tx.origin, 486)
	tx.receive(res)
	if conn.count() != 2 || !conn.written[1].(*sip.Request).IsAck() {
		t.Fatal("the ACK goes out with the failure")
	}
	if len(p.responses) != 1 {
		t.Fatal("the failure goes up once")
	}
	// A retransmission of the failure gets the ACK again, at once, and stays down
	tx.receive(res)
	if conn.count() != 3 || len(p.responses) != 1 {
		t.Fatalf("%d writes, %d responses", conn.count(), len(p.responses))
	}
	stepFor(l.wheel, 32*time.Second-wheelTick)
	if p.clientEnds != 0 {
		t.Fatal("D is 32 s")
	}
	stepFor(l.wheel, 3*wheelTick)
	if p.clientEnds != 1 {
		t.Fatal("D did not fire")
	}
	ack := conn.written[1].(*sip.Request)
	if ack.Via().Params == nil || ack.CSeq().MethodName != sip.ACK || ack.To() == nil {
		t.Errorf("ACK: %s", ack)
	}
	if ack.Destination() != "10.0.0.9:5060" {
		t.Errorf("the ACK goes where the INVITE went: %s", ack.Destination())
	}
}

func TestClientInvite2xxAcceptedPassesRetransmissionsUntilM(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newClientTx(t, l, inviteMsg, "UDP")
	ok := answer(tx.origin, 200)
	tx.receive(ok)
	tx.receive(ok)
	if len(p.responses) != 2 {
		t.Fatalf("the 2xx and its retransmission go up: %d", len(p.responses))
	}
	if conn.count() != 1 {
		t.Fatal("the transaction doesn't ACK a 2xx")
	}
	stepFor(l.wheel, sip.Timer_M-wheelTick)
	if p.clientEnds != 0 {
		t.Fatal("M is 64*T1")
	}
	stepFor(l.wheel, 3*wheelTick)
	if p.clientEnds != 1 {
		t.Fatal("M did not fire")
	}
}

func TestClientNonInviteTimerECapsAtT2UntilF(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newClientTx(t, l, byeMsg, "UDP")
	// E at T1, 2T1, 4T1, then T2 (RFC 3261 section 17.1.2.2)
	expectWrites(t, l.wheel, conn, 1, 500*time.Millisecond, time.Second, 2*time.Second, 4*time.Second, 4*time.Second)
	stepFor(l.wheel, 32*time.Second-11500*time.Millisecond)
	if p.clientEnds != 1 || !errors.Is(tx.Err(), sip.ErrTransactionTimeout) {
		t.Fatalf("F: ends %d, err %v", p.clientEnds, tx.Err())
	}
}

func TestClientNonInviteProceedingRetransmitsAtT2(t *testing.T) {
	l, _ := newTestLayer(0)
	tx, conn := newClientTx(t, l, byeMsg, "UDP")
	tx.receive(answer(tx.origin, 100))
	// The E already armed fires at 0.5 s; from there on, every T2
	expectWrites(t, l.wheel, conn, 1, 500*time.Millisecond, 4*time.Second, 4*time.Second)
}

func TestClientNonInviteTimerKIsT4(t *testing.T) {
	l, p := newTestLayer(0)
	tx, _ := newClientTx(t, l, byeMsg, "UDP")
	tx.receive(answer(tx.origin, 200))
	stepFor(l.wheel, sip.T4-wheelTick)
	if p.clientEnds != 0 {
		t.Fatal("K is T4")
	}
	stepFor(l.wheel, 3*wheelTick)
	if p.clientEnds != 1 {
		t.Fatal("K did not fire: sipgo holds this transaction 32 s, RFC 3261 says T4")
	}
}

func TestClientOverAStreamHasNoRetransmissionsAndEndsOnFinal(t *testing.T) {
	l, p := newTestLayer(0)
	inv, conn := newClientTx(t, l, inviteMsg, "TCP")
	stepFor(l.wheel, 10*time.Second)
	if conn.count() != 1 {
		t.Fatal("no A over a stream")
	}
	inv.receive(answer(inv.origin, 486))
	if p.clientEnds != 1 {
		t.Fatal("D is zero over a stream")
	}
	bye, _ := newClientTx(t, l, byeMsg, "TCP")
	bye.receive(answer(bye.origin, 200))
	if p.clientEnds != 2 {
		t.Fatal("K is zero over a stream")
	}
}

func TestClientTransportErrorEndsIt(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newClientTx(t, l, inviteMsg, "UDP")
	conn.fail = errors.New("boom")
	stepFor(l.wheel, time.Second)
	if p.clientEnds != 1 || !errors.Is(tx.Err(), sip.ErrTransactionTransport) {
		t.Fatalf("ends %d, err %v", p.clientEnds, tx.Err())
	}
}

func TestServerInvite100TryingAt200ms(t *testing.T) {
	l, _ := newTestLayer(0)
	_, conn := newServerTx(t, l, inviteMsg, "UDP")
	expectWrites(t, l.wheel, conn, 0, sip.Timer_1xx)
	if res := conn.written[0].(*sip.Response); res.StatusCode != 100 || res.Destination() != "10.0.0.2:5070" {
		t.Errorf("%d to %s", res.StatusCode, res.Destination())
	}
}

func TestServerInviteAnsweredBefore200msSendsNoTrying(t *testing.T) {
	l, _ := newTestLayer(0)
	tx, conn := newServerTx(t, l, inviteMsg, "UDP")
	if err := tx.Respond(answer(tx.origin, 180)); err != nil {
		t.Fatal(err)
	}
	stepFor(l.wheel, time.Second)
	if conn.count() != 1 {
		t.Fatalf("%d writes", conn.count())
	}
}

func TestServerInviteFailureTimerGAndH(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newServerTx(t, l, inviteMsg, "UDP")
	if err := tx.Respond(answer(tx.origin, 486)); err != nil {
		t.Fatal(err)
	}
	// G at T1, 2T1, 4T1, then T2 (RFC 3261 section 17.2.1)
	expectWrites(t, l.wheel, conn, 1, 500*time.Millisecond, time.Second, 2*time.Second, 4*time.Second, 4*time.Second)
	stepFor(l.wheel, 32*time.Second-11500*time.Millisecond)
	if p.serverEnds != 1 {
		t.Fatal("H did not fire")
	}
	if l.servers.len() != 0 {
		t.Error("left in the table")
	}
}

func TestServerInviteAckStopsGAndTimerIIsT4(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newServerTx(t, l, inviteMsg, "UDP")
	_ = tx.Respond(answer(tx.origin, 486))
	ack := parseRequest(t, inviteMsg, "UDP")
	ack.Method = sip.ACK
	tx.receive(ack)
	if p.acks != 1 {
		t.Fatal("the ACK is told")
	}
	writes := conn.count()
	stepFor(l.wheel, sip.T4-wheelTick)
	if conn.count() != writes {
		t.Fatal("G stops on the ACK")
	}
	if p.serverEnds != 0 {
		t.Fatal("I is T4")
	}
	stepFor(l.wheel, 3*wheelTick)
	if p.serverEnds != 1 {
		t.Fatal("I did not fire")
	}
}

func TestServerInviteRetransmissionGetsTheLastResponse(t *testing.T) {
	l, _ := newTestLayer(0)
	tx, conn := newServerTx(t, l, inviteMsg, "UDP")
	tx.receive(parseRequest(t, inviteMsg, "UDP"))
	if conn.count() != 0 {
		t.Fatal("nothing to retransmit yet")
	}
	_ = tx.Respond(answer(tx.origin, 180))
	tx.receive(parseRequest(t, inviteMsg, "UDP"))
	if conn.count() != 2 || conn.written[1].(*sip.Response).StatusCode != 180 {
		t.Fatalf("%d writes", conn.count())
	}
}

func TestServerInvite2xxAcceptedHasTimerLAndNoRetransmissions(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newServerTx(t, l, inviteMsg, "UDP")
	_ = tx.Respond(answer(tx.origin, 200))
	tx.receive(parseRequest(t, inviteMsg, "UDP"))
	if conn.count() != 1 {
		t.Fatal("a request retransmitted in Accepted is absorbed")
	}
	// The TU's retransmission goes out (RFC 6026 section 7.1)
	_ = tx.Respond(answer(tx.origin, 200))
	if conn.count() != 2 {
		t.Fatal("the TU's 2xx goes out")
	}
	ack := parseRequest(t, inviteMsg, "UDP")
	ack.Method = sip.ACK
	tx.receive(ack)
	if p.acks != 1 {
		t.Fatal("an ACK on the INVITE's branch goes up")
	}
	stepFor(l.wheel, sip.Timer_L-wheelTick)
	if conn.count() != 2 || p.serverEnds != 0 {
		t.Fatalf("%d writes, %d ends", conn.count(), p.serverEnds)
	}
	stepFor(l.wheel, 3*wheelTick)
	if p.serverEnds != 1 {
		t.Fatal("L did not fire")
	}
}

func TestServerInviteCancelSends487(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newServerTx(t, l, inviteMsg, "UDP")
	cancel := parseRequest(t, inviteMsg, "UDP")
	cancel.Method = sip.CANCEL
	tx.receive(cancel)
	if p.cancels != 1 {
		t.Fatal("the CANCEL is told")
	}
	res := conn.written[0].(*sip.Response)
	if res.StatusCode != 487 {
		t.Fatalf("got %d", res.StatusCode)
	}
	tag, ok := res.To().Params.Get("tag")
	if !ok || tag == "" {
		t.Error("the stack's 487 carries a To tag (README, known differences)")
	}
	// A second CANCEL finds it Completed
	tx.receive(cancel)
	if p.cancels != 1 {
		t.Fatal("told twice")
	}
	// What the far end answers next is dropped
	_ = tx.Respond(answer(tx.origin, 200))
	if conn.count() != 1 {
		t.Fatal("a Completed transaction sends what it sent")
	}
}

func TestServerNonInviteTimerJAndRetransmission(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newServerTx(t, l, byeMsg, "UDP")
	tx.receive(parseRequest(t, byeMsg, "UDP"))
	if conn.count() != 0 {
		t.Fatal("Trying absorbs")
	}
	stepFor(l.wheel, time.Second)
	if conn.count() != 0 {
		t.Fatal("a non-INVITE gets no 100 from the stack")
	}
	_ = tx.Respond(answer(tx.origin, 200))
	tx.receive(parseRequest(t, byeMsg, "UDP"))
	if conn.count() != 2 {
		t.Fatal("Completed answers a retransmission")
	}
	stepFor(l.wheel, sip.Timer_J-wheelTick)
	if p.serverEnds != 0 {
		t.Fatal("J is 64*T1")
	}
	stepFor(l.wheel, 3*wheelTick)
	if p.serverEnds != 1 {
		t.Fatal("J did not fire")
	}
}

func TestServerOverAStream(t *testing.T) {
	l, p := newTestLayer(0)
	bye, conn := newServerTx(t, l, byeMsg, "TCP")
	_ = bye.Respond(answer(bye.origin, 200))
	if p.serverEnds != 1 {
		t.Fatal("J is zero over a stream")
	}
	if conn.closes != 1 {
		t.Fatal("the connection's reference was not released")
	}
	inv, conn := newServerTx(t, l, inviteMsg, "TCP")
	_ = inv.Respond(answer(inv.origin, 486))
	stepFor(l.wheel, 10*time.Second)
	if conn.count() != 1 {
		t.Fatal("no G over a stream")
	}
	ack := parseRequest(t, inviteMsg, "TCP")
	ack.Method = sip.ACK
	inv.receive(ack)
	if p.serverEnds != 2 {
		t.Fatal("I is zero over a stream")
	}
}

func TestServerAbandon(t *testing.T) {
	l, p := newTestLayer(0)
	tx, _ := newServerTx(t, l, byeMsg, "UDP")
	tx.abandon(abandonAfter)
	stepFor(l.wheel, abandonAfter-wheelTick)
	if p.serverEnds != 0 {
		t.Fatal("early")
	}
	stepFor(l.wheel, 3*wheelTick)
	if p.serverEnds != 1 {
		t.Fatal("not released")
	}
	// One whose final response was sent isn't abandoned
	sent, _ := newServerTx(t, l, inviteMsg, "UDP")
	sent.final.Store(true)
	sent.abandon(time.Second)
	stepFor(l.wheel, 2*time.Second)
	if p.serverEnds != 1 {
		t.Fatal("abandoned with its final response sent")
	}
}

func TestServerRespondAfterTheEndIsAnError(t *testing.T) {
	l, _ := newTestLayer(0)
	tx, conn := newServerTx(t, l, byeMsg, "UDP")
	tx.Terminate()
	tx.Terminate()
	if err := tx.Respond(answer(tx.origin, 200)); !errors.Is(err, sip.ErrTransactionTerminated) {
		t.Fatalf("err %v", err)
	}
	if conn.count() != 0 {
		t.Fatal("wrote after the end")
	}
}

func TestServerWriteFailureEndsItExceptAccepted(t *testing.T) {
	l, p := newTestLayer(0)
	failed, conn := newServerTx(t, l, inviteMsg, "UDP")
	conn.fail = errors.New("boom")
	if err := failed.Respond(answer(failed.origin, 486)); !errors.Is(err, sip.ErrTransactionTransport) {
		t.Fatalf("err %v", err)
	}
	if p.serverEnds != 1 {
		t.Fatal("a failed send ends Completed")
	}
	accepted, conn := newServerTx(t, l, inviteMsg, "UDP")
	conn.fail = errors.New("boom")
	if err := accepted.Respond(answer(accepted.origin, 200)); err == nil {
		t.Fatal("the send's error comes back")
	}
	if p.serverEnds != 1 {
		t.Fatal("Accepted waits for the TU's retransmission (RFC 6026)")
	}
}

func TestTableLimit(t *testing.T) {
	table := newTxTable[int](2)
	for i, key := range []string{"a", "b"} {
		if _, exists, err := table.insert(key, i); err != nil || exists {
			t.Fatalf("%s: %v %v", key, exists, err)
		}
	}
	if have, exists, err := table.insert("a", 9); err != nil || !exists || have != 0 {
		t.Fatalf("taken: %v %v %v", have, exists, err)
	}
	if _, _, err := table.insert("c", 3); !errors.Is(err, errTxTableFull) {
		t.Fatalf("over the limit: %v", err)
	}
	table.remove("a")
	table.remove("a")
	if table.len() != 1 {
		t.Fatalf("len %d", table.len())
	}
	if _, _, err := table.insert("c", 3); err != nil {
		t.Fatal(err)
	}
}

func TestServerTxKeyMatchesSipgos(t *testing.T) {
	for _, text := range []string{
		inviteMsg,
		byeMsg,
		// RFC 2543: no magic cookie
		"INVITE sip:1002@10.0.0.9 SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.2;branch=old\r\nFrom: <sip:a@b>;tag=f\r\nTo: <sip:c@d>\r\nCall-ID: c\r\nCSeq: 1 INVITE\r\nContent-Length: 0\r\n\r\n",
		// No port in the Via
		"INVITE sip:1002@10.0.0.9 SIP/2.0\r\nVia: SIP/2.0/TLS 10.0.0.2;branch=z9hG4bK-x\r\nFrom: <sip:a@b>;tag=f\r\nTo: <sip:c@d>\r\nCall-ID: c\r\nCSeq: 1 INVITE\r\nContent-Length: 0\r\n\r\n",
	} {
		req := parseRequest(t, text, "UDP")
		want, err := sip.ServerTxKeyMake(req)
		if err != nil {
			t.Fatal(err)
		}
		got, err := serverTxKey(req, "")
		if err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Errorf("got %q, sipgo's %q", got, want)
		}
	}
	bad := parseRequest(t, inviteMsg, "UDP")
	bad.RemoveHeader("Via")
	if _, err := serverTxKey(bad, ""); err == nil {
		t.Error("no Via is an error")
	}
}

func TestLayerRoutesRetransmissionAndAck(t *testing.T) {
	l, p := newTestLayer(0)
	conn := &sip.UDPConnection{PacketConn: nullPacketConn{}, PacketAddr: "10.0.0.1:5060", Listener: true}
	l.udp.Store(conn)
	l.handle(parseRequest(t, inviteMsg, "UDP"))
	l.handle(parseRequest(t, inviteMsg, "UDP"))
	if len(p.requests) != 1 || l.servers.len() != 1 {
		t.Fatalf("a retransmission makes nothing new: %d requests", len(p.requests))
	}
	// An ACK that matches nothing goes up with no transaction and leaves nothing
	ack := parseRequest(t, byeMsg, "UDP")
	ack.Method = sip.ACK
	ack.CSeq().MethodName = sip.ACK
	l.handle(ack)
	if len(p.requests) != 2 || l.servers.len() != 1 {
		t.Fatalf("%d requests, %d transactions", len(p.requests), l.servers.len())
	}
}

func TestLayerAnswers503WhenFull(t *testing.T) {
	l, p := newTestLayer(1)
	sent := &packetRecorder{}
	l.udp.Store(&sip.UDPConnection{PacketConn: sent, PacketAddr: "10.0.0.1:5060", Listener: true})
	l.handle(parseRequest(t, byeMsg, "UDP"))
	l.handle(parseRequest(t, inviteMsg, "UDP"))
	if len(p.requests) != 1 || len(p.overflows) != 1 || p.overflows[0] != overflowTransactions {
		t.Fatalf("%d requests, overflows %v", len(p.requests), p.overflows)
	}
	if sent.count() != 1 {
		t.Fatalf("%d sent", sent.count())
	}
	if got := sent.last(); !containsAll(got, "SIP/2.0 503", "z9hG4bK-a") {
		t.Errorf("%s", got)
	}
}

func TestLayerStrayResponse(t *testing.T) {
	l, p := newTestLayer(0)
	l.handle(answer(parseRequest(t, byeMsg, "UDP"), 200))
	if p.strays != 1 {
		t.Fatal("what matches nothing goes up as stray")
	}
}

func TestClientRequestAfterItEndedLeavesTheTable(t *testing.T) {
	l, p := newTestLayer(0)
	tx, conn := newClientTx(t, l, inviteMsg, "UDP")
	tx.Terminate()
	if p.clientEnds != 1 || l.clients.len() != 0 || conn.closes != 1 {
		t.Fatalf("ends %d, left %d, closes %d", p.clientEnds, l.clients.len(), conn.closes)
	}
	tx.Terminate()
	if p.clientEnds != 1 {
		t.Fatal("ended twice")
	}
	writes := conn.count()
	stepFor(l.wheel, 40*time.Second)
	if conn.count() != writes {
		t.Fatal("a timer outlived its transaction")
	}
}

// BenchmarkServerTransaction is the whole life of a non-INVITE server
// transaction, without the wire: what the table pays per transaction.
func BenchmarkServerTransaction(b *testing.B) {
	l, _ := newTestLayer(0)
	msg, err := sip.ParseMessage([]byte(byeMsg))
	if err != nil {
		b.Fatal(err)
	}
	req := msg.(*sip.Request)
	req.SetTransport("UDP")
	req.SetSource("10.0.0.2:5070")
	res := answer(req, 200)
	conn := &discardConn{}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		tx := &ServerTx{layer: l, key: "k", origin: req, conn: conn}
		_, _, _ = l.servers.insert("k", tx)
		tx.start()
		_ = tx.Respond(res)
		tx.Terminate()
	}
}

type discardConn struct{ fakeConn }

func (*discardConn) WriteMsg(sip.Message) error { return nil }
