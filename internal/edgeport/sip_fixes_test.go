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
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
)

// blockConn is a stream whose peer stopped reading: a write waits for release.
type blockConn struct {
	fakeConn
	entered chan struct{}
	release chan struct{}
	once    sync.Once
}

func newBlockConn() *blockConn {
	return &blockConn{entered: make(chan struct{}), release: make(chan struct{})}
}

func (c *blockConn) WriteMsg(msg sip.Message) error {
	c.once.Do(func() { close(c.entered) })
	<-c.release
	return c.fakeConn.WriteMsg(msg)
}

// within fails the test if fn is still running after a few seconds.
func within(t *testing.T, what string, conn *blockConn, fn func()) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		defer close(done)
		fn()
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		close(conn.release)
		t.Fatalf("%s waited on a stalled peer", what)
	}
}

func TestAStalledStreamFreezesNoTimer(t *testing.T) {
	l, p := newTestLayer(0)
	stalled, _ := newServerTx(t, l, inviteMsg, "TCP")
	conn := newBlockConn()
	stalled.conn = conn
	_, otherConn := newClientTx(t, l, byeMsg, "UDP")

	responded := make(chan error, 1)
	go func() { responded <- stalled.Respond(answer(stalled.origin, 486)) }()
	<-conn.entered

	within(t, "the wheel", conn, func() { stepFor(l.wheel, sip.Timer_H+3*wheelTick) })
	if otherConn.count() < 2 {
		t.Fatalf("another transaction's timer didn't fire: %d writes", otherConn.count())
	}
	if p.clientEnds != 1 {
		t.Fatal("another transaction's Timer F didn't fire")
	}
	within(t, "reading the state", conn, func() { _ = stalled.Err() })
	if p.serverEnds != 0 {
		t.Fatal("the connection is the writer's until it's done")
	}

	close(conn.release)
	if err := <-responded; err != nil {
		t.Fatal(err)
	}
	if conn.count() != 1 || p.serverEnds != 1 {
		t.Fatalf("%d writes, %d ends", conn.count(), p.serverEnds)
	}
}

func TestAWriterInFlightKeepsTheOrder(t *testing.T) {
	l, p := newTestLayer(0)
	tx, _ := newServerTx(t, l, inviteMsg, "TCP")
	conn := newBlockConn()
	tx.conn = conn
	responded := make(chan error, 1)
	go func() { responded <- tx.Respond(answer(tx.origin, 180)) }()
	<-conn.entered
	within(t, "the second response", conn, func() {
		if err := tx.Respond(answer(tx.origin, 486)); err != nil {
			t.Error(err)
		}
	})
	close(conn.release)
	if err := <-responded; err != nil {
		t.Fatal(err)
	}
	if conn.count() != 2 || conn.written[0].(*sip.Response).StatusCode != 180 ||
		conn.written[1].(*sip.Response).StatusCode != 486 {
		t.Fatalf("written %v", conn.written)
	}
	if p.serverEnds != 0 {
		t.Fatal("H still runs")
	}
}

func TestAStalledStreamHoldsNoClientTimer(t *testing.T) {
	l, p := newTestLayer(0)
	req := parseRequest(t, inviteMsg, "TCP")
	key, err := sip.ClientTxKeyMake(req)
	if err != nil {
		t.Fatal(err)
	}
	conn := newBlockConn()
	tx := &ClientTx{layer: l, key: key, origin: req, conn: conn, invite: true, reliable: true}
	if _, _, err := l.clients.insert(key, tx); err != nil {
		t.Fatal(err)
	}
	started := make(chan error, 1)
	go func() { started <- tx.start() }()
	<-conn.entered
	within(t, "the wheel", conn, func() { stepFor(l.wheel, sip.Timer_B+3*wheelTick) })
	if !errors.Is(tx.Err(), sip.ErrTransactionTimeout) {
		t.Fatalf("B fired with the write stalled: %v", tx.Err())
	}
	close(conn.release)
	if err := <-started; err != nil {
		t.Fatal(err)
	}
	if p.clientEnds != 1 {
		t.Fatalf("%d ends", p.clientEnds)
	}
}

