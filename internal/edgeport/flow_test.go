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
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// fakeProcessor answers MESSAGE itself, has no processor for OPTIONS, and
// forwards everything else to the UAS, adding the EdgePort's Via as Connect does
// (and removing it from responses).
type fakeProcessor struct {
	ppb.UnimplementedProcessorServer
	edgePort int
	uas      int
	mu       sync.Mutex
	seen     []*ppb.MessageRequest
	// answerAcks makes it answer an ACK with a response, which must be dropped
	answerAcks bool
	// answerInvites makes it answer an INVITE itself, with a 200
	answerInvites bool
	// failInvites makes it fail on an INVITE
	failInvites bool
	// deadHop is a TCP port no one listens on, where it sends an INVITE
	deadHop int32
}

func (p *fakeProcessor) ProcessMessage(_ context.Context, req *ppb.MessageRequest) (*ppb.MessageResponse, error) {
	p.mu.Lock()
	p.seen = append(p.seen, req)
	answerAcks := p.answerAcks
	p.mu.Unlock()
	msg := req.GetMessage()
	if _, isResponse := msg.GetMessageType().(*pb.SIPMessage_ResponseType); isResponse {
		msg.Via = msg.Via[1:]
		return &ppb.MessageResponse{Message: msg}, nil
	}
	switch req.GetMethod() {
	case ppb.Method_MESSAGE:
		return &ppb.MessageResponse{Message: &pb.SIPMessage{
			MessageType:  &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_OK},
			ReasonPhrase: "OK",
			Extensions:   []*pb.Extension{{Name: "X-Processed", Value: "yes"}},
		}}, nil
	case ppb.Method_OPTIONS:
		return nil, status.Error(codes.NotFound, "no processor")
	case ppb.Method_INVITE:
		if p.failInvites {
			return nil, status.Error(codes.Unavailable, "processor down")
		}
		if p.deadHop != 0 {
			msg.GetRequestUri().Host = "127.0.0.1"
			msg.GetRequestUri().Port = p.deadHop
			msg.GetRequestUri().TransportParam = "tcp"
			msg.Via = append([]*pb.Via{{Host: "127.0.0.1", Port: int32(p.edgePort), Transport: "TCP", RPortFlag: true,
				RPort: -1, Ttl: -1}}, msg.Via...)
			return &ppb.MessageResponse{Message: msg}, nil
		}
		if p.answerInvites {
			return &ppb.MessageResponse{Message: &pb.SIPMessage{
				MessageType:  &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_OK},
				ReasonPhrase: "OK",
			}}, nil
		}
	case ppb.Method_ACK:
		if answerAcks {
			return &ppb.MessageResponse{Message: &pb.SIPMessage{
				MessageType: &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_OK},
			}}, nil
		}
	}
	msg.GetRequestUri().Host = "127.0.0.1"
	msg.GetRequestUri().Port = int32(p.uas)
	msg.Via = append([]*pb.Via{{Host: "127.0.0.1", Port: int32(p.edgePort), Transport: "UDP", RPortFlag: true,
		RPort: -1, Ttl: -1}}, msg.Via...)
	msg.RecordRoute = append([]*pb.RecordRoute{{Address: &pb.Address{Uri: &pb.SipURI{
		Host: "127.0.0.1", Port: int32(p.edgePort), LrParam: true, TransportParam: "udp", TtlParam: -1}}}},
		msg.RecordRoute...)
	return &ppb.MessageResponse{Message: msg}, nil
}

func (p *fakeProcessor) requests(method ppb.Method) []*ppb.MessageRequest {
	p.mu.Lock()
	defer p.mu.Unlock()
	var out []*ppb.MessageRequest
	for _, r := range p.seen {
		if r.GetMethod() == method {
			out = append(out, r)
		}
	}
	return out
}

type peer struct {
	t    *testing.T
	conn net.PacketConn
	port int
}

func newPeer(t *testing.T) *peer {
	conn, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return &peer{t: t, conn: conn, port: conn.LocalAddr().(*net.UDPAddr).Port}
}

func (p *peer) send(to int, text string) {
	text = strings.ReplaceAll(strings.TrimLeft(text, "\n"), "\n", "\r\n")
	addr := &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: to}
	if _, err := p.conn.WriteTo([]byte(text), addr); err != nil {
		p.t.Fatal(err)
	}
}

