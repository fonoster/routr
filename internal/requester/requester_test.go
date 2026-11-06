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

package requester

import (
	"bufio"
	"context"
	"io"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/requester"
	smpb "github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// registerRequest is what Registry sends (mods/registry/src/request.ts) for a
// trunk at target, with the REGISTER routed through route when it is not empty.
func registerRequest(target, route string, transport common.Transport) *pb.SendMessageRequest {
	name := strings.ToLower(transport.String())
	targetHost, _, _ := net.SplitHostPort(target)
	uri := func() *smpb.SipURI {
		return &smpb.SipURI{User: "pbx-1", Host: "sip.provider.net", Port: -1, TransportParam: name}
	}
	msg := &smpb.SIPMessage{
		MessageType: &smpb.SIPMessage_RequestUri{RequestUri: &smpb.SipURI{
			User: "pbx-1", Host: targetHost, TransportParam: name, MethodParam: "REGISTER",
		}},
		Extensions: []*smpb.Extension{
			{Name: "Allow", Value: "INVITE"},
			{Name: "Allow", Value: "ACK"},
			{Name: "CSeq", Value: "1 REGISTER"},
			{Name: "User-Agent", Value: "Routr Connect v2"},
			{Name: "Allow-Events", Value: "presence"},
			{Name: "Proxy-Require", Value: "gin"},
			{Name: "Require", Value: "gin"},
			{Name: "Supported", Value: "path"},
			{Name: "x-gateway-auth", Value: "cGJ4LTE6MTIzNA=="},
		},
		From:          &smpb.From{Address: &smpb.Address{Uri: uri()}, Tag: "abc"},
		To:            &smpb.To{Address: &smpb.Address{Uri: uri()}},
		CallId:        &smpb.CallID{CallId: "call-1"},
		ContentLength: &smpb.ContentLength{ContentLength: 0},
		Expires:       &smpb.Expires{Expires: 600},
		MaxForwards:   &smpb.MaxForwards{MaxForwards: 70},
	}
	if route != "" {
		host, p, _ := net.SplitHostPort(route)
		port, _ := strconv.Atoi(p)
		msg.Route = []*smpb.Route{{Address: &smpb.Address{Uri: &smpb.SipURI{
			Host: host, Port: int32(port), TransportParam: name, LrParam: true,
		}}}}
	}
	return &pb.SendMessageRequest{Target: target, Method: ppb.Method_REGISTER, Transport: transport, Message: msg}
}

func TestBuildRequestOnTheWire(t *testing.T) {
	req, err := buildRequest(registerRequest("sip.provider.net:5060", "10.1.1.2:5060", common.Transport_UDP), "10.1.1.9", 40000)
	if err != nil {
		t.Fatal(err)
	}
	got := regexp.MustCompile(`branch=z9hG4bK[0-9a-f]+`).ReplaceAllString(req.String(), "branch=z9hG4bK")
	want := "REGISTER sip:pbx-1@sip.provider.net:5060;transport=udp SIP/2.0\r\n" +
		"Via: SIP/2.0/UDP 10.1.1.9:40000;rport;branch=z9hG4bK\r\n" +
		"Route: <sip:10.1.1.2:5060;lr;transport=udp>\r\n" +
		"Max-Forwards: 70\r\n" +
		"Call-ID: call-1\r\n" +
		"From: <sip:pbx-1@sip.provider.net;transport=udp>;tag=abc\r\n" +
		"To: <sip:pbx-1@sip.provider.net;transport=udp>\r\n" +
		"Expires: 600\r\n" +
		"Allow: INVITE,ACK\r\n" +
		"CSeq: 1 REGISTER\r\n" +
		"User-Agent: Routr Connect v2\r\n" +
		"Allow-Events: presence\r\n" +
		"Proxy-Require: gin\r\n" +
		"Require: gin\r\n" +
		"Supported: path\r\n" +
		"x-gateway-auth: cGJ4LTE6MTIzNA==\r\n" +
		"Contact: <sip:10.1.1.9:40000;transport=udp;bnc>\r\n" +
		"Content-Length: 0\r\n\r\n"
	if got != want {
		t.Errorf("on the wire:\n%s\nwant:\n%s", got, want)
	}
	if req.Destination() != "10.1.1.2:5060" || req.Transport() != "UDP" {
		t.Errorf("next hop %s over %s", req.Destination(), req.Transport())
	}
}

func TestBuildRequestDoesNotMutateTheMessage(t *testing.T) {
	in := registerRequest("sip.provider.net:5060", "", common.Transport_UDP)
	if _, err := buildRequest(in, "10.1.1.9", 40000); err != nil {
		t.Fatal(err)
	}
	if len(in.GetMessage().GetVia()) != 0 || in.GetMessage().GetContact() != nil {
		t.Errorf("the message changed: %v", in.GetMessage())
	}
}

func TestBuildRequestValidation(t *testing.T) {
	cases := map[string]func(*pb.SendMessageRequest){
		"no method":   func(in *pb.SendMessageRequest) { in.Method = ppb.Method_UNKNOWN },
		"ack":         func(in *pb.SendMessageRequest) { in.Method = ppb.Method_ACK },
		"tls":         func(in *pb.SendMessageRequest) { in.Transport = common.Transport_TLS },
		"no message":  func(in *pb.SendMessageRequest) { in.Message = nil },
		"no target":   func(in *pb.SendMessageRequest) { in.Target = "" },
		"bad port":    func(in *pb.SendMessageRequest) { in.Target = "sip.local:five" },
		"no cseq":     func(in *pb.SendMessageRequest) { in.Message.Extensions = nil },
		"no to":       func(in *pb.SendMessageRequest) { in.Message.To = nil },
		"no from":     func(in *pb.SendMessageRequest) { in.Message.From = nil },
		"no call-id":  func(in *pb.SendMessageRequest) { in.Message.CallId = nil },
		"no forwards": func(in *pb.SendMessageRequest) { in.Message.MaxForwards = nil },
		"body, no type": func(in *pb.SendMessageRequest) {
			in.Message.Body = "v=0"
		},
		"route over tls": func(in *pb.SendMessageRequest) {
			in.Message.Route = []*smpb.Route{{Address: &smpb.Address{Uri: &smpb.SipURI{
				Host: "10.1.1.2", Port: 5061, TransportParam: "tls", LrParam: true,
			}}}}
		},
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			in := registerRequest("sip.local:5060", "", common.Transport_UDP)
			change(in)
			if _, err := buildRequest(in, "10.1.1.9", 40000); err == nil {
				t.Error("expected an error")
			}
		})
	}
}

