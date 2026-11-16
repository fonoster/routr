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

package service

import (
	"bytes"
	"context"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/telemetry"
)

// panicking is a Processor whose handler panics on a request with a ref
// and answers otherwise.
type panicking struct {
	processor.UnimplementedProcessorServer
}

func (panicking) ProcessMessage(_ context.Context, req *processor.MessageRequest) (*processor.MessageResponse, error) {
	if req.GetRef() != "" {
		panic("bad message " + req.GetRef())
	}
	return &processor.MessageResponse{Metadata: map[string]string{"ok": "1"}}, nil
}

func dial(t *testing.T, addr string) *grpc.ClientConn {
	t.Helper()
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func TestServeAnswersHealthAndRecoversFromAPanic(t *testing.T) {
	var out bytes.Buffer
	log := slog.New(slog.NewTextHandler(&out, nil))
	s, err := Listen(log, "test", "127.0.0.1:0", func(r grpc.ServiceRegistrar) { processor.RegisterProcessorServer(r, panicking{}) })
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Serve(ctx) }()

	conn := dial(t, s.Addr())
	callCtx, callCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer callCancel()

	// The health service the chart probes answers SERVING
	health, err := healthpb.NewHealthClient(conn).Check(callCtx, &healthpb.HealthCheckRequest{})
	if err != nil || health.GetStatus() != healthpb.HealthCheckResponse_SERVING {
		t.Fatalf("health: %v %v", health, err)
	}

	// A panic in a handler is INTERNAL for that call and logged; the next
	// call is served
	client := processor.NewProcessorClient(conn)
	if _, err := client.ProcessMessage(callCtx, &processor.MessageRequest{Ref: "boom"}); status.Code(err) != codes.Internal || strings.Contains(status.Convert(err).Message(), "boom") {
		t.Errorf("a panic becomes INTERNAL without its text: %v", err)
	}
	if !strings.Contains(out.String(), "recovered from a panic") || !strings.Contains(out.String(), "/ProcessMessage") {
		t.Errorf("the panic is logged with the method: %s", out.String())
	}
	if res, err := client.ProcessMessage(callCtx, &processor.MessageRequest{}); err != nil || res.GetMetadata()["ok"] != "1" {
		t.Errorf("the server goes on: %v %v", res, err)
	}
	if !strings.Contains(out.String(), "starting routr test") {
		t.Errorf("the start line: %s", out.String())
	}

	// The context ending stops the server gracefully and Serve returns nil
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Errorf("Serve on a cancelled context: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not return after the context was cancelled")
	}
	if _, err := net.DialTimeout("tcp", s.Addr(), 200*time.Millisecond); err == nil {
		t.Error("the listener was released")
	}
}

// spanSeeing is a Processor that reports the trace its handler runs in.
type spanSeeing struct {
	processor.UnimplementedProcessorServer
}

func (spanSeeing) ProcessMessage(ctx context.Context, _ *processor.MessageRequest) (*processor.MessageResponse, error) {
	return &processor.MessageResponse{Metadata: map[string]string{"trace": trace.SpanContextFromContext(ctx).TraceID().String()}}, nil
}

func TestACallCarriesTheTraceContextWhenTelemetryIsOn(t *testing.T) {
	collector := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	defer collector.Close()
	tel := telemetry.Start(context.Background(), config.Telemetry{OTLPEndpoint: collector.URL}, "test", "1", nil)
	defer tel.Shutdown()

	s, err := Listen(nil, "test", "127.0.0.1:0", func(r grpc.ServiceRegistrar) { processor.RegisterProcessorServer(r, spanSeeing{}) })
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	go func() { _ = s.Serve(ctx) }()

	conn, err := grpc.NewClient(s.Addr(), telemetry.DialOptions(grpc.WithTransportCredentials(insecure.NewCredentials()))...)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	callCtx, span := otel.Tracer("test").Start(ctx, "call")
	defer span.End()
	res, err := processor.NewProcessorClient(conn).ProcessMessage(callCtx, &processor.MessageRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := res.GetMetadata()["trace"], span.SpanContext().TraceID().String(); got != want {
		t.Errorf("the handler's trace = %s, want %s", got, want)
	}
}

func TestListenFailures(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	register := func(grpc.ServiceRegistrar) {}
	_, err = Listen(nil, "data", taken.Addr().String(), register)
	if err == nil || !strings.Contains(err.Error(), "data service") || !strings.Contains(err.Error(), taken.Addr().String()) {
		t.Errorf("a taken address names the service and the address: %v", err)
	}
	if _, err := Listen(nil, "data", "127.0.0.1:0", nil); err == nil {
		t.Error("nothing to register is refused")
	}
	if err := Serve(context.Background(), nil, "data", taken.Addr().String(), register); err == nil {
		t.Error("Serve reports what Listen refused")
	}
}

func TestCloseReleasesAServerThatNeverServed(t *testing.T) {
	s, err := Listen(nil, "test", "127.0.0.1:0", func(grpc.ServiceRegistrar) {})
	if err != nil {
		t.Fatal(err)
	}
	addr := s.Addr()
	s.Close()
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		t.Fatalf("the address binds again: %v", err)
	}
	lis.Close()
}

func TestServeReportsAServerThatFailsOnItsOwn(t *testing.T) {
	s, err := Listen(nil, "test", "127.0.0.1:0", func(grpc.ServiceRegistrar) {})
	if err != nil {
		t.Fatal(err)
	}
	// Stopped before it serves: Serve fails at once, naming the service
	s.Close()
	err = s.Serve(context.Background())
	if err == nil || !strings.HasPrefix(err.Error(), "test service: ") {
		t.Errorf("names the service: %v", err)
	}
}

func TestServersEndConnectionsSoClientsRebalance(t *testing.T) {
	p := keepaliveParams()
	if p.MaxConnectionAge != 5*time.Minute {
		t.Errorf("MaxConnectionAge = %v, want 5m: clients re-resolve only when a connection ends", p.MaxConnectionAge)
	}
	if p.MaxConnectionAgeGrace <= 0 {
		t.Error("MaxConnectionAgeGrace must let in-flight calls finish")
	}
}