// recv returns the next message that is not a 100 Trying, or fails.
func (p *peer) recv(within time.Duration) (sip.Message, *net.UDPAddr) {
	p.t.Helper()
	deadline := time.Now().Add(within)
	buf := make([]byte, 65535)
	for {
		_ = p.conn.SetReadDeadline(deadline)
		n, from, err := p.conn.ReadFrom(buf)
		if err != nil {
			p.t.Fatalf("nothing received: %v", err)
		}
		msg, err := sip.ParseMessage(buf[:n])
		if err != nil {
			p.t.Fatalf("unparseable: %v", err)
		}
		if res, ok := msg.(*sip.Response); ok && res.StatusCode == 100 {
			continue
		}
		return msg, from.(*net.UDPAddr)
	}
}

// silentBut is silent for a peer that may still see code retransmitted.
func (p *peer) silentBut(within time.Duration, code int) {
	p.t.Helper()
	buf := make([]byte, 65535)
	_ = p.conn.SetReadDeadline(time.Now().Add(within))
	for {
		n, _, err := p.conn.ReadFrom(buf)
		if err != nil {
			return
		}
		msg, err := sip.ParseMessage(buf[:n])
		if err != nil {
			continue
		}
		if res, ok := msg.(*sip.Response); ok && (res.StatusCode == 100 || res.StatusCode == code) {
			continue
		}
		p.t.Fatalf("unexpected message:\n%s", msg)
	}
}

func (p *peer) silent(within time.Duration) {
	p.t.Helper()
	buf := make([]byte, 65535)
	_ = p.conn.SetReadDeadline(time.Now().Add(within))
	for {
		n, _, err := p.conn.ReadFrom(buf)
		if err != nil {
			return
		}
		if msg, err := sip.ParseMessage(buf[:n]); err == nil {
			if res, ok := msg.(*sip.Response); ok && res.StatusCode == 100 {
				continue
			}
			p.t.Fatalf("unexpected message:\n%s", msg)
		}
	}
}

func freeUDPPort(t *testing.T) int {
	c, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	return c.LocalAddr().(*net.UDPAddr).Port
}

func startEdgePort(t *testing.T, proc *fakeProcessor) int {
	t.Helper()
	_, port := startEdgePortWith(t, proc)
	return port
}

// startEdgePortWith is startEdgePort with the EdgePort itself, for a test that
// drives one of its hooks by hand.
func startEdgePortWith(t *testing.T, proc *fakeProcessor) (*EdgePort, int) {
	t.Helper()
	return startEdgePortBehind(t, proc, 0)
}