func TestRequestURI(t *testing.T) {
	cases := []struct{ target, user, want string }{
		{"sip.local:5070", "pbx-1", "sip:pbx-1@sip.local:5070;transport=tcp"},
		{"sip.local:5070", "", "sip:sip.local:5070;transport=tcp"},
		{"sip.local", "pbx-1", "sip:pbx-1@sip.local;transport=tcp"},
	}
	for _, c := range cases {
		uri, err := requestURI(c.target, c.user, "tcp")
		if err != nil {
			t.Fatal(err)
		}
		if uri.String() != c.want {
			t.Errorf("requestURI(%q, %q) = %s, want %s", c.target, c.user, uri.String(), c.want)
		}
	}
}

func TestNextHop(t *testing.T) {
	req := sip.NewRequest(sip.REGISTER, sip.Uri{Scheme: "sip", Host: "sip.local", UriParams: sip.NewParams()})
	req.AppendHeader(viaHeader("tcp", "10.1.1.9", 40000))
	if got := nextHop(req); got != (hop{host: "sip.local", port: 5060, transport: "TCP"}) {
		t.Errorf("without a Route: %+v", got)
	}
	req.AppendHeader(sip.NewHeader("Route", "<sip:10.1.1.2:5070;lr;transport=udp>"))
	if got := nextHop(req); got != (hop{host: "10.1.1.2", port: 5070, transport: "UDP"}) {
		t.Errorf("with a Route: %+v", got)
	}
}

func TestTimeoutResponse(t *testing.T) {
	req, err := buildRequest(registerRequest("sip.local:5060", "", common.Transport_UDP), "10.1.1.9", 40000)
	if err != nil {
		t.Fatal(err)
	}
	out, err := toResponse(timeoutResponse(req))
	if err != nil {
		t.Fatal(err)
	}
	msg := out.GetMessage()
	if msg.GetResponseType() != smpb.ResponseType_REQUEST_TIMEOUT || msg.GetReasonPhrase() != reasonRequestTimeout {
		t.Errorf("got %s %q", msg.GetResponseType(), msg.GetReasonPhrase())
	}
	if msg.GetCallId().GetCallId() != "call-1" || len(msg.GetVia()) != 1 || msg.GetTo().GetTag() != "" {
		t.Errorf("headers of the request not kept: %v", msg)
	}
}

