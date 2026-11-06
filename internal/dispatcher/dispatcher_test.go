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

package dispatcher

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The behavior spec: mods/dispatcher/test/dispatcher.unit.test.ts, plus the
// middleware semantics of processor.ts and run_middlewares.ts.

// fakeBackend is a Backend whose answer the test chooses. It records what it
// was asked, in order, so a test can check the chain.
type fakeBackend struct {
	mu     sync.Mutex
	calls  []*processor.MessageRequest
	handle func(req *processor.MessageRequest) (*processor.MessageResponse, error)
	closed int
}

func (b *fakeBackend) ProcessMessage(_ context.Context, req *processor.MessageRequest, _ ...grpc.CallOption) (*processor.MessageResponse, error) {
	b.mu.Lock()
	b.calls = append(b.calls, req)
	b.mu.Unlock()
	return b.handle(req)
}

func (b *fakeBackend) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.closed++
	return nil
}

func (b *fakeBackend) requests() []*processor.MessageRequest {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]*processor.MessageRequest(nil), b.calls...)
}

// echo answers with the message it got, as the Node test's stub did
func echo(req *processor.MessageRequest) (*processor.MessageResponse, error) {
	return &processor.MessageResponse{Sender: req.GetSender(), Message: req.GetMessage(), Metadata: req.GetMetadata()}, nil
}

// fakeDialer hands out the fakes by address and counts the dials
type fakeDialer struct {
	mu       sync.Mutex
	backends map[string]*fakeBackend
	dials    []string
}

func newFakeDialer() *fakeDialer {
	return &fakeDialer{backends: map[string]*fakeBackend{}}
}

func (d *fakeDialer) on(addr string, handle func(*processor.MessageRequest) (*processor.MessageResponse, error)) *fakeBackend {
	b := &fakeBackend{handle: handle}
	d.backends[addr] = b
	return b
}

func (d *fakeDialer) dial(addr string) (Backend, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.dials = append(d.dials, addr)
	b, ok := d.backends[addr]
	if !ok {
		return nil, errors.New("no fake for " + addr)
	}
	return b, nil
}

var (
	config1 = ProcessorConfig{Ref: "processor-ref1", Addr: "localhost:51903", Methods: []string{"REGISTER"}, MatchFunc: "req => true"}
	config2 = ProcessorConfig{Ref: "processor-ref2", Addr: "remotehost:50055", Methods: []string{"REGISTER", "INVITE"}, MatchFunc: "req => true"}
	config3 = ProcessorConfig{Ref: "processor-ref3", Addr: "remotehost:50056", Methods: []string{"REGISTER", "INVITE", "MESSAGE"}, MatchFunc: "() => true"}
)

func testConfig(processors []ProcessorConfig, middlewares []MiddlewareConfig) *Config {
	return &Config{
		Kind: "MessageDispatcher", APIVersion: "v2beta1", Ref: "message-dispatcher",
		Spec: Spec{BindAddr: DefaultBindAddr, Processors: processors, Middlewares: middlewares},
	}
}

func registerRequest() *processor.MessageRequest {
	return &processor.MessageRequest{
		Ref:         "call-id",
		EdgePortRef: "d001",
		Method:      processor.Method_REGISTER,
		ListeningPoints: []*processor.NetInterface{
			{Host: "localhost", Port: 5060, Transport: common.Transport_TCP},
		},
		Sender:  &processor.NetInterface{Host: "localhost", Port: 5060, Transport: common.Transport_TCP},
		Message: requestMessage(),
	}
}

func requestMessage() *sipmessage.SIPMessage {
	return &sipmessage.SIPMessage{
		MessageType: &sipmessage.SIPMessage_RequestUri{RequestUri: &sipmessage.SipURI{Host: "sip.local", User: "1001"}},
		From:        &sipmessage.From{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{User: "1001", Host: "sip.local"}}},
	}
}

func responseMessage(t sipmessage.ResponseType) *sipmessage.SIPMessage {
	return &sipmessage.SIPMessage{MessageType: &sipmessage.SIPMessage_ResponseType{ResponseType: t}}
}

func mustNew(t *testing.T, cfg *Config, dialer *fakeDialer) *Dispatcher {
	t.Helper()
	d, err := New(cfg, Options{Dial: dialer.dial, Logger: quietLogger})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d
}

var quietLogger = slog.New(slog.NewTextHandler(io.Discard, nil))

func TestNewRejectsNilConfig(t *testing.T) {
	if _, err := New(nil, Options{}); err == nil {
		t.Fatal("expected an error for a nil config")
	}
}