// startEdgePortBehind starts the EdgePort against a processor that listens
// only after the delay: nothing accepts its connection before then.
func startEdgePortBehind(t *testing.T, proc *fakeProcessor, delay time.Duration) (*EdgePort, int) {
	t.Helper()
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := grpc.NewServer()
	ppb.RegisterProcessorServer(srv, proc)
	serve := func() {
		go func() { _ = srv.Serve(l) }()
	}
	if delay == 0 {
		serve()
	} else {
		// Give the address up until then: a refused connection, as a
		// Dispatcher that isn't up yet gives
		addr := l.Addr().String()
		_ = l.Close()
		time.AfterFunc(delay, func() {
			var err error
			if l, err = net.Listen("tcp4", addr); err != nil {
				t.Error(err)
				return
			}
			serve()
		})
	}
	t.Cleanup(srv.Stop)

	port := freeUDPPort(t)
	proc.edgePort = port
	cfg, err := config.ParseEdgePort([]byte(fmt.Sprintf(`
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-test
spec:
  bindAddr: 127.0.0.1
  processor:
    addr: %s
  methods: [INVITE, ACK, BYE, CANCEL, MESSAGE, REGISTER]
  externalAddrs: [127.0.0.1]
  localnets: [127.0.0.1/8]
  transport:
    - protocol: udp
      port: %d
`, l.Addr().String(), port)), config.ResolveOptions{Env: config.EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	// Over the wire, as a standalone EdgePort reaches its Dispatcher
	conn, err := grpc.NewClient(l.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	ep, err := New(cfg, Options{Processor: ppb.NewProcessorClient(conn), Version: "test"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = ep.Start(ctx) }()
	time.Sleep(200 * time.Millisecond)
	return ep, port
}

func TestFlowProcessorAnswersAMessage(t *testing.T) {
	proc := &fakeProcessor{}
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, fmt.Sprintf(`
MESSAGE sip:echo@127.0.0.1:%d SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-m1
Max-Forwards: 70
From: <sip:a@127.0.0.1>;tag=1
To: <sip:echo@127.0.0.1>
Call-ID: m1
CSeq: 1 MESSAGE
Content-Type: text/plain
Content-Length: 2

hi`, edge, uac.port))
	msg, _ := uac.recv(2 * time.Second)
	res := msg.(*sip.Response)
	if res.StatusCode != 200 || res.GetHeader("X-Processed") == nil {
		t.Fatalf("the processor's 200 with its header:\n%s", res)
	}
	if rport, _ := res.Via().Params.Get("rport"); rport == "" {
		t.Errorf("the Via says where it came from: %s", res.Via().Value())
	}
	reqs := proc.requests(ppb.Method_MESSAGE)
	if len(reqs) != 1 {
		t.Fatalf("the processor saw %d MESSAGEs", len(reqs))
	}
	r := reqs[0]
	if r.GetRef() != "m1" || r.GetEdgePortRef() != "edgeport-test" || r.GetMessage().GetBody() != "hi" {
		t.Errorf("MessageRequest: %v", r)
	}
	if s := r.GetSender(); s.GetHost() != "127.0.0.1" || s.GetPort() != int32(uac.port) || s.GetTransport() != common.Transport_UDP {
		t.Errorf("sender is the top Via's sent-by: %v", s)
	}
	if via := r.GetMessage().GetVia()[0]; via.GetRPort() != int32(uac.port) || via.GetReceived() != "127.0.0.1" {
		t.Errorf("the top Via is marked received/rport as JAIN-SIP does: %v", via)
	}
	if r.GetReceivedOn().GetHost() != "127.0.0.1" || r.GetReceivedOn().GetPort() != int32(edge) {
		t.Errorf("received_on names the listening point when bound to an address: %v", r.GetReceivedOn())
	}
}

func TestFlowNoProcessorIs501(t *testing.T) {
	proc := &fakeProcessor{}
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, fmt.Sprintf(`
OPTIONS sip:x@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-o1
From: <sip:a@127.0.0.1>;tag=1
To: <sip:x@127.0.0.1>
Call-ID: o1
CSeq: 1 OPTIONS
Content-Length: 0

`, uac.port))
	msg, _ := uac.recv(2 * time.Second)
	if res := msg.(*sip.Response); res.StatusCode != 501 {
		t.Fatalf("501 when no processor accepts the method:\n%s", res)
	}
}

func TestFlowForgedInDialogInviteIs481(t *testing.T) {
	proc := &fakeProcessor{}
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, fmt.Sprintf(`
INVITE sip:x@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-f1
From: <sip:a@127.0.0.1>;tag=1
To: <sip:x@127.0.0.1>;tag=forged
Call-ID: f1
CSeq: 1 INVITE
Content-Length: 0

`, uac.port))
	msg, _ := uac.recv(2 * time.Second)
	if res := msg.(*sip.Response); res.StatusCode != 481 {
		t.Fatalf("481 for a dialog this EdgePort did not proxy:\n%s", res)
	}
	if len(proc.requests(ppb.Method_INVITE)) != 0 {
		t.Error("the processor is not consulted")
	}
}

// establish runs an INVITE through the EdgePort up to its 200 and ACK, and gives
// the UAS's Contact address.
func establish(t *testing.T, edge int, uac, uas *peer, callID string) string {
	t.Helper()
	uac.send(edge, fmt.Sprintf(`
INVITE sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-%s
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>
Call-ID: %s
CSeq: 1 INVITE
Contact: <sip:1001@127.0.0.1:%d>
Content-Length: 0

`, uac.port, callID, callID, uac.port))
	msg, _ := uas.recv(2 * time.Second)
	in := msg.(*sip.Request)
	var b strings.Builder
	b.WriteString("SIP/2.0 200 OK\n")
	for _, v := range in.GetHeaders("Via") {
		b.WriteString("Via: " + v.Value() + "\n")
	}
	b.WriteString("Record-Route: <sip:198.51.100.7:5060;lr>\n")
	b.WriteString("Record-Route: " + in.GetHeader("Record-Route").Value() + "\n")
	b.WriteString("From: " + in.From().Value() + "\n")
	b.WriteString("To: " + in.To().Value() + ";tag=callee\n")
	fmt.Fprintf(&b, "Call-ID: %s\nCSeq: 1 INVITE\nContact: <sip:1002@127.0.0.1:%d>\nContent-Length: 0\n\n", callID, uas.port)
	uas.send(edge, b.String())
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
		t.Fatalf("the 200 is relayed: %v", res)
	}
	return fmt.Sprintf("127.0.0.1:%d", uas.port)
}

