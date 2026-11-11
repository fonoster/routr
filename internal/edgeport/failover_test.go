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
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/common/config"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// trunkHop is one URI of the Trunk trunkProcessor routes to.
type trunkHop struct {
	name      string
	port      int
	transport string
}

// trunkProcessor routes an initial INVITE as Connect does toward a Trunk with
// several URIs: to the first one the request's failover.tried doesn't name,
// answering with the list while another remains.
type trunkProcessor struct {
	edgePort int
	hops     []trunkHop
	// reaskFails answers a request carrying failover.tried as the Dispatcher
	// does when its processor fails: the request, unchanged
	reaskFails bool
	// reaskDelay is how long a request carrying failover.tried takes
	reaskDelay time.Duration

	mu      sync.Mutex
	invites []askedInvite
}

// askedInvite is what an INVITE handed to the processor looked like.
type askedInvite struct {
	tried    string
	ruriPort int32
}

func (p *trunkProcessor) ProcessMessage(_ context.Context, req *ppb.MessageRequest, _ ...grpc.CallOption) (*ppb.MessageResponse, error) {
	msg := req.GetMessage()
	if _, isResponse := msg.GetMessageType().(*pb.SIPMessage_ResponseType); isResponse {
		msg.Via = msg.Via[1:]
		return &ppb.MessageResponse{Message: msg}, nil
	}
	if req.GetMethod() != ppb.Method_INVITE {
		return &ppb.MessageResponse{Message: msg}, nil
	}
	p.mu.Lock()
	p.invites = append(p.invites, askedInvite{req.GetMetadata()[failoverTriedKey], msg.GetRequestUri().GetPort()})
	p.mu.Unlock()

	var tried []string
	if value := req.GetMetadata()[failoverTriedKey]; value != "" {
		time.Sleep(p.reaskDelay)
		if p.reaskFails {
			return &ppb.MessageResponse{Message: msg, Metadata: req.GetMetadata()}, nil
		}
		_ = json.Unmarshal([]byte(value), &tried)
	}
	isTried := func(name string) bool {
		for _, t := range tried {
			if t == name {
				return true
			}
		}
		return false
	}
	var chosen *trunkHop
	remaining := 0
	for i := range p.hops {
		switch {
		case isTried(p.hops[i].name):
		case chosen == nil:
			chosen = &p.hops[i]
		default:
			remaining++
		}
	}
	if chosen == nil {
		return &ppb.MessageResponse{Message: &pb.SIPMessage{
			MessageType: &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_SERVER_INTERNAL_ERROR}}}, nil
	}
	metadata := map[string]string{}
	if remaining > 0 {
		list, _ := json.Marshal(append(tried, chosen.name))
		metadata[failoverTriedKey] = string(list)
	}
	msg.GetRequestUri().Host = "127.0.0.1"
	msg.GetRequestUri().Port = int32(chosen.port)
	msg.GetRequestUri().TransportParam = chosen.transport
	msg.Via = append([]*pb.Via{{Host: "127.0.0.1", Port: int32(p.edgePort), Transport: strings.ToUpper(chosen.transport),
		RPortFlag: true, RPort: -1, Ttl: -1}}, msg.Via...)
	return &ppb.MessageResponse{Message: msg, Metadata: metadata}, nil
}

func (p *trunkProcessor) asked() []askedInvite {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]askedInvite(nil), p.invites...)
}

// eventCounter counts the events the EdgePort publishes, by name.
type eventCounter struct {
	mu     sync.Mutex
	counts map[string]int
}

func (c *eventCounter) Publish(name string, _ map[string]any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.counts[name]++
}

func (c *eventCounter) total() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	n := 0
	for _, v := range c.counts {
		n += v
	}
	return n
}

// startTrunkEdgePort starts an EdgePort over UDP whose processor is proc, in
// process, with its events counted.
func startTrunkEdgePort(t *testing.T, proc *trunkProcessor) (*EdgePort, int, *eventCounter) {
	t.Helper()
	port := freeUDPPort(t)
	proc.edgePort = port
	cfg, err := config.ParseEdgePort([]byte(fmt.Sprintf(`
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-test
spec:
  bindAddr: 127.0.0.1
  processor:
    addr: 127.0.0.1:1
  methods: [INVITE, ACK, BYE, CANCEL, MESSAGE, REGISTER]
  externalAddrs: [127.0.0.1]
  localnets: [127.0.0.1/8]
  transport:
    - protocol: udp
      port: %d
`, port)), config.ResolveOptions{Env: config.EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	ep, err := New(cfg, Options{Processor: proc, Version: "test"})
	if err != nil {
		t.Fatal(err)
	}
	events := &eventCounter{counts: map[string]int{}}
	ep.events = NewEventProcessor([]Publisher{events})
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = ep.Start(ctx) }()
	time.Sleep(200 * time.Millisecond)
	return ep, port, events
}

// deadTCPPort is a TCP port nothing listens on: a connection there is refused.
func deadTCPPort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}

