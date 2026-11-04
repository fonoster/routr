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
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/mods/edgeport-go/internal/config"
	"github.com/fonoster/routr/mods/edgeport-go/internal/pb/common"
	ppb "github.com/fonoster/routr/mods/edgeport-go/internal/pb/processor"
	pb "github.com/fonoster/routr/mods/edgeport-go/internal/pb/sipmessage"
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
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := grpc.NewServer()
	ppb.RegisterProcessorServer(srv, proc)
	go func() { _ = srv.Serve(l) }()
	t.Cleanup(srv.Stop)

	port := freeUDPPort(t)
	proc.edgePort = port
	cfg, err := config.Parse([]byte(fmt.Sprintf(`
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
`, l.Addr().String(), port)))
	if err != nil {
		t.Fatal(err)
	}
	ep, err := New(cfg, Options{Version: "test"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = ep.Start(ctx) }()
	time.Sleep(200 * time.Millisecond)
	return port
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

func TestFlowInviteIsProxied(t *testing.T) {
	proc := &fakeProcessor{answerAcks: true}
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

	// The ACK for the 2xx goes statelessly; the processor's response to it is dropped
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
	if len(proc.requests(ppb.Method_ACK)) != 1 {
		t.Error("the processor saw the ACK")
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