// answerOK answers a request the peer received with a 200, to the Vias on it.
func answerOK(p *peer, edge int, req *sip.Request) {
	var b strings.Builder
	b.WriteString("SIP/2.0 200 OK\n")
	for _, v := range req.GetHeaders("Via") {
		b.WriteString("Via: " + v.Value() + "\n")
	}
	b.WriteString("From: " + req.From().Value() + "\n")
	b.WriteString("To: " + req.To().Value() + "\n")
	b.WriteString("Call-ID: " + req.CallID().Value() + "\n")
	b.WriteString("CSeq: " + req.CSeq().Value() + "\nContent-Length: 0\n\n")
	p.send(edge, b.String())
}

func mustRecv(t *testing.T, p *peer) sip.Message {
	t.Helper()
	msg, _ := p.recv(2 * time.Second)
	return msg
}

// inDialogText is a request on the established dialog.
func inDialogText(method, ruri, callID, branch string, port, seq int, extra string) string {
	return fmt.Sprintf(`
%s sip:%s SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-%s
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>;tag=callee
Call-ID: %s
CSeq: %d %s
%sContent-Length: 0

`, method, ruri, port, branch, callID, seq, method, extra)
}

func expect481(t *testing.T, p *peer) {
	t.Helper()
	if res, ok := mustRecv(t, p).(*sip.Response); !ok || res.StatusCode != 481 {
		t.Fatalf("want 481: %v", res)
	}
}

func TestFlowInDialogIsNoOpenRelay(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	target := establish(t, edge, uac, uas, "relay1")
	forwarded := len(proc.requests(ppb.Method_BYE))

	t.Run("an unknown dialog is 481, for every method", func(t *testing.T) {
		for _, method := range []string{"BYE", "MESSAGE", "NOTIFY", "INFO", "UPDATE", "REFER"} {
			uac.send(edge, inDialogText(method, target, "forged-"+method, "f"+method, uac.port, 2, ""))
			expect481(t, uac)
		}
	})
	t.Run("a Request-URI that is no target of the dialog is 481", func(t *testing.T) {
		uac.send(edge, inDialogText("BYE", "victim@198.51.100.9:5060", "relay1", "r1", uac.port, 2, ""))
		expect481(t, uac)
		uac.send(edge, inDialogText("INFO", "victim@"+target+";maddr=198.51.100.9", "relay1", "r2", uac.port, 2, ""))
		expect481(t, uac)
	})
	t.Run("a Route the dialog doesn't have is 481", func(t *testing.T) {
		uac.send(edge, inDialogText("INFO", "1002@"+target, "relay1", "r3", uac.port, 2, "Route: <sip:198.51.100.9:5060;lr>\n"))
		expect481(t, uac)
	})
	t.Run("a forged ACK is dropped", func(t *testing.T) {
		uac.send(edge, inDialogText("ACK", "victim@198.51.100.9:5060", "relay1", "r4", uac.port, 1, ""))
		uac.send(edge, inDialogText("ACK", target, "forged-ack", "r5", uac.port, 1, ""))
		uac.silent(300 * time.Millisecond)
		uas.silent(100 * time.Millisecond)
	})
	if got := len(proc.requests(ppb.Method_BYE)); got != forwarded {
		t.Error("the processor saw a forged BYE")
	}
	t.Run("a stray 200 adds no target", func(t *testing.T) {
		uac.send(edge, fmt.Sprintf(`
SIP/2.0 200 OK
Via: SIP/2.0/UDP 127.0.0.1:%d;branch=z9hG4bK-stray
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>;tag=callee
Call-ID: relay1
CSeq: 9 INVITE
Contact: <sip:evil@198.51.100.9:5060>
Content-Length: 0

`, uac.port))
		time.Sleep(100 * time.Millisecond)
		uac.send(edge, inDialogText("INFO", "evil@198.51.100.9:5060", "relay1", "r6", uac.port, 3, ""))
		expect481(t, uac)
	})
}