func TestNewDialsEveryBackendAddressOnce(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on("localhost:51903", echo)
	dialer.on("remotehost:50055", echo)
	dialer.on("mid:51903", echo)
	shared := ProcessorConfig{Ref: "shares-the-address", Addr: "localhost:51903", Methods: []string{"INVITE"}, MatchFunc: "req => true"}
	d := mustNew(t, testConfig([]ProcessorConfig{config1, config2, shared}, []MiddlewareConfig{{Ref: "mid", Addr: "mid:51903"}}), dialer)

	if got := strings.Join(dialer.dials, ","); got != "localhost:51903,remotehost:50055,mid:51903" {
		t.Fatalf("dials = %s", got)
	}
	if err := d.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	for addr, b := range dialer.backends {
		if b.closed != 1 {
			t.Errorf("backend %s closed %d times, want 1", addr, b.closed)
		}
	}
}

func TestNewFailsWhenAMatchFuncDoesNotLoad(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on("localhost:51903", echo)
	bad := ProcessorConfig{Ref: "bad", Addr: "localhost:51903", Methods: []string{"INVITE"}, MatchFunc: "req => req.method ==="}
	_, err := New(testConfig([]ProcessorConfig{config1, bad}, nil), Options{Dial: dialer.dial})
	if err == nil || !strings.Contains(err.Error(), "processor ref = bad") {
		t.Fatalf("expected an error naming the processor, got %v", err)
	}
	// What was dialed before the failure is closed again
	if dialer.backends["localhost:51903"].closed != 1 {
		t.Fatalf("backend closed %d times, want 1", dialer.backends["localhost:51903"].closed)
	}
}

func TestNewFailsWhenABackendCannotBeDialed(t *testing.T) {
	dialer := newFakeDialer()
	_, err := New(testConfig([]ProcessorConfig{config1}, nil), Options{Dial: dialer.dial})
	if err == nil || !strings.Contains(err.Error(), "processor ref = processor-ref1") {
		t.Fatalf("expected an error naming the processor, got %v", err)
	}
	_, err = New(testConfig([]ProcessorConfig{}, []MiddlewareConfig{{Ref: "mid", Addr: "mid:1"}}), Options{Dial: dialer.dial})
	if err == nil || !strings.Contains(err.Error(), "middleware ref = mid") {
		t.Fatalf("expected an error naming the middleware, got %v", err)
	}
}

// "callback gets invoke with an error": a processor failure that is not
// UNAVAILABLE is swallowed and the request comes back as the answer.
func TestProcessMessageSwallowsOtherProcessorErrors(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on(config1.Addr, func(*processor.MessageRequest) (*processor.MessageResponse, error) {
		return nil, status.Error(codes.Internal, "boom")
	})
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, nil), dialer)

	req := registerRequest()
	res, err := d.ProcessMessage(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !proto.Equal(res.GetMessage(), req.GetMessage()) || !proto.Equal(res.GetSender(), req.GetSender()) {
		t.Fatalf("expected the request back, got %v", res)
	}
}

// "it invokes callback with correct response"
func TestProcessMessageReturnsTheProcessorsAnswer(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on(config1.Addr, echo)
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, nil), dialer)

	req := registerRequest()
	req.Metadata = map[string]string{"x": "1"}
	res, err := d.ProcessMessage(context.Background(), req)
	if err != nil {
		t.Fatalf("ProcessMessage: %v", err)
	}
	want := &processor.MessageResponse{Sender: req.GetSender(), Message: req.GetMessage(), Metadata: req.GetMetadata()}
	if !proto.Equal(res, want) {
		t.Fatalf("response = %v, want %v", res, want)
	}
}

// "callback gets invoke with error 14(service unavailable)"
func TestProcessMessageProcessorUnavailable(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on(config1.Addr, func(*processor.MessageRequest) (*processor.MessageResponse, error) {
		return nil, status.Error(codes.Unavailable, "connection refused")
	})
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, nil), dialer)

	_, err := d.ProcessMessage(context.Background(), registerRequest())
	if status.Code(err) != codes.Unavailable {
		t.Fatalf("code = %v, want Unavailable", status.Code(err))
	}
	if msg := status.Convert(err).Message(); msg != "processor ref = processor-ref1 is unavailable" {
		t.Fatalf("message = %q", msg)
	}
}

func TestProcessMessageNoMatchingProcessor(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on(config1.Addr, echo)
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, nil), dialer)

	req := registerRequest()
	req.Method = processor.Method_PUBLISH
	_, err := d.ProcessMessage(context.Background(), req)
	if status.Code(err) != codes.NotFound {
		t.Fatalf("code = %v, want NotFound", status.Code(err))
	}
	if msg := status.Convert(err).Message(); msg != "not matching processor found for request ref: call-id" {
		t.Fatalf("message = %q", msg)
	}
}