func TestAStalledStreamDoesntHoldTheLayersClose(t *testing.T) {
	l, _ := newTestLayer(0)
	l.start()
	tx, _ := newServerTx(t, l, inviteMsg, "TCP")
	conn := newBlockConn()
	tx.conn = conn
	responded := make(chan error, 1)
	go func() { responded <- tx.Respond(answer(tx.origin, 486)) }()
	<-conn.entered
	within(t, "Close", conn, l.Close)
	close(conn.release)
	<-responded
}

func TestEveryStreamTransportHasAWriteTimeout(t *testing.T) {
	conf := streamTransports()
	for name, got := range map[string]time.Duration{
		"tcp": conf.TCP.WriteTimeout,
		"tls": conf.TLS.TransportTCP.WriteTimeout,
		"ws":  conf.WS.WriteTimeout,
		"wss": conf.WSS.TransportWS.WriteTimeout,
	} {
		if got <= 0 {
			t.Errorf("%s has none: sipgo's is off when not positive", name)
		}
	}
}

func deadHopEdge(l *txLayer) *EdgePort {
	return &EdgePort{log: discardLog(), txl: l, txm: NewBoundedTransactionManager(0, 0), queue: NewCallQueue(discardLog())}
}

func TestDeadHopCode(t *testing.T) {
	timeout := errors.Join(errors.New("Timer_B"), sip.ErrTransactionTimeout)
	transport := errors.Join(errors.New("refused"), sip.ErrTransactionTransport)
	for _, c := range []struct {
		name   string
		invite bool
		err    error
		want   int
	}{
		{"INVITE timeout", true, timeout, 408},
		{"INVITE transport", true, transport, 503},
		{"non-INVITE timeout (RFC 4320)", false, timeout, 0},
		{"non-INVITE transport", false, transport, 503},
		{"a normal end", true, sip.ErrTransactionTerminated, 0},
		{"Close", true, sip.ErrTransactionCanceled, 0},
		{"no error", true, nil, 0},
	} {
		if got := deadHopCode(c.invite, c.err); got != c.want {
			t.Errorf("%s: %d, want %d", c.name, got, c.want)
		}
	}
}

func TestAnswerDeadHop(t *testing.T) {
	failed := func(l *txLayer, invite bool, err error) *ClientTx {
		tx := &ClientTx{layer: l, invite: invite, err: err}
		tx.info.callID = "call-1"
		return tx
	}
	t.Run("an INVITE that timed out is a 408 with a To tag", func(t *testing.T) {
		l, _ := newTestLayer(0)
		server, conn := newServerTx(t, l, inviteMsg, "UDP")
		if !deadHopEdge(l).answerDeadHop(failed(l, true, sip.ErrTransactionTimeout), server) {
			t.Fatal("not answered")
		}
		res := conn.written[0].(*sip.Response)
		if res.StatusCode != 408 {
			t.Fatalf("got %d", res.StatusCode)
		}
		if tag, ok := res.To().Params.Get("tag"); !ok || tag == "" {
			t.Error("no To tag")
		}
	})
	t.Run("a transport failure is a 503", func(t *testing.T) {
		l, _ := newTestLayer(0)
		server, conn := newServerTx(t, l, inviteMsg, "UDP")
		deadHopEdge(l).answerDeadHop(failed(l, true, sip.ErrTransactionTransport), server)
		if conn.count() != 1 || conn.written[0].(*sip.Response).StatusCode != 503 {
			t.Fatalf("written %v", conn.written)
		}
	})
	t.Run("a non-INVITE that timed out gets nothing", func(t *testing.T) {
		l, _ := newTestLayer(0)
		server, conn := newServerTx(t, l, byeMsg, "UDP")
		if deadHopEdge(l).answerDeadHop(failed(l, false, sip.ErrTransactionTimeout), server) || conn.count() != 0 {
			t.Fatalf("written %v", conn.written)
		}
	})
	t.Run("a final already asked for stands", func(t *testing.T) {
		l, _ := newTestLayer(0)
		server, conn := newServerTx(t, l, inviteMsg, "UDP")
		server.final.Store(true)
		if deadHopEdge(l).answerDeadHop(failed(l, true, sip.ErrTransactionTimeout), server) || conn.count() != 0 {
			t.Fatalf("written %v", conn.written)
		}
	})
	t.Run("a Completed transaction takes no more", func(t *testing.T) {
		l, _ := newTestLayer(0)
		server, conn := newServerTx(t, l, inviteMsg, "UDP")
		cancel := parseRequest(t, inviteMsg, "UDP")
		cancel.Method = sip.CANCEL
		server.receive(cancel)
		writes := conn.count()
		if deadHopEdge(l).answerDeadHop(failed(l, true, sip.ErrTransactionTimeout), server) || conn.count() != writes {
			t.Fatalf("written %v", conn.written)
		}
	})
}