func TestFlowInDialogKeepsWorking(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	target := establish(t, edge, uac, uas, "keep1")
	received := func(method sip.RequestMethod) *sip.Request {
		t.Helper()
		req, ok := mustRecv(t, uas).(*sip.Request)
		if !ok || req.Method != method {
			t.Fatalf("the %s reaches the callee: %v", method, req)
		}
		return req
	}
	// exchange takes the request at the UAS and answers it, back to who sent it
	exchange := func(from *peer, method sip.RequestMethod) {
		t.Helper()
		answerOK(uas, edge, received(method))
		if res, ok := mustRecv(t, from).(*sip.Response); !ok || res.StatusCode != 200 {
			t.Fatalf("the %s is answered: %v", method, res)
		}
	}

	uac.send(edge, inDialogText("ACK", "1002@"+target, "keep1", "k1", uac.port, 1, ""))
	received(sip.ACK)

	t.Run("a Route of the dialog's Record-Route passes", func(t *testing.T) {
		uac.send(edge, inDialogText("INFO", "1002@"+target, "keep1", "k2", uac.port, 2, "Route: <sip:198.51.100.7:5060;lr>\n"))
		// The UDP goes to the proxy, which isn't there: no 481 is all there is to see.
		// Silence, or a 503 where the host refuses the send at once (no route).
		buf := make([]byte, 65535)
		_ = uac.conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
		if n, _, err := uac.conn.ReadFrom(buf); err == nil {
			msg, parseErr := sip.ParseMessage(buf[:n])
			if res, ok := msg.(*sip.Response); parseErr != nil || !ok || res.StatusCode != 503 {
				t.Fatalf("got %v, %v", msg, parseErr)
			}
		}
	})
	t.Run("a Request-URI at the next proxy passes", func(t *testing.T) {
		uac.send(edge, inDialogText("INFO", "198.51.100.7:5060", "keep1", "k3", uac.port, 3, ""))
		exchange(uac, sip.INFO) // The fake processor points everything at the UAS
	})
	t.Run("a target refresh takes effect", func(t *testing.T) {
		uac.send(edge, inDialogText("BYE", "1001@203.0.113.1:5060", "keep1", "k4", uac.port, 4, ""))
		expect481(t, uac)
		uas.send(edge, inDialogText("UPDATE", "1001@127.0.0.1:"+fmt.Sprint(uac.port), "keep1", "k5", uas.port, 1, "Contact: <sip:1001@203.0.113.1:5060>\n"))
		exchange(uas, sip.UPDATE)
		uac.send(edge, inDialogText("INFO", "1001@203.0.113.1:5060", "keep1", "k6", uac.port, 5, ""))
		exchange(uac, sip.INFO)
	})

	t.Run("a BYE, sent again on its transaction and then the NOTIFY that follows it", func(t *testing.T) {
		bye := inDialogText("BYE", "1002@"+target, "keep1", "k7", uac.port, 6, "")
		uac.send(edge, bye)
		exchange(uac, sip.BYE)
		uac.send(edge, bye)
		if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
			t.Fatalf("the BYE sent again is answered again: %v", res)
		}

		uas.send(edge, inDialogText("NOTIFY", "1001@127.0.0.1:"+fmt.Sprint(uac.port), "keep1", "k8", uas.port, 2, "Event: refer\n"))
		exchange(uas, sip.NOTIFY)

		uac.send(edge, inDialogText("REFER", "1002@"+target, "keep1", "k9", uac.port, 7, ""))
		expect481(t, uac)
	})
}

func TestFlowAProcessorThatAnswersTheInviteHoldsTheDialog(t *testing.T) {
	proc := &fakeProcessor{answerInvites: true}
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, fmt.Sprintf(`
INVITE sip:echo@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-p1
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:echo@127.0.0.1>
Call-ID: p1
CSeq: 1 INVITE
Contact: <sip:1001@127.0.0.1:%d>
Content-Length: 0

`, uac.port, uac.port))
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
		t.Fatalf("the processor answers: %v", res)
	}
	uac.send(edge, inDialogText("MESSAGE", "1001@127.0.0.1:"+fmt.Sprint(uac.port), "p1", "p2", uac.port, 2, ""))
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
		t.Fatalf("the request reaches the processor: %v", res)
	}
}

