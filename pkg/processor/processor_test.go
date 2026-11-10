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

package processor

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// syncBuffer is a log sink the server's goroutines and the test share.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// freeAddr is a loopback address nothing listens on.
func freeAddr(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := lis.Addr().String()
	if err := lis.Close(); err != nil {
		t.Fatal(err)
	}
	return addr
}

// serve runs ListenAndServe on a free port and dials it over plaintext, as
// the Dispatcher does. stop cancels the context and returns what
// ListenAndServe returned.
func serve(t *testing.T, opts Options, handler Handler) (conn *grpc.ClientConn, logs *syncBuffer, stop func() error) {
	t.Helper()
	logs = &syncBuffer{}
	opts.BindAddr = freeAddr(t)
	opts.Logger = slog.New(slog.NewTextHandler(logs, nil))

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- ListenAndServe(ctx, opts, handler) }()

	conn, err := grpc.NewClient(opts.BindAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	var once sync.Once
	var served error
	stop = func() error {
		once.Do(func() {
			_ = conn.Close()
			cancel()
			select {
			case served = <-done:
			case <-time.After(10 * time.Second):
				served = errors.New("ListenAndServe did not return after its context ended")
			}
		})
		return served
	}
	t.Cleanup(func() { _ = stop() })
	return conn, logs, stop
}

// callContext bounds one call of a test.
func callContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	return ctx
}

func TestListenAndServeAnswersWithItsVersion(t *testing.T) {
	got := make(chan *MessageRequest, 1)
	conn, logs, stop := serve(t, Options{Name: "echo", Version: "1.0.0"},
		func(_ context.Context, req *MessageRequest) (*MessageResponse, error) {
			got <- req
			return OK(), nil
		})

	var header metadata.MD
	res, err := NewProcessorClient(conn).ProcessMessage(callContext(t),
		&MessageRequest{Ref: "call-1", Method: Method_INVITE}, grpc.Header(&header), grpc.WaitForReady(true))
	if err != nil {
		t.Fatal(err)
	}
	if req := <-got; req.GetRef() != "call-1" || req.GetMethod() != Method_INVITE {
		t.Errorf("the handler got %v, want the request sent", req)
	}
	if rt := res.GetMessage().GetResponseType(); rt != sipmessage.ResponseType_OK {
		t.Errorf("response type = %v, want OK", rt)
	}
	if reason := res.GetMessage().GetReasonPhrase(); reason != "OK" {
		t.Errorf("reason phrase = %q, want OK", reason)
	}
	if v := header.Get("routr-component-version"); len(v) != 1 || v[0] != "1.0.0" {
		t.Errorf("routr-component-version = %v, want 1.0.0", v)
	}

	// The health service answers SERVING from the start, for the server and
	// for the processor's name.
	for _, service := range []string{"", "echo"} {
		health, err := healthpb.NewHealthClient(conn).Check(callContext(t), &healthpb.HealthCheckRequest{Service: service})
		if err != nil {
			t.Fatalf("health check of %q: %v", service, err)
		}
		if health.GetStatus() != healthpb.HealthCheckResponse_SERVING {
			t.Errorf("health of %q = %v, want SERVING", service, health.GetStatus())
		}
	}

	if err := stop(); err != nil {
		t.Errorf("ListenAndServe = %v, want nil after its context ended", err)
	}
	if !strings.Contains(logs.String(), "starting routr echo") {
		t.Errorf("logs = %q, want the line starting routr echo", logs.String())
	}
}

func TestListenAndServeWithoutAVersionSendsNoHeader(t *testing.T) {
	conn, _, _ := serve(t, Options{Name: "echo"},
		func(context.Context, *MessageRequest) (*MessageResponse, error) { return OK(), nil })

	var header metadata.MD
	if _, err := NewProcessorClient(conn).ProcessMessage(callContext(t),
		&MessageRequest{}, grpc.Header(&header), grpc.WaitForReady(true)); err != nil {
		t.Fatal(err)
	}
	if v := header.Get("routr-component-version"); len(v) != 0 {
		t.Errorf("routr-component-version = %v, want no such header", v)
	}
}

func TestHandlerErrorIsInternal(t *testing.T) {
	conn, _, _ := serve(t, Options{Name: "echo", Version: "1.0.0"},
		func(_ context.Context, req *MessageRequest) (*MessageResponse, error) {
			if req.GetRef() == "status" {
				return nil, status.Error(codes.Unavailable, "not now")
			}
			return nil, errors.New("boom")
		})
	client := NewProcessorClient(conn)

	_, err := client.ProcessMessage(callContext(t), &MessageRequest{}, grpc.WaitForReady(true))
	if status.Code(err) != codes.Internal || status.Convert(err).Message() != "boom" {
		t.Errorf("error = %v, want Internal with boom", err)
	}

	// A gRPC status passes through as it is.
	_, err = client.ProcessMessage(callContext(t), &MessageRequest{Ref: "status"})
	if status.Code(err) != codes.Unavailable || status.Convert(err).Message() != "not now" {
		t.Errorf("error = %v, want Unavailable with not now", err)
	}
}

func TestHandlerPanicIsRecovered(t *testing.T) {
	conn, logs, _ := serve(t, Options{Name: "echo"},
		func(_ context.Context, req *MessageRequest) (*MessageResponse, error) {
			if req.GetRef() == "panic" {
				panic("bad message")
			}
			return OK(), nil
		})
	client := NewProcessorClient(conn)

	_, err := client.ProcessMessage(callContext(t), &MessageRequest{Ref: "panic"}, grpc.WaitForReady(true))
	if status.Code(err) != codes.Internal {
		t.Errorf("error = %v, want Internal", err)
	}
	if !strings.Contains(logs.String(), "recovered from a panic in a handler") {
		t.Errorf("logs = %q, want the recovered panic", logs.String())
	}

	// The server stays up: the next call still answers.
	res, err := client.ProcessMessage(callContext(t), &MessageRequest{Ref: "next"})
	if err != nil {
		t.Fatalf("the call after the panic: %v", err)
	}
	if rt := res.GetMessage().GetResponseType(); rt != sipmessage.ResponseType_OK {
		t.Errorf("response type = %v, want OK", rt)
	}
}

func TestListenAndServeBindFailure(t *testing.T) {
	lis, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer lis.Close()
	addr := lis.Addr().String()

	err = ListenAndServe(context.Background(), Options{BindAddr: addr, Name: "echo"},
		func(context.Context, *MessageRequest) (*MessageResponse, error) { return OK(), nil })
	want := "unable to listen for the echo service on " + addr + ": "
	if err == nil || !strings.HasPrefix(err.Error(), want) {
		t.Errorf("ListenAndServe = %v, want an error starting %q", err, want)
	}
}