// finalOf reads the caller's messages up to the INVITE's final response.
func finalOf(t *testing.T, uac *peer) *sip.Response {
	t.Helper()
	for {
		res, ok := mustRecv(t, uac).(*sip.Response)
		if ok && res.StatusCode >= 200 && res.CSeq().MethodName == sip.INVITE {
			return res
		}
	}
}

func TestFlowTrunkFailover(t *testing.T) {
	// A and B over UDP, where a test can answer for them
	twoURIs := func(t *testing.T) (*trunkProcessor, *peer, *peer) {
		a, b := newPeer(t), newPeer(t)
		return &trunkProcessor{hops: []trunkHop{{"a", a.port, "udp"}, {"b", b.port, "udp"}}}, a, b
	}

	t.Run("a 503 moves the call to the next URI", func(t *testing.T) {
		proc, a, b := twoURIs(t)
		ep, edge, events := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo1"))
		toA := recvMethod(t, a, sip.INVITE)
		respondAs(a, edge, toA, "503 Service Unavailable")
		toB := recvMethod(t, b, sip.INVITE)
		branchA, _ := toA.Via().Params.Get("branch")
		branchB, _ := toB.Via().Params.Get("branch")
		if branchA == branchB || branchB == "" || toB.Recipient.Port != b.port {
			t.Errorf("B's INVITE: branch %q (A's %q), Request-URI %s", branchB, branchA, toB.Recipient.String())
		}
		respondAs(b, edge, toB, "200 OK")
		if res := finalOf(t, uac); res.StatusCode != 200 {
			t.Fatalf("the caller got %d, want B's 200", res.StatusCode)
		}
		asked := proc.asked()
		if len(asked) != 2 || asked[0].tried != "" || asked[1].tried != `["a"]` {
			t.Fatalf("the processor was asked %d times: %+v", len(asked), asked)
		}
		if asked[1].ruriPort != asked[0].ruriPort {
			t.Errorf("the retry was built from the request A got, not from the caller's: %+v", asked)
		}
		// One call: one CallStarted and one dialog
		if events.total() != 1 {
			t.Errorf("events = %v, want one CallStarted", events.counts)
		}
		ep.txm.mu.Lock()
		dialogs := len(ep.txm.targets)
		ep.txm.mu.Unlock()
		if dialogs != 1 {
			t.Errorf("%d dialogs, want 1", dialogs)
		}
	})

	t.Run("a refused connection moves it at once", func(t *testing.T) {
		b := newPeer(t)
		proc := &trunkProcessor{hops: []trunkHop{{"a", deadTCPPort(t), "tcp"}, {"b", b.port, "udp"}}}
		_, edge, _ := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo2"))
		respondAs(b, edge, recvMethod(t, b, sip.INVITE), "200 OK")
		if res := finalOf(t, uac); res.StatusCode != 200 {
			t.Fatalf("the caller got %d, want B's 200", res.StatusCode)
		}
	})

	t.Run("a 503 after a 180 is relayed", func(t *testing.T) {
		proc, a, b := twoURIs(t)
		_, edge, _ := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo3"))
		toA := recvMethod(t, a, sip.INVITE)
		respondAs(a, edge, toA, "180 Ringing")
		if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 180 {
			t.Fatalf("the 180 is relayed: %v", res)
		}
		respondAs(a, edge, toA, "503 Service Unavailable")
		if res := finalOf(t, uac); res.StatusCode != 503 {
			t.Fatalf("the caller got %d, want A's 503", res.StatusCode)
		}
		b.silent(500 * time.Millisecond)
		if len(proc.asked()) != 1 {
			t.Error("the processor was asked for another URI")
		}
	})

	for _, status := range []string{"408 Request Timeout", "500 Server Internal Error", "486 Busy Here"} {
		t.Run("a "+status+" is relayed", func(t *testing.T) {
			proc, a, b := twoURIs(t)
			_, edge, _ := startTrunkEdgePort(t, proc)
			uac := newPeer(t)
			uac.send(edge, inviteText(uac.port, "fo4"))
			respondAs(a, edge, recvMethod(t, a, sip.INVITE), status)
			if res := finalOf(t, uac); !strings.HasPrefix(status, fmt.Sprint(res.StatusCode)) {
				t.Fatalf("the caller got %d, want %s", res.StatusCode, status)
			}
			b.silent(500 * time.Millisecond)
		})
	}

	t.Run("the last URI's 503 reaches the caller", func(t *testing.T) {
		proc, a, b := twoURIs(t)
		_, edge, _ := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo5"))
		respondAs(a, edge, recvMethod(t, a, sip.INVITE), "503 Service Unavailable")
		respondAs(b, edge, recvMethod(t, b, sip.INVITE), "503 Service Unavailable")
		if res := finalOf(t, uac); res.StatusCode != 503 {
			t.Fatalf("the caller got %d, want 503", res.StatusCode)
		}
		if n := len(proc.asked()); n != 2 {
			t.Errorf("the processor was asked %d times, want 2", n)
		}
	})

	t.Run("a last URI that can't be reached is a 503", func(t *testing.T) {
		a := newPeer(t)
		proc := &trunkProcessor{hops: []trunkHop{{"a", a.port, "udp"}, {"b", deadTCPPort(t), "tcp"}}}
		_, edge, _ := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo6"))
		respondAs(a, edge, recvMethod(t, a, sip.INVITE), "503 Service Unavailable")
		if res := finalOf(t, uac); res.StatusCode != 503 {
			t.Fatalf("the caller got %d, want 503", res.StatusCode)
		}
	})

	t.Run("a re-ask that brings no route leaves the first answer", func(t *testing.T) {
		for name, first := range map[string]string{"503": "udp", "refused": "tcp"} {
			a, b, self := newPeer(t), newPeer(t), newPeer(t)
			hops := []trunkHop{{"a", a.port, "udp"}, {"b", b.port, "udp"}}
			if first == "tcp" {
				hops[0] = trunkHop{"a", deadTCPPort(t), "tcp"}
			}
			proc := &trunkProcessor{hops: hops, reaskFails: true}
			_, edge, _ := startTrunkEdgePort(t, proc)
			uac := newPeer(t)
			// The caller's own Request-URI names a peer that must hear nothing
			uac.send(edge, strings.Replace(inviteText(uac.port, "fo7"), "INVITE sip:1002@127.0.0.1 ", fmt.Sprintf("INVITE sip:1002@127.0.0.1:%d ", self.port), 1))
			if first == "udp" {
				respondAs(a, edge, recvMethod(t, a, sip.INVITE), "503 Service Unavailable")
			}
			if res := finalOf(t, uac); res.StatusCode != 503 {
				t.Fatalf("%s: the caller got %d, want 503", name, res.StatusCode)
			}
			b.silent(300 * time.Millisecond)
			self.silent(300 * time.Millisecond)
		}
	})

	t.Run("a Trunk with one URI is asked once", func(t *testing.T) {
		a := newPeer(t)
		proc := &trunkProcessor{hops: []trunkHop{{"a", a.port, "udp"}}}
		_, edge, _ := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo8"))
		respondAs(a, edge, recvMethod(t, a, sip.INVITE), "503 Service Unavailable")
		if res := finalOf(t, uac); res.StatusCode != 503 {
			t.Fatalf("the caller got %d, want 503", res.StatusCode)
		}
		if n := len(proc.asked()); n != 1 {
			t.Errorf("the processor was asked %d times, want 1", n)
		}
	})

	t.Run("a caller that cancelled while A was failing gets no B", func(t *testing.T) {
		proc, a, b := twoURIs(t)
		_, edge, _ := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo9"))
		toA := recvMethod(t, a, sip.INVITE)
		uac.send(edge, cancelText(uac.port, "fo9"))
		expectCancelAnswers(t, uac)
		respondAs(a, edge, toA, "503 Service Unavailable")
		b.silent(700 * time.Millisecond)
		if len(proc.asked()) != 1 {
			t.Error("the processor was asked for another URI after the CANCEL")
		}
	})

	t.Run("a caller that cancels during the re-ask gets no B", func(t *testing.T) {
		proc, a, b := twoURIs(t)
		proc.reaskDelay = 600 * time.Millisecond
		_, edge, _ := startTrunkEdgePort(t, proc)
		uac := newPeer(t)
		uac.send(edge, inviteText(uac.port, "fo10"))
		respondAs(a, edge, recvMethod(t, a, sip.INVITE), "503 Service Unavailable")
		time.Sleep(150 * time.Millisecond)
		uac.send(edge, cancelText(uac.port, "fo10"))
		b.silent(1500 * time.Millisecond)
	})
}

