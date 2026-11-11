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
	"fmt"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// sentPackets records what leaves the listening socket, and where to.
type sentPackets struct {
	nullPacketConn
	mu   sync.Mutex
	data [][]byte
	to   []string
}

func (s *sentPackets) WriteTo(b []byte, addr net.Addr) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = append(s.data, append([]byte(nil), b...))
	s.to = append(s.to, addr.String())
	return len(b), nil
}

func (s *sentPackets) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.data)
}

// udpLayer is a layer whose UDP listening socket is recorded.
func udpLayer(limit int) (*txLayer, *txProbe, *sentPackets) {
	l, p := newTestLayer(limit)
	sent := &sentPackets{}
	l.udp.Store(&sip.UDPConnection{PacketConn: sent, PacketAddr: "10.0.0.1:5060", Listener: true})
	return l, p, sent
}

// received hands the layer a request and returns the transaction it is on.
func received(t *testing.T, l *txLayer, text, transport string) *ServerTx {
	t.Helper()
	req := parseRequest(t, text, transport)
	l.handle(req)
	key, err := serverTxKey(req, "")
	if err != nil {
		t.Fatal(err)
	}
	tx, ok := l.servers.get(key)
	if !ok {
		t.Fatal("the request made no transaction")
	}
	return tx
}

func TestAnsweredNonInviteOverUDPEndsAndAnswersRetransmissions(t *testing.T) {
	l, p, sent := udpLayer(0)
	tx := received(t, l, byeMsg, "UDP")
	if err := tx.Respond(answer(tx.origin, 200)); err != nil {
		t.Fatal(err)
	}
	if sent.count() != 1 || sent.to[0] != "10.0.0.2:5070" {
		t.Fatalf("the response leaves once, to the request's source: %v", sent.to)
	}
	if l.servers.len() != 0 || p.serverEnds != 1 {
		t.Fatalf("the transaction ends with its final response: %d in the table, %d ended", l.servers.len(), p.serverEnds)
	}
	if l.answered.len() != 1 {
		t.Fatalf("the response stays for Timer J: %d", l.answered.len())
	}

	l.handle(parseRequest(t, byeMsg, "UDP"))
	if len(p.requests) != 1 {
		t.Fatalf("a retransmission went up as a new request: %d", len(p.requests))
	}
	if sent.count() != 2 || !bytes.Equal(sent.data[0], sent.data[1]) || sent.to[1] != sent.to[0] {
		t.Fatalf("a retransmission gets the same response at the same address: %d sent to %v", sent.count(), sent.to)
	}
	if err := tx.Respond(answer(tx.origin, 500)); err == nil || sent.count() != 2 {
		t.Fatal("the transaction takes no other response")
	}

	stepFor(l.wheel, sip.Timer_J-wheelTick)
	if l.answered.len() != 1 {
		t.Fatal("J is 64*T1")
	}
	stepFor(l.wheel, 3*wheelTick)
	if l.answered.len() != 0 {
		t.Fatal("J did not fire")
	}
	l.handle(parseRequest(t, byeMsg, "UDP"))
	if len(p.requests) != 2 || l.servers.len() != 1 {
		t.Fatal("after Timer J the same request is a new one")
	}
}

func TestAnsweredAProvisionalFirst(t *testing.T) {
	l, _, sent := udpLayer(0)
	tx := received(t, l, byeMsg, "UDP")
	_ = tx.Respond(answer(tx.origin, 100))
	if l.servers.len() != 1 || l.answered.len() != 0 {
		t.Fatal("a provisional response ends nothing")
	}
	l.handle(parseRequest(t, byeMsg, "UDP"))
	if sent.count() != 2 {
		t.Fatal("Proceeding answers a retransmission with the provisional")
	}
	_ = tx.Respond(answer(tx.origin, 200))
	l.handle(parseRequest(t, byeMsg, "UDP"))
	if sent.count() != 4 || !strings.HasPrefix(string(sent.data[3]), "SIP/2.0 200 ") {
		t.Fatalf("then with the final: %d sent", sent.count())
	}
}