func TestOnClientEndLeavesAReplacedServerAlone(t *testing.T) {
	l, _ := newTestLayer(0)
	e := deadHopEdge(l)
	server, conn := newServerTx(t, l, inviteMsg, "UDP")
	tx := &ClientTx{layer: l, invite: true, err: sip.ErrTransactionTimeout}
	tx.info.callID = "call-1"
	tx.info.server = server
	tx.info.replaced.Store(true)
	e.onClientEnd(tx)
	deadline := time.Now().Add(5 * time.Second)
	for e.queue.Len() != 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if conn.count() != 0 {
		t.Fatalf("written %v", conn.written)
	}
}

func TestClientHoldsACancelUntilTheFirstProvisional(t *testing.T) {
	t.Run("the first 1xx frees it", func(t *testing.T) {
		l, p := newTestLayer(0)
		tx, _ := newClientTx(t, l, inviteMsg, "UDP")
		cancel := NewCancel(tx.origin)
		if tx.holdCancel(cancel) {
			t.Fatal("no CANCEL before a provisional (RFC 3261 section 9.1)")
		}
		if len(p.heldCancels) != 0 {
			t.Fatal("freed with nothing received")
		}
		tx.receive(answer(tx.origin, 100))
		if len(p.heldCancels) != 1 || p.heldCancels[0] != cancel {
			t.Fatalf("freed %v", p.heldCancels)
		}
		tx.receive(answer(tx.origin, 180))
		if len(p.heldCancels) != 1 {
			t.Fatal("freed twice")
		}
		if !tx.holdCancel(NewCancel(tx.origin)) {
			t.Fatal("in Proceeding it goes at once")
		}
	})
	t.Run("a final discards it", func(t *testing.T) {
		for _, code := range []int{200, 486} {
			l, p := newTestLayer(0)
			tx, _ := newClientTx(t, l, inviteMsg, "UDP")
			tx.holdCancel(NewCancel(tx.origin))
			tx.receive(answer(tx.origin, code))
			tx.receive(answer(tx.origin, 180))
			if len(p.heldCancels) != 0 || tx.holdCancel(NewCancel(tx.origin)) {
				t.Fatalf("%d: a CANCEL after a final", code)
			}
		}
	})
	t.Run("Timer B discards it", func(t *testing.T) {
		l, p := newTestLayer(0)
		tx, _ := newClientTx(t, l, inviteMsg, "UDP")
		tx.holdCancel(NewCancel(tx.origin))
		stepFor(l.wheel, sip.Timer_B+3*wheelTick)
		if p.clientEnds != 1 || len(p.heldCancels) != 0 || tx.holdCancel(NewCancel(tx.origin)) {
			t.Fatalf("%d ends, freed %v", p.clientEnds, p.heldCancels)
		}
	})
	t.Run("a non-INVITE has no such rule", func(t *testing.T) {
		l, _ := newTestLayer(0)
		tx, _ := newClientTx(t, l, byeMsg, "UDP")
		if !tx.holdCancel(NewCancel(tx.origin)) {
			t.Fatal("held")
		}
	})
}