func TestFlowInviteIsProxied(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	edge := startEdgePort(t, proc)
	uac := newPeer(t)

	uac.send(edge, fmt.Sprintf(`
INVITE sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-i1
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>
Call-ID: i1
CSeq: 1 INVITE
Contact: <sip:1001@127.0.0.1:%d>
Allow: INVITE, ACK, BYE
Content-Length: 0

`, uac.port, uac.port))

	msg, from := uas.recv(2 * time.Second)
	in := msg.(*sip.Request)
	if from.Port != edge {
		t.Errorf("sent from the listening point's socket, as JAIN-SIP does: %v", from)
	}
	vias := in.GetHeaders("Via")
	if len(vias) != 2 {
		t.Fatalf("the EdgePort's Via on top of the caller's:\n%s", in)
	}
	branch, _ := in.Via().Params.Get("branch")
	if !strings.HasPrefix(branch, sip.RFC3261BranchMagicCookie) {
		t.Errorf("a branch is generated for the processor's Via: %s", in.Via().Value())
	}
	if in.Recipient.Port != uas.port || in.GetHeader("Record-Route") == nil {
		t.Errorf("forwarded with the processor's Request-URI and Record-Route:\n%s", in)
	}
	if got := in.GetHeader("Allow").Value(); got != "INVITE,ACK,BYE" {
		t.Errorf("list headers joined as JAIN-SIP joins them: %q", got)
	}

	reply := func(code int, reason, toTag string) string {
		var b strings.Builder
		fmt.Fprintf(&b, "SIP/2.0 %d %s\n", code, reason)
		for _, v := range vias {
			b.WriteString("Via: " + v.Value() + "\n")
		}
		b.WriteString("Record-Route: " + in.GetHeader("Record-Route").Value() + "\n")
		b.WriteString("From: " + in.From().Value() + "\n")
		b.WriteString("To: " + in.To().Value() + ";tag=" + toTag + "\n")
		b.WriteString("Call-ID: i1\nCSeq: 1 INVITE\n")
		fmt.Fprintf(&b, "Contact: <sip:1002@127.0.0.1:%d>\nContent-Length: 0\n\n", uas.port)
		return b.String()
	}
	uas.send(edge, reply(180, "Ringing", "callee"))
	msg, _ = uac.recv(2 * time.Second)
	if res := msg.(*sip.Response); res.StatusCode != 180 || len(res.GetHeaders("Via")) != 1 {
		t.Fatalf("180 relayed without the EdgePort's Via:\n%s", msg)
	}
	uas.send(edge, reply(200, "OK", "callee"))
	msg, _ = uac.recv(2 * time.Second)
	ok := msg.(*sip.Response)
	if ok.StatusCode != 200 {
		t.Fatalf("200 relayed:\n%s", ok)
	}
	if tag, _ := ok.To().Params.Get("tag"); tag != "callee" {
		t.Errorf("the callee's To tag kept: %s", ok.To().Value())
	}

	// The ACK for the 2xx, on the INVITE's branch as SIPp sends it, is forwarded
	uac.send(edge, fmt.Sprintf(`
ACK sip:1002@127.0.0.1:%d SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-i1
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>;tag=callee
Call-ID: i1
CSeq: 1 ACK
Content-Length: 0

`, uas.port, uac.port))
	msg, _ = uas.recv(2 * time.Second)
	if ack, ok := msg.(*sip.Request); !ok || ack.Method != sip.ACK {
		t.Fatalf("the ACK reaches the callee:\n%s", msg)
	}

	// Another ACK goes statelessly; the processor's response to it is dropped
	proc.mu.Lock()
	proc.answerAcks = true
	proc.mu.Unlock()
	uac.send(edge, fmt.Sprintf(`
ACK sip:1002@127.0.0.1:%d SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-a1
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>;tag=callee
Call-ID: i1
CSeq: 1 ACK
Content-Length: 0

`, uas.port, uac.port))
	uac.silent(500 * time.Millisecond)
	if len(proc.requests(ppb.Method_ACK)) != 2 {
		t.Error("the processor saw both ACKs")
	}

	// A re-INVITE on the dialog is now known: forwarded, not 481
	proc.mu.Lock()
	proc.answerAcks = false
	proc.mu.Unlock()
	uac.send(edge, fmt.Sprintf(`
INVITE sip:1002@127.0.0.1:%d SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-i2
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>;tag=callee
Call-ID: i1
CSeq: 2 INVITE
Content-Length: 0

`, uas.port, uac.port))
	msg, _ = uas.recv(2 * time.Second)
	if req, ok := msg.(*sip.Request); !ok || req.Method != sip.INVITE || req.CSeq().SeqNo != 2 {
		t.Fatalf("the re-INVITE is forwarded:\n%s", msg)
	}
}

func TestFlowCancel(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	invite := fmt.Sprintf(`
INVITE sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-c1
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>
Call-ID: c1
CSeq: 1 INVITE
Content-Length: 0

`, uac.port)
	uac.send(edge, invite)
	msg, _ := uas.recv(2 * time.Second)
	forwarded := msg.(*sip.Request)
	respondAs(uas, edge, forwarded, "180 Ringing")
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 180 {
		t.Fatalf("the 180 is relayed: %v", res)
	}

	uac.send(edge, fmt.Sprintf(`
CANCEL sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-c1
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>
Call-ID: c1
CSeq: 1 CANCEL
Content-Length: 0

`, uac.port))
	codes := map[int]bool{}
	for i := 0; i < 2; i++ {
		msg, _ := uac.recv(2 * time.Second)
		codes[msg.(*sip.Response).StatusCode] = true
	}
	if !codes[200] || !codes[487] {
		t.Fatalf("200 for the CANCEL and 487 for the INVITE: %v", codes)
	}

	msg, _ = uas.recv(2 * time.Second)
	cancel, ok := msg.(*sip.Request)
	if !ok || cancel.Method != sip.CANCEL {
		t.Fatalf("the CANCEL is sent downstream:\n%s", msg)
	}
	ib, _ := forwarded.Via().Params.Get("branch")
	cb, _ := cancel.Via().Params.Get("branch")
	if ib != cb || cancel.CSeq().SeqNo != forwarded.CSeq().SeqNo {
		t.Errorf("the CANCEL matches the forwarded INVITE (RFC 3261 section 9.1):\n%s\n%s", forwarded, cancel)
	}
}