// countingClient counts the calls to the processor and answers none.
type countingClient struct {
	mu    sync.Mutex
	calls int
}

func (c *countingClient) ProcessMessage(context.Context, *ppb.MessageRequest, ...grpc.CallOption) (*ppb.MessageResponse, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.calls++
	return nil, context.Canceled
}

func TestFlowTrunkFailoverNeverOnTimerB(t *testing.T) {
	l, _ := newTestLayer(0)
	server, conn := newServerTx(t, l, inviteMsg, "UDP")
	client := &countingClient{}
	e := deadHopEdge(l)
	e.client = client
	tx := &ClientTx{layer: l, invite: true, err: sip.ErrTransactionTimeout}
	tx.info.callID = "call-1"
	tx.info.server = server
	tx.info.failover = failoverState{tried: `["a"]`}
	e.onClientEnd(tx)
	done := make(chan struct{})
	e.queue.RunAlways("call-1", func() { close(done) })
	<-done
	if conn.count() != 1 || conn.written[0].(*sip.Response).StatusCode != 408 {
		t.Fatalf("the caller gets 408 after Timer B: %v", conn.written)
	}
	client.mu.Lock()
	defer client.mu.Unlock()
	if client.calls != 0 {
		t.Error("the processor was asked for another URI after Timer B")
	}
}