func TestAnsweredFallsBackToTheTransaction(t *testing.T) {
	t.Run("a full table", func(t *testing.T) {
		l, p, sent := udpLayer(1)
		bye := func(i int) string {
			return strings.Replace(byeMsg, "branch=z9hG4bK-b", fmt.Sprintf("branch=z9hG4bK-b%d", i), 1)
		}
		for i := 0; i < answeredPerTransaction; i++ {
			tx := received(t, l, bye(i), "UDP")
			_ = tx.Respond(answer(tx.origin, 200))
		}
		if l.answered.len() != answeredPerTransaction || l.servers.len() != 0 {
			t.Fatalf("%d answered, %d transactions", l.answered.len(), l.servers.len())
		}
		tx := received(t, l, bye(99), "UDP")
		_ = tx.Respond(answer(tx.origin, 200))
		if l.answered.len() != answeredPerTransaction || l.servers.len() != 1 || p.serverEnds != answeredPerTransaction {
			t.Fatalf("past the limit the transaction waits out Timer J itself: %d answered, %d transactions", l.answered.len(), l.servers.len())
		}
		before := sent.count()
		l.handle(parseRequest(t, bye(99), "UDP"))
		if sent.count() != before+1 || len(p.requests) != answeredPerTransaction+1 {
			t.Fatal("and still answers a retransmission")
		}
		stepFor(l.wheel, sip.Timer_J+2*wheelTick)
		if l.servers.len() != 0 || l.answered.len() != 0 {
			t.Fatalf("Timer J ends both: %d transactions, %d answered", l.servers.len(), l.answered.len())
		}
	})
	t.Run("a response aimed at a name", func(t *testing.T) {
		l, _, _ := udpLayer(0)
		tx := received(t, l, byeMsg, "UDP")
		res := answer(tx.origin, 200)
		res.SetDestination("phone.example.com:5070")
		_ = tx.Respond(res)
		if l.answered.len() != 0 || l.servers.len() != 1 {
			t.Fatalf("%d answered, %d transactions", l.answered.len(), l.servers.len())
		}
	})
	t.Run("a connection that isn't the listening socket", func(t *testing.T) {
		l, p := newTestLayer(0)
		tx, conn := newServerTx(t, l, byeMsg, "UDP")
		_ = tx.Respond(answer(tx.origin, 200))
		tx.receive(parseRequest(t, byeMsg, "UDP"))
		if l.answered.len() != 0 || conn.count() != 2 || p.serverEnds != 0 {
			t.Fatalf("%d answered, %d written, %d ended", l.answered.len(), conn.count(), p.serverEnds)
		}
	})
}

func TestAnsweredIsForNonInviteOverUDPOnly(t *testing.T) {
	t.Run("an INVITE keeps its transaction", func(t *testing.T) {
		l, _, _ := udpLayer(0)
		tx := received(t, l, inviteMsg, "UDP")
		_ = tx.Respond(answer(tx.origin, 200))
		if l.answered.len() != 0 || l.servers.len() != 1 {
			t.Fatalf("Accepted is the transaction's (RFC 6026): %d answered, %d transactions", l.answered.len(), l.servers.len())
		}
		tx = received(t, l, strings.Replace(inviteMsg, "z9hG4bK-a", "z9hG4bK-a2", 1), "UDP")
		_ = tx.Respond(answer(tx.origin, 486))
		if l.answered.len() != 0 || l.servers.len() != 2 {
			t.Fatalf("and so is Completed, which waits for the ACK: %d answered, %d transactions", l.answered.len(), l.servers.len())
		}
	})
	t.Run("a stream has no retransmissions to answer", func(t *testing.T) {
		l, p := newTestLayer(0)
		tx, _ := newServerTx(t, l, byeMsg, "TCP")
		_ = tx.Respond(answer(tx.origin, 200))
		if l.answered.len() != 0 || l.servers.len() != 0 || p.serverEnds != 1 {
			t.Fatalf("%d answered, %d transactions, %d ended", l.answered.len(), l.servers.len(), p.serverEnds)
		}
	})
}

// A request the processor answers is asked of it once, whatever the caller
// retransmits, and its transaction is released as soon as it is answered.
func TestFlowARetransmittedRequestIsAnsweredAgainFromWhatWasSent(t *testing.T) {
	proc := &fakeProcessor{}
	ep, edge := startEdgePortWith(t, proc)
	uac := newPeer(t)
	message := fmt.Sprintf(`
MESSAGE sip:echo@127.0.0.1:%d SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-again
Max-Forwards: 70
From: <sip:a@127.0.0.1>;tag=1
To: <sip:echo@127.0.0.1>
Call-ID: again-1
CSeq: 1 MESSAGE
Content-Length: 0

`, edge, uac.port)
	uac.send(edge, message)
	first, ok := mustRecv(t, uac).(*sip.Response)
	if !ok || first.StatusCode != 200 {
		t.Fatalf("the MESSAGE is answered: %v", first)
	}
	for i := 0; i < 3; i++ {
		uac.send(edge, message)
		again, ok := mustRecv(t, uac).(*sip.Response)
		if !ok || again.String() != first.String() {
			t.Fatalf("retransmission %d gets the same response: %v", i+1, again)
		}
	}
	if got := len(proc.requests(ppb.Method_MESSAGE)); got != 1 {
		t.Fatalf("the processor was asked %d times", got)
	}
	deadline := time.Now().Add(2 * time.Second)
	for ep.txm.ServerTransaction("again-1") != nil || ep.txl.servers.len() != 0 {
		if time.Now().After(deadline) {
			t.Fatalf("the answered transaction is still held: %d in the table", ep.txl.servers.len())
		}
		time.Sleep(5 * time.Millisecond)
	}
	if ep.txl.answered.len() != 1 {
		t.Fatalf("what is kept is the answer: %d", ep.txl.answered.len())
	}
}