// answer is a far end's response to a request's text.
func answer(t *testing.T, raw []byte, status string, extra ...string) ([]byte, *sip.Request) {
	t.Helper()
	msg, err := sipconv.NewParser().ParseSIP(raw)
	if err != nil {
		t.Errorf("unparseable request: %s", err)
		return nil, nil
	}
	req := msg.(*sip.Request)
	lines := []string{"SIP/2.0 " + status}
	for _, h := range []sip.Header{req.Via(), req.From(), req.To(), req.CallID(), req.CSeq()} {
		lines = append(lines, h.Name()+": "+h.Value())
	}
	lines = append(lines, extra...)
	lines = append(lines, "Content-Length: 0", "", "")
	return []byte(strings.Join(lines, "\r\n")), req
}

func newRequester(t *testing.T) *Requester {
	t.Helper()
	r, err := New(Options{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), SIPHost: "127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(r.Close)
	return r
}

func TestSendMessageOverUDP(t *testing.T) {
	far, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer far.Close()
	r := newRequester(t)

	got := make(chan *sip.Request, 1)
	source := make(chan net.Addr, 1)
	go func() {
		buf := make([]byte, 65535)
		n, addr, err := far.ReadFrom(buf)
		if err != nil {
			return
		}
		res, req := answer(t, buf[:n], "200 OK", "Expires: 30")
		got <- req
		source <- addr
		_, _ = far.WriteTo(res, addr)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := r.SendMessage(ctx, registerRequest(far.LocalAddr().String(), "", common.Transport_UDP))
	if err != nil {
		t.Fatal(err)
	}
	if out.GetMessage().GetResponseType() != smpb.ResponseType_OK || out.GetMessage().GetExpires().GetExpires() != 30 {
		t.Errorf("response %v", out.GetMessage())
	}
	req := <-got
	if port := (<-source).(*net.UDPAddr).Port; port != r.port {
		t.Errorf("sent from port %d, not the listening point's %d", port, r.port)
	}
	if via := req.Via(); via.Host != "127.0.0.1" || via.Port != r.port || !via.Params.Has("rport") {
		t.Errorf("Via %s", via.Value())
	}
	if c := req.Contact(); c.Address.Port != r.port || !c.Address.UriParams.Has("bnc") {
		t.Errorf("Contact %s", c.Value())
	}
}

func TestBindSource(t *testing.T) {
	r := newRequester(t)
	over := func(transport string) *sip.Request {
		req := sip.NewRequest(sip.REGISTER, sip.Uri{Host: "provider"})
		req.SetTransport(transport)
		r.bindSource(req)
		return req
	}
	if req := over("UDP"); !req.Laddr.IP.Equal(r.udpAddr.IP) || req.Laddr.Port != r.udpAddr.Port {
		t.Errorf("UDP goes from the listening point's socket: %+v", req.Laddr)
	}
	req := over("TCP")
	if !req.Laddr.IP.Equal(r.udpAddr.IP) || req.Laddr.Port != 0 {
		t.Errorf("TCP dials from sipHost on a new port: %+v", req.Laddr)
	}
}

func TestSendMessageOverTCP(t *testing.T) {
	far, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer far.Close()
	r := newRequester(t)

	go func() {
		conn, err := far.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		reader := bufio.NewReader(conn)
		var raw strings.Builder
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			raw.WriteString(line)
			if line == "\r\n" {
				break
			}
		}
		res, _ := answer(t, []byte(raw.String()), "401 Unauthorized")
		_, _ = conn.Write(res)
		// The far end keeps the connection until the Requester is done
		_, _ = reader.ReadByte()
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := r.SendMessage(ctx, registerRequest(far.Addr().String(), "", common.Transport_TCP))
	if err != nil {
		t.Fatal(err)
	}
	if out.GetMessage().GetResponseType() != smpb.ResponseType_UNAUTHORIZED {
		t.Errorf("response %v", out.GetMessage())
	}
}

func TestSendMessageReturnsTheFirstResponse(t *testing.T) {
	far, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer far.Close()
	r := newRequester(t)

	go func() {
		buf := make([]byte, 65535)
		n, addr, err := far.ReadFrom(buf)
		if err != nil {
			return
		}
		trying, _ := answer(t, buf[:n], "100 Trying")
		ok, _ := answer(t, buf[:n], "200 OK")
		_, _ = far.WriteTo(trying, addr)
		time.Sleep(50 * time.Millisecond)
		_, _ = far.WriteTo(ok, addr)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := r.SendMessage(ctx, registerRequest(far.LocalAddr().String(), "", common.Transport_UDP))
	if err != nil {
		t.Fatal(err)
	}
	if out.GetMessage().GetResponseType() != smpb.ResponseType_TRYING {
		t.Errorf("response %v", out.GetMessage())
	}
}

func TestSendMessageInvalidArgument(t *testing.T) {
	r := newRequester(t)
	in := registerRequest("sip.local:5060", "", common.Transport_TLS)
	if _, err := r.SendMessage(context.Background(), in); status.Code(err) != codes.InvalidArgument {
		t.Errorf("got %v", err)
	}
}

func TestSendMessageCallerGivesUp(t *testing.T) {
	far, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer far.Close()
	r := newRequester(t)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, err = r.SendMessage(ctx, registerRequest(far.LocalAddr().String(), "", common.Transport_UDP))
	if status.Code(err) != codes.DeadlineExceeded {
		t.Errorf("got %v", err)
	}
}

func TestCloseReleasesTheWaitingCalls(t *testing.T) {
	far, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer far.Close()
	r := newRequester(t)

	errs := make(chan error, 1)
	go func() {
		_, err := r.SendMessage(context.Background(), registerRequest(far.LocalAddr().String(), "", common.Transport_UDP))
		errs <- err
	}()
	// Once the request is out, the call is waiting
	buf := make([]byte, 65535)
	if err := far.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if _, _, err := far.ReadFrom(buf); err != nil {
		t.Fatal(err)
	}
	r.Close()
	select {
	case err := <-errs:
		if status.Code(err) != codes.Unavailable {
			t.Errorf("got %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the call is still waiting")
	}
	// Closed: nothing is sent, and Close again is fine
	_, err = r.SendMessage(context.Background(), registerRequest(far.LocalAddr().String(), "", common.Transport_UDP))
	if status.Code(err) != codes.Unavailable {
		t.Errorf("after Close: got %v", err)
	}
	r.Close()
}

func TestNewBindsTCPAndUDPOnOnePort(t *testing.T) {
	r := newRequester(t)
	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(r.port))
	if _, err := net.Listen("tcp4", addr); err == nil {
		t.Errorf("tcp %s is not bound", addr)
	}
	if _, err := net.ListenPacket("udp4", addr); err == nil {
		t.Errorf("udp %s is not bound", addr)
	}
}

func TestSplitAddress(t *testing.T) {
	host, port, err := splitAddress("sip.local:5060")
	if err != nil || host != "sip.local" || port != 5060 {
		t.Errorf("got %s %d %v", host, port, err)
	}
	if _, _, err := splitAddress("sip.local"); err == nil || !strings.Contains(err.Error(), "malformated address; must be ${host}:${port}") {
		t.Errorf("malformed address: %v", err)
	}
	if _, _, err := splitAddress("sip.local:five"); err == nil || !strings.Contains(err.Error(), "expects port to be a number") {
		t.Errorf("malformed port: %v", err)
	}
}

func TestLocalIP(t *testing.T) {
	ip, err := localIP()
	if err != nil {
		t.Skip(err)
	}
	if parsed := net.ParseIP(ip); parsed == nil || parsed.To4() == nil || parsed.IsLoopback() {
		t.Errorf("got %q", ip)
	}
}

func TestLoadConfig(t *testing.T) {
	cfg, err := LoadConfig("")
	if err != nil || cfg.Spec.BindAddr != DefaultBindAddr || cfg.LogLevel != "info" {
		t.Errorf("defaults: %+v %v", cfg, err)
	}
	write := func(content string) string {
		path := filepath.Join(t.TempDir(), "requester.yaml")
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		return path
	}
	const head = "kind: Requester\napiVersion: v2beta1\nmetadata:\n  ref: requester\n"
	cfg, err = LoadConfig(write(head + "logLevel: debug\nspec:\n  bindAddr: 0.0.0.0:6000\n"))
	if err != nil || cfg.Spec.BindAddr != "0.0.0.0:6000" || cfg.LogLevel != "debug" {
		t.Errorf("file: %+v %v", cfg, err)
	}
	for name, content := range map[string]string{
		"kind":     "kind: Other\napiVersion: v2beta1\nmetadata: {}\nspec: {}\n",
		"version":  "kind: Requester\napiVersion: v1\nmetadata: {}\nspec: {}\n",
		"no spec":  head,
		"level":    head + "logLevel: loud\nspec: {}\n",
		"bindAddr": head + "spec:\n  bindAddr: nowhere\n",
	} {
		if _, err := LoadConfig(write(content)); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
	if _, err := LoadConfig(filepath.Join(t.TempDir(), "missing.yaml")); err == nil {
		t.Error("missing file: expected an error")
	}
}