func TestProcessMessageNeverMutatesTheRequest(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on(config1.Addr, func(req *processor.MessageRequest) (*processor.MessageResponse, error) {
		return &processor.MessageResponse{Message: responseMessage(sipmessage.ResponseType_OK)}, nil
	})
	dialer.on("mid:1", func(req *processor.MessageRequest) (*processor.MessageResponse, error) {
		msg := requestMessage()
		msg.To = &sipmessage.To{Tag: "mid"}
		return &processor.MessageResponse{Message: msg}, nil
	})
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, []MiddlewareConfig{{Ref: "mid", Addr: "mid:1"}}), dialer)

	req := registerRequest()
	before := proto.Clone(req)
	if _, err := d.ProcessMessage(context.Background(), req); err != nil {
		t.Fatalf("ProcessMessage: %v", err)
	}
	if !proto.Equal(req, before) {
		t.Fatalf("the request was changed: %v", req)
	}
}

func TestProcessMessageRunsMiddlewaresAroundTheProcessor(t *testing.T) {
	dialer := newFakeDialer()
	var order []string
	var mu sync.Mutex
	step := func(name string, tag string) func(*processor.MessageRequest) (*processor.MessageResponse, error) {
		return func(req *processor.MessageRequest) (*processor.MessageResponse, error) {
			mu.Lock()
			order = append(order, name+"<-"+req.GetMessage().GetTo().GetTag())
			mu.Unlock()
			msg := proto.Clone(req.GetMessage()).(*sipmessage.SIPMessage)
			msg.To = &sipmessage.To{Tag: tag}
			return &processor.MessageResponse{
				Sender:   &processor.NetInterface{Host: name},
				Message:  msg,
				Metadata: map[string]string{"from": name},
			}, nil
		}
	}
	dialer.on("pre1:1", step("pre1", "pre1"))
	dialer.on("pre2:1", step("pre2", "pre2"))
	dialer.on(config1.Addr, step("proc", "proc"))
	dialer.on("post1:1", step("post1", "post1"))
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, []MiddlewareConfig{
		{Ref: "post1", Addr: "post1:1", PostProcessor: true},
		{Ref: "pre1", Addr: "pre1:1"},
		{Ref: "pre2", Addr: "pre2:1", PostProcessor: false},
	}), dialer)

	res, err := d.ProcessMessage(context.Background(), registerRequest())
	if err != nil {
		t.Fatalf("ProcessMessage: %v", err)
	}
	if got := strings.Join(order, " "); got != "pre1<- pre2<-pre1 proc<-pre2 post1<-proc" {
		t.Fatalf("order = %s", got)
	}
	// The last message, the processor's sender and metadata (a middleware
	// response changes only the message)
	if res.GetMessage().GetTo().GetTag() != "post1" {
		t.Fatalf("message tag = %s, want post1", res.GetMessage().GetTo().GetTag())
	}
	if res.GetSender().GetHost() != "proc" || res.GetMetadata()["from"] != "proc" {
		t.Fatalf("sender/metadata = %v / %v, want the processor's", res.GetSender(), res.GetMetadata())
	}
	// The post middleware saw the request's own fields with the processor's message
	posts := dialer.backends["post1:1"].requests()
	if len(posts) != 1 || posts[0].GetRef() != "call-id" || posts[0].GetMethod() != processor.Method_REGISTER || posts[0].GetSender().GetHost() != "proc" {
		t.Fatalf("post middleware request = %v", posts)
	}
}

func TestProcessMessageAResponseFromAMiddlewareEndsTheChain(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on("pre1:1", func(*processor.MessageRequest) (*processor.MessageResponse, error) {
		return &processor.MessageResponse{Message: responseMessage(sipmessage.ResponseType_FORBIDDEN)}, nil
	})
	pre2 := dialer.on("pre2:1", echo)
	proc := dialer.on(config1.Addr, echo)
	post := dialer.on("post:1", echo)
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, []MiddlewareConfig{
		{Ref: "pre1", Addr: "pre1:1"},
		{Ref: "pre2", Addr: "pre2:1"},
		{Ref: "post", Addr: "post:1", PostProcessor: true},
	}), dialer)

	res, err := d.ProcessMessage(context.Background(), registerRequest())
	if err != nil {
		t.Fatalf("ProcessMessage: %v", err)
	}
	if len(pre2.requests()) != 0 {
		t.Fatal("pre2 ran after a middleware answered with a response")
	}
	// As in Node, the processor and the post middlewares still see the response
	if len(proc.requests()) != 1 || len(post.requests()) != 1 {
		t.Fatalf("processor ran %d times, post middleware %d times; want 1 and 1", len(proc.requests()), len(post.requests()))
	}
	if res.GetMessage().GetResponseType() != sipmessage.ResponseType_FORBIDDEN {
		t.Fatalf("response type = %v, want FORBIDDEN", res.GetMessage().GetResponseType())
	}
}

