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
	"log/slog"
	"strings"
	"testing"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

// loopText is a request this EdgePort (10.0.0.1:5060) sent toward a Route
// naming it by a name it doesn't know, as it arrives back with its own Via on
// top.
func loopText(method sip.RequestMethod, branch string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s sip:+15551230000@trunk.example.net SIP/2.0\r\n", method)
	b.WriteString("Via: SIP/2.0/UDP 10.0.0.1:5060;branch=" + branch + "\r\n")
	b.WriteString("Via: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-caller\r\n")
	b.WriteString("Max-Forwards: 69\r\nFrom: <sip:1001@sip.local>;tag=f1\r\n")
	b.WriteString("To: <sip:+15551230000@trunk.example.net>")
	if method == sip.BYE {
		b.WriteString(";tag=t1")
	}
	b.WriteString("\r\nCall-ID: loop-1\r\n")
	b.WriteString("Route: <sip:routr-lb.example.net:5060;lr>\r\n")
	fmt.Fprintf(&b, "CSeq: 1 %s\r\nContent-Length: 0\r\n\r\n", method)
	return b.String()
}

type loopEdge struct {
	e      *EdgePort
	l      *txLayer
	client *countingClient
	logs   *bytes.Buffer
}

func newLoopEdge() loopEdge {
	l, _ := newTestLayer(0)
	logs := &bytes.Buffer{}
	e := deadHopEdge(l)
	e.log = slog.New(slog.NewTextHandler(logs, nil))
	e.conv = &sipconv.Converter{}
	client := &countingClient{}
	e.client = client
	return loopEdge{e: e, l: l, client: client, logs: logs}
}

func (le loopEdge) calls() int {
	le.client.mu.Lock()
	defer le.client.mu.Unlock()
	return le.client.calls
}

func statuses(conn *fakeConn) []int {
	conn.mu.Lock()
	defer conn.mu.Unlock()
	var out []int
	for _, m := range conn.written {
		if res, ok := m.(*sip.Response); ok {
			out = append(out, res.StatusCode)
		}
	}
	return out
}

func has482(conn *fakeConn) bool {
	for _, code := range statuses(conn) {
		if code == 482 {
			return true
		}
	}
	return false
}

func TestLoopDetected(t *testing.T) {
	const live = "z9hG4bK-live"
	for _, method := range []sip.RequestMethod{sip.INVITE, sip.BYE, sip.MESSAGE, sip.OPTIONS} {
		t.Run("a looped "+string(method)+" gets 482 and never reaches the processor", func(t *testing.T) {
			le := newLoopEdge()
			newClientTx(t, le.l, loopText(method, live), "UDP")
			server, conn := newServerTx(t, le.l, loopText(method, live), "UDP")
			le.e.processRequest(server.Origin(), server)
			if got := statuses(conn); len(got) != 1 || got[0] != 482 {
				t.Fatalf("answered %v, want [482]", got)
			}
			conn.mu.Lock()
			reason := conn.written[0].(*sip.Response).Reason
			conn.mu.Unlock()
			if reason != "Loop detected" {
				t.Errorf("reason %q", reason)
			}
			if le.calls() != 0 {
				t.Errorf("the processor was called %d times", le.calls())
			}
			line := le.logs.String()
			if !strings.Contains(line, "level=WARN") ||
				!strings.Contains(line, "loop detected callId=loop-1 route=routr-lb.example.net; answered 482") {
				t.Errorf("log %q", line)
			}
		})
	}

	t.Run("the same sent-by with a branch no client transaction holds is processed", func(t *testing.T) {
		le := newLoopEdge()
		newClientTx(t, le.l, loopText(sip.INVITE, live), "UDP")
		server, conn := newServerTx(t, le.l, loopText(sip.INVITE, "z9hG4bK-replica"), "UDP")
		le.e.processRequest(server.Origin(), server)
		if le.calls() != 1 {
			t.Fatalf("the processor was called %d times, want 1", le.calls())
		}
		if has482(conn) || strings.Contains(le.logs.String(), "loop detected") {
			t.Errorf("answered %v, logged %q", statuses(conn), le.logs.String())
		}
	})

	t.Run("a CANCEL with a live INVITE's branch is not a loop", func(t *testing.T) {
		le := newLoopEdge()
		newClientTx(t, le.l, loopText(sip.INVITE, live), "UDP")
		newClientTx(t, le.l, loopText(sip.CANCEL, live), "UDP")
		server, conn := newServerTx(t, le.l, loopText(sip.CANCEL, live), "UDP")
		le.e.processRequest(server.Origin(), server)
		if has482(conn) || strings.Contains(le.logs.String(), "loop detected") {
			t.Errorf("answered %v, logged %q", statuses(conn), le.logs.String())
		}
		if le.calls() != 1 {
			t.Errorf("the processor was called %d times, want 1", le.calls())
		}
	})

	t.Run("an ACK with a live INVITE's branch is not a loop", func(t *testing.T) {
		le := newLoopEdge()
		newClientTx(t, le.l, loopText(sip.INVITE, live), "UDP")
		ack := parseRequest(t, loopText(sip.ACK, live), "UDP")
		le.e.processRequest(ack, nil)
		if strings.Contains(le.logs.String(), "loop detected") {
			t.Errorf("logged %q", le.logs.String())
		}
	})
}