func TestCancelGoesWhereItsInviteWent(t *testing.T) {
	l, _ := newTestLayer(0)
	inv, conn := newClientTx(t, l, inviteMsg, "UDP")
	tx, err := l.cancel(inv, NewCancel(inv.origin))
	if err != nil {
		t.Fatal(err)
	}
	if tx.conn != sip.Connection(conn) {
		t.Fatal("not on the INVITE's connection")
	}
	if conn.count() != 2 || !conn.written[1].(*sip.Request).IsCancel() {
		t.Fatalf("written %v", conn.written)
	}
	if tx.info.server != nil || tx.info.callID != inv.info.callID {
		t.Fatal("a CANCEL of the EdgePort's has no server transaction")
	}
}

func TestNewCancelToANameKeepsTheInvitesAddress(t *testing.T) {
	req := parseRequest(t, inviteMsg, "UDP")
	req.SetDestination("trunk.example.com:5060")
	cancel := NewCancel(req)
	if !cancel.IsCancel() || cancel.CSeq().MethodName != sip.CANCEL || cancel.CSeq().SeqNo != req.CSeq().SeqNo {
		t.Fatalf("not the INVITE's CANCEL:\n%s", cancel)
	}
	if len(cancel.GetHeaders("Via")) != 1 || cancel.Contact() != nil {
		t.Fatalf("the clone keeps the INVITE's headers:\n%s", cancel)
	}
	if !strings.HasPrefix(cancel.String(), "CANCEL ") {
		t.Fatalf("start line:\n%s", cancel)
	}
}

func TestOnServerCancelIsNeverRefused(t *testing.T) {
	l, _ := newTestLayer(0)
	e := deadHopEdge(l)
	e.queue = NewBoundedCallQueue(discardLog(), 1, 1)
	block := make(chan struct{})
	defer close(block)
	e.queue.Run("call-1", func() { <-block })
	for e.queue.Run("call-1", func() {}) {
		time.Sleep(time.Millisecond)
	}
	server, _ := newServerTx(t, l, inviteMsg, "UDP")
	cancel := parseRequest(t, inviteMsg, "UDP")
	cancel.Method = sip.CANCEL
	e.queue.mu.Lock()
	before := len(e.queue.queues["call-1"])
	e.queue.mu.Unlock()
	e.onServerCancel(server, cancel)
	e.queue.mu.Lock()
	after := len(e.queue.queues["call-1"])
	e.queue.mu.Unlock()
	if after != before+1 {
		t.Fatalf("the CANCEL wasn't queued past the limit: %d, then %d", before, after)
	}
	if !e.txm.IsCancelled("call-1") {
		t.Fatal("not marked")
	}
}

func TestFailureAckCarriesOneVia(t *testing.T) {
	req := parseRequest(t, strings.Replace(inviteMsg, "Max-Forwards",
		"Via: SIP/2.0/UDP 10.0.0.3:5060;branch=z9hG4bK-upstream\r\nMax-Forwards", 1), "UDP")
	if len(req.GetHeaders("Via")) != 2 {
		t.Fatalf("the INVITE has %d Vias", len(req.GetHeaders("Via")))
	}
	ack := newFailureAck(req, answer(req, 486), false)
	vias := ack.GetHeaders("Via")
	if len(vias) != 1 || vias[0].Value() != req.Via().Value() {
		t.Fatalf("RFC 3261 section 17.1.1.3: the INVITE's top Via alone:\n%s", ack)
	}
}

func TestNoFromTagCountsAsEmpty(t *testing.T) {
	const noTag = "INVITE sip:1002@10.0.0.9 SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.2;branch=old\r\nFrom: <sip:a@b>\r\nTo: <sip:c@d>\r\nCall-ID: c\r\nCSeq: 1 INVITE\r\nContent-Length: 0\r\n\r\n"
	key, err := serverTxKey(parseRequest(t, noTag, "UDP"), "")
	if err != nil || key == "" {
		t.Fatalf("key %q, err %v", key, err)
	}
	l, p := newTestLayer(0)
	l.udp.Store(&sip.UDPConnection{PacketConn: nullPacketConn{}, PacketAddr: "10.0.0.1:5060", Listener: true})
	l.handle(parseRequest(t, noTag, "UDP"))
	if len(p.requests) != 1 {
		t.Fatal("RFC 3261 section 12.1.1: a pre-3261 request is a request, not a 400")
	}
}

