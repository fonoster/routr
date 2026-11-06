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
	"net"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// Over the wire: a real gRPC server for the dispatcher, the default Dialer
// to a real processor, and the generated client as the EdgePort uses it.

type wireProcessor struct {
	processor.UnimplementedProcessorServer
}

func (wireProcessor) ProcessMessage(_ context.Context, req *processor.MessageRequest) (*processor.MessageResponse, error) {
	if req.GetMethod() == processor.Method_INVITE {
		return nil, status.Error(codes.Unavailable, "no capacity")
	}
	return &processor.MessageResponse{
		Message:  responseMessage(sipmessage.ResponseType_OK),
		Metadata: map[string]string{"trace.record": "true", "served-by": "wire"},
	}, nil
}

// serve runs a gRPC server on a free loopback port until the test ends.
func serve(t *testing.T, register func(*grpc.Server)) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := grpc.NewServer()
	register(srv)
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String()
}

// freePort returns the address of a port nothing listens on.
func freePort(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := lis.Addr().String()
	_ = lis.Close()
	return addr
}

func TestOverTheWire(t *testing.T) {
	procAddr := serve(t, func(s *grpc.Server) { processor.RegisterProcessorServer(s, wireProcessor{}) })
	cfg := testConfig([]ProcessorConfig{
		{Ref: "wire", Addr: procAddr, Methods: []string{"REGISTER", "INVITE"}, MatchFunc: "req => true"},
		{Ref: "down", Addr: freePort(t), Methods: []string{"MESSAGE"}, MatchFunc: "req => true"},
	}, nil)
	d, err := New(cfg, Options{})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	dispAddr := serve(t, func(s *grpc.Server) { d.Register(s) })

	conn, err := grpc.NewClient(dispAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	client := processor.NewProcessorClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	t.Run("the processor's answer comes back without the trace metadata", func(t *testing.T) {
		res, err := client.ProcessMessage(ctx, registerRequest())
		if err != nil {
			t.Fatalf("ProcessMessage: %v", err)
		}
		want := &processor.MessageResponse{Message: responseMessage(sipmessage.ResponseType_OK), Metadata: map[string]string{"served-by": "wire"}}
		if !proto.Equal(res, want) {
			t.Fatalf("response = %v, want %v", res, want)
		}
	})

	t.Run("UNAVAILABLE from the processor", func(t *testing.T) {
		req := registerRequest()
		req.Method = processor.Method_INVITE
		_, err := client.ProcessMessage(ctx, req)
		if status.Code(err) != codes.Unavailable || status.Convert(err).Message() != "processor ref = wire is unavailable" {
			t.Fatalf("got %v", err)
		}
	})

	t.Run("an unreachable processor", func(t *testing.T) {
		req := registerRequest()
		req.Method = processor.Method_MESSAGE
		_, err := client.ProcessMessage(ctx, req)
		if status.Code(err) != codes.Unavailable || status.Convert(err).Message() != "processor ref = down is unavailable" {
			t.Fatalf("got %v", err)
		}
	})

	t.Run("no matching processor", func(t *testing.T) {
		req := registerRequest()
		req.Method = processor.Method_OPTIONS
		_, err := client.ProcessMessage(ctx, req)
		if status.Code(err) != codes.NotFound || status.Convert(err).Message() != "not matching processor found for request ref: call-id" {
			t.Fatalf("got %v", err)
		}
	})
}

// grpc.NewClient connects lazily, so DialBackend succeeds for any address
// that parses; the connection is the backend's to close, once.
func TestDialBackendOwnsItsConnection(t *testing.T) {
	b, err := DialBackend(freePort(t))
	if err != nil {
		t.Fatalf("DialBackend: %v", err)
	}
	if err := b.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if err := b.Close(); err == nil {
		t.Fatal("expected the second Close to fail on a closed connection")
	}
}