func TestProcessMessageMiddlewareErrors(t *testing.T) {
	cases := []struct {
		name    string
		handle  func(*processor.MessageRequest) (*processor.MessageResponse, error)
		code    codes.Code
		message string
	}{
		{
			name: "unavailable",
			handle: func(*processor.MessageRequest) (*processor.MessageResponse, error) {
				return nil, status.Error(codes.Unavailable, "down")
			},
			code: codes.Unavailable, message: "middleware ref = mid is unavailable",
		},
		{
			name: "other status",
			handle: func(*processor.MessageRequest) (*processor.MessageResponse, error) {
				return nil, status.Error(codes.Internal, "boom")
			},
			code: codes.Unknown, message: "middleware ref = mid failed: rpc error: code = Internal desc = boom",
		},
		{
			name: "no message",
			handle: func(*processor.MessageRequest) (*processor.MessageResponse, error) {
				return &processor.MessageResponse{}, nil
			},
			code: codes.Unknown, message: "middleware ref = mid failed: no message in the response",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dialer := newFakeDialer()
			dialer.on("mid:1", c.handle)
			proc := dialer.on(config1.Addr, echo)
			d := mustNew(t, testConfig([]ProcessorConfig{config1}, []MiddlewareConfig{{Ref: "mid", Addr: "mid:1"}}), dialer)

			_, err := d.ProcessMessage(context.Background(), registerRequest())
			if status.Code(err) != c.code {
				t.Fatalf("code = %v, want %v", status.Code(err), c.code)
			}
			if msg := status.Convert(err).Message(); msg != c.message {
				t.Fatalf("message = %q, want %q", msg, c.message)
			}
			if len(proc.requests()) != 0 {
				t.Fatal("the processor ran after a middleware failed")
			}
		})
	}
}

func TestProcessMessageErrorResponsesSkipTheMiddlewares(t *testing.T) {
	cases := []struct {
		name        string
		message     *sipmessage.SIPMessage
		middlewares bool
	}{
		{"request", requestMessage(), true},
		{"200 OK", responseMessage(sipmessage.ResponseType_OK), true},
		{"180 Ringing", responseMessage(sipmessage.ResponseType_RINGING), true},
		{"100 Trying", responseMessage(sipmessage.ResponseType_TRYING), false},
		{"404", responseMessage(sipmessage.ResponseType_NOT_FOUND), false},
		{"503", responseMessage(sipmessage.ResponseType_SERVICE_UNAVAILABLE), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dialer := newFakeDialer()
			pre := dialer.on("pre:1", echo)
			post := dialer.on("post:1", echo)
			proc := dialer.on(config1.Addr, echo)
			d := mustNew(t, testConfig([]ProcessorConfig{config1}, []MiddlewareConfig{
				{Ref: "pre", Addr: "pre:1"},
				{Ref: "post", Addr: "post:1", PostProcessor: true},
			}), dialer)

			req := registerRequest()
			req.Message = c.message
			if _, err := d.ProcessMessage(context.Background(), req); err != nil {
				t.Fatalf("ProcessMessage: %v", err)
			}
			if len(proc.requests()) != 1 {
				t.Fatalf("processor ran %d times, want 1", len(proc.requests()))
			}
			ran := len(pre.requests()) == 1 && len(post.requests()) == 1
			if ran != c.middlewares {
				t.Fatalf("middlewares ran = %v, want %v", ran, c.middlewares)
			}
		})
	}
}

func TestProcessMessageStripsTheTraceMetadata(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on(config1.Addr, func(req *processor.MessageRequest) (*processor.MessageResponse, error) {
		return &processor.MessageResponse{
			Message:  req.GetMessage(),
			Metadata: map[string]string{"trace.record": "true", "trace.reason": "test", "keep": "me"},
		}, nil
	})
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, nil), dialer)

	res, err := d.ProcessMessage(context.Background(), registerRequest())
	if err != nil {
		t.Fatalf("ProcessMessage: %v", err)
	}
	if len(res.GetMetadata()) != 1 || res.GetMetadata()["keep"] != "me" {
		t.Fatalf("metadata = %v, want only keep=me", res.GetMetadata())
	}
}

func TestProcessMessageIsSafeForConcurrentUse(t *testing.T) {
	dialer := newFakeDialer()
	dialer.on(config1.Addr, echo)
	dialer.on("mid:1", echo)
	d := mustNew(t, testConfig([]ProcessorConfig{config1}, []MiddlewareConfig{{Ref: "mid", Addr: "mid:1", PostProcessor: true}}), dialer)

	var wg sync.WaitGroup
	for range 16 {
		wg.Go(func() {
			if _, err := d.ProcessMessage(context.Background(), registerRequest()); err != nil {
				t.Errorf("ProcessMessage: %v", err)
			}
		})
	}
	wg.Wait()
}