func TestAMalformedAckIsNeverAnswered(t *testing.T) {
	// The layer has no transport to answer on: answering would panic
	l, p := newTestLayer(0)
	ack := parseRequest(t, inviteMsg, "UDP")
	ack.Method = sip.ACK
	ack.RemoveHeader("Via")
	l.handle(ack)
	if len(p.requests) != 0 {
		t.Fatal("no key, nothing goes up")
	}
}

func TestWheelIsNeverEarlyWhileItLags(t *testing.T) {
	w := newTimerWheel()
	// As if the hand started a second ago and is still at zero
	w.started = time.Now().Add(-time.Second)
	p := &wheelProbe{}
	var timer wheelTimer
	w.schedule(&timer, 10*wheelTick, p, timerLife)
	stepFor(w, time.Second)
	if len(p.fired) != 0 {
		t.Fatal("fired while the hand caught up: early by the lag")
	}
	stepFor(w, 30*wheelTick)
	if len(p.fired) != 1 {
		t.Fatal("did not fire once the hand caught up")
	}
}

func TestAStrayNonInviteResponseGoesNowhere(t *testing.T) {
	l, _ := newTestLayer(0)
	e := deadHopEdge(l)
	e.onStrayResponse(answer(parseRequest(t, byeMsg, "UDP"), 200))
	if e.queue.Len() != 0 {
		t.Fatal("RFC 4320 section 4.2: a late non-INVITE response isn't forwarded")
	}
}

func TestNewLegRequest(t *testing.T) {
	const ours = "<sip:10.0.0.1:5060;lr>"
	invite := parseRequest(t, strings.Replace(inviteMsg, "Max-Forwards",
		"Via: SIP/2.0/UDP 10.0.0.3:5060;branch=z9hG4bK-upstream\r\nRecord-Route: "+ours+"\r\nMax-Forwards", 1), "UDP")
	const text = "SIP/2.0 200 OK\r\nVia: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-a\r\n" +
		"Record-Route: <sip:198.51.100.2:5060;lr>, <sip:198.51.100.1:5060;lr>\r\nRecord-Route: " + ours + "\r\n" +
		"From: <sip:1001@sip.local>;tag=f1\r\nTo: <sip:1002@sip.local>;tag=callee\r\nCall-ID: call-1\r\nCSeq: 1 INVITE\r\n" +
		"Contact: <sip:1002@198.51.100.3:5080>\r\nContent-Length: 0\r\n\r\n"
	msg, err := sip.ParseMessage([]byte(text))
	if err != nil {
		t.Fatal(err)
	}
	bye := NewLegRequest(invite, msg.(*sip.Response), sip.BYE, 2)
	if bye.Recipient.Host != "198.51.100.3" || bye.Recipient.Port != 5080 {
		t.Errorf("to the Contact:\n%s", bye)
	}
	vias := bye.GetHeaders("Via")
	if len(vias) != 1 {
		t.Fatalf("one Via:\n%s", bye)
	}
	inviteBranch, _ := invite.Via().Params.Get("branch")
	if branch, _ := bye.Via().Params.Get("branch"); branch == inviteBranch || !isRFC3261Branch(branch) {
		t.Errorf("a new branch: %q", branch)
	}
	routes := bye.GetHeaders("Route")
	if len(routes) != 2 || !strings.Contains(routes[0].Value(), "198.51.100.1") || !strings.Contains(routes[1].Value(), "198.51.100.2") {
		t.Errorf("past this hop, reversed:\n%s", bye)
	}
	if tag, _ := bye.To().Params.Get("tag"); tag != "callee" {
		t.Errorf("the 2xx's To:\n%s", bye)
	}
	if tag, _ := bye.From().Params.Get("tag"); tag != "f1" {
		t.Errorf("the INVITE's From:\n%s", bye)
	}
	if bye.CSeq().SeqNo != 2 || bye.CSeq().MethodName != sip.BYE {
		t.Errorf("CSeq:\n%s", bye)
	}
	if bye.CallID().Value() != "call-1" {
		t.Errorf("Call-ID:\n%s", bye)
	}
}