// respondAs answers a request the peer received, with the To tag callee and a
// Contact at the peer.
func respondAs(p *peer, edge int, req *sip.Request, status string) {
	var b strings.Builder
	b.WriteString("SIP/2.0 " + status + "\n")
	for _, v := range req.GetHeaders("Via") {
		b.WriteString("Via: " + v.Value() + "\n")
	}
	b.WriteString("From: " + req.From().Value() + "\n")
	b.WriteString("To: " + req.To().Value() + ";tag=callee\n")
	b.WriteString("Call-ID: " + req.CallID().Value() + "\n")
	fmt.Fprintf(&b, "CSeq: %s\nContact: <sip:1002@127.0.0.1:%d>\nContent-Length: 0\n\n", req.CSeq().Value(), p.port)
	p.send(edge, b.String())
}

// recvMethod reads a peer's messages up to the next request of method; an INVITE
// on its way may be retransmitted before it.
func recvMethod(t *testing.T, p *peer, method sip.RequestMethod) *sip.Request {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if req, ok := mustRecv(t, p).(*sip.Request); ok && req.Method == method {
			return req
		}
	}
	t.Fatalf("no %s received", method)
	return nil
}

func inviteText(uacPort int, callID string) string {
	return fmt.Sprintf(`
INVITE sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-%s
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>
Call-ID: %s
CSeq: 1 INVITE
Content-Length: 0

`, uacPort, callID, callID)
}

func cancelText(uacPort int, callID string) string {
	return fmt.Sprintf(`
CANCEL sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-%s
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: <sip:1002@127.0.0.1>
Call-ID: %s
CSeq: 1 CANCEL
Content-Length: 0

`, uacPort, callID, callID)
}

func expectCancelAnswers(t *testing.T, uac *peer) *sip.Response {
	t.Helper()
	var terminated *sip.Response
	codes := map[int]bool{}
	for i := 0; i < 2; i++ {
		res := mustRecv(t, uac).(*sip.Response)
		codes[res.StatusCode] = true
		if res.StatusCode == 487 {
			terminated = res
		}
	}
	if !codes[200] || !codes[487] {
		t.Fatalf("200 for the CANCEL and 487 for the INVITE: %v", codes)
	}
	return terminated
}

func TestFlowCancelWaitsForAProvisional(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, inviteText(uac.port, "held1"))
	forwarded := mustRecv(t, uas).(*sip.Request)
	uac.send(edge, cancelText(uac.port, "held1"))
	expectCancelAnswers(t, uac)
	uas.silent(200 * time.Millisecond)
	respondAs(uas, edge, forwarded, "180 Ringing")
	cancel := recvMethod(t, uas, sip.CANCEL)
	ib, _ := forwarded.Via().Params.Get("branch")
	if cb, _ := cancel.Via().Params.Get("branch"); ib != cb {
		t.Errorf("the CANCEL matches the forwarded INVITE:\n%s\n%s", forwarded, cancel)
	}
}

func TestFlowA2xxThatCrossedACancelIsAckedAndEnded(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, inviteText(uac.port, "cross1"))
	forwarded := mustRecv(t, uas).(*sip.Request)
	respondAs(uas, edge, forwarded, "180 Ringing")
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 180 {
		t.Fatalf("the 180 is relayed: %v", res)
	}
	uac.send(edge, cancelText(uac.port, "cross1"))
	terminated := expectCancelAnswers(t, uac)
	recvMethod(t, uas, sip.CANCEL)

	// The callee answered before it saw the CANCEL
	respondAs(uas, edge, forwarded, "200 OK")
	ack := recvMethod(t, uas, sip.ACK)
	bye := recvMethod(t, uas, sip.BYE)
	for _, req := range []*sip.Request{ack, bye} {
		if tag, _ := req.To().Params.Get("tag"); tag != "callee" {
			t.Errorf("the 2xx's To:\n%s", req)
		}
		if len(req.GetHeaders("Via")) != 1 {
			t.Errorf("the EdgePort's own Via alone:\n%s", req)
		}
	}
	if ack.CSeq().SeqNo != forwarded.CSeq().SeqNo || bye.CSeq().SeqNo != forwarded.CSeq().SeqNo+1 {
		t.Errorf("CSeq: ACK %d, BYE %d", ack.CSeq().SeqNo, bye.CSeq().SeqNo)
	}
	answerOK(uas, edge, bye)
	// A retransmission gets the ACK and no second BYE
	respondAs(uas, edge, forwarded, "200 OK")
	recvMethod(t, uas, sip.ACK)
	// The caller's ACK to the 487 stays here, and the caller hears of none of it
	uac.send(edge, fmt.Sprintf(`
ACK sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-cross1
Max-Forwards: 70
From: <sip:1001@127.0.0.1>;tag=caller
To: %s
Call-ID: cross1
CSeq: 1 ACK
Content-Length: 0

`, uac.port, terminated.To().Value()))
	uas.silent(200 * time.Millisecond)
	uac.silentBut(200*time.Millisecond, 487)
}

func TestFlowAProcessorFailureIs503(t *testing.T) {
	proc := &fakeProcessor{failInvites: true}
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, inviteText(uac.port, "down1"))
	res, ok := mustRecv(t, uac).(*sip.Response)
	if !ok || res.StatusCode != 503 {
		t.Fatalf("got %v", res)
	}
	if tag, ok := res.To().Params.Get("tag"); !ok || tag == "" {
		t.Errorf("no To tag:\n%s", res)
	}
}

func TestFlowARefusedConnectionIs503(t *testing.T) {
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := l.Addr().(*net.TCPAddr).Port
	_ = l.Close()
	proc := &fakeProcessor{deadHop: int32(port)}
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, inviteText(uac.port, "dead1"))
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 503 {
		t.Fatalf("got %v", res)
	}
}

// A restart or a new replica under load: the EdgePort's connection to its
// processor comes up after the first requests arrive (#572).
func TestFlowRequestsWaitForTheProcessorConnection(t *testing.T) {
	proc := &fakeProcessor{}
	_, edge := startEdgePortBehind(t, proc, 1500*time.Millisecond)
	uac := newPeer(t)
	const n = 5
	for i := range n {
		uac.send(edge, fmt.Sprintf(`
MESSAGE sip:echo@127.0.0.1:%d SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-w%d
Max-Forwards: 70
From: <sip:a@127.0.0.1>;tag=1
To: <sip:echo@127.0.0.1>
Call-ID: w%d
CSeq: 1 MESSAGE
Content-Length: 0

`, edge, uac.port, i, i))
		time.Sleep(100 * time.Millisecond)
	}
	answered := map[string]int{}
	deadline := time.Now().Add(8 * time.Second)
	for len(answered) < n && time.Now().Before(deadline) {
		msg, _ := uac.recv(time.Until(deadline))
		if res, ok := msg.(*sip.Response); ok {
			answered[res.CallID().Value()] = res.StatusCode
		}
	}
	if len(answered) != n {
		t.Fatalf("%d of %d requests answered: %v", len(answered), n, answered)
	}
	for id, code := range answered {
		if code != 200 {
			t.Errorf("%s got %d, not the processor's 200", id, code)
		}
	}
}

// Timer C's three minutes are proven with the wheel stepped by hand
// (tx_test.go); this fires the EdgePort's side of it on a real call.
func TestFlowTimerCCancelsDownstreamAndAnswers408(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	ep, edge := startEdgePortWith(t, proc)
	uac := newPeer(t)
	uac.send(edge, inviteText(uac.port, "tc1"))
	forwarded := recvMethod(t, uas, sip.INVITE)
	respondAs(uas, edge, forwarded, "180 Ringing")
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 180 {
		t.Fatalf("the 180 is relayed: %v", res)
	}

	client := ep.txm.ClientTransaction("tc1")
	if client == nil {
		t.Fatal("no client transaction for the INVITE")
	}
	ep.onClientTimerC(client)

	cancel := recvMethod(t, uas, sip.CANCEL)
	ib, _ := forwarded.Via().Params.Get("branch")
	if cb, _ := cancel.Via().Params.Get("branch"); ib != cb || cancel.CSeq().SeqNo != forwarded.CSeq().SeqNo {
		t.Errorf("the CANCEL matches the forwarded INVITE (RFC 3261 section 9.1):\n%s\n%s", forwarded, cancel)
	}
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 408 {
		t.Fatalf("the caller gets a 408: %v", res)
	}

	// The far end ends its leg: the 487 is acked and nothing more goes upstream
	respondAs(uas, edge, cancel, "200 OK")
	respondAs(uas, edge, forwarded, "487 Request Terminated")
	recvMethod(t, uas, sip.ACK)
	uac.silent(500 * time.Millisecond)
}
