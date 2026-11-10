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
	"context"
	"net"
	"sync"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/resolver/manual"
)

func TestTarget(t *testing.T) {
	for addr, want := range map[string]string{
		"routr-connect.routr:51904":         "dns:///routr-connect.routr:51904",
		"localhost:51904":                   "dns:///localhost:51904",
		"10.0.0.7:51904":                    "dns:///10.0.0.7:51904",
		"[::1]:51904":                       "dns:///[::1]:51904",
		"connect":                           "dns:///connect",
		"dns:///routr-connect.routr:51904":  "dns:///routr-connect.routr:51904",
		"dns://8.8.8.8/connect.example:443": "dns://8.8.8.8/connect.example:443",
		"passthrough:///10.0.0.7:51904":     "passthrough:///10.0.0.7:51904",
		"unix:///var/run/routr.sock":        "unix:///var/run/routr.sock",
		"unix:relative.sock":                "unix:relative.sock",
	} {
		if got := Target(addr); got != want {
			t.Errorf("Target(%q) = %q, want %q", addr, got, want)
		}
	}
}

func TestNewClientRefusesABadTarget(t *testing.T) {
	// An empty address leaves dns:/// with no host, which the resolver refuses
	// only when it builds; a target gRPC can't parse fails at once
	if _, err := NewClient("dns:///%zz", grpc.WithTransportCredentials(insecure.NewCredentials())); err == nil {
		t.Error("NewClient accepted a target it can't parse")
	}
}

// TestNewClientBalancesOverEveryAddress dials a name that resolves to two
// servers and checks that calls reach both, which pick_first never does.
func TestNewClientBalancesOverEveryAddress(t *testing.T) {
	var mu sync.Mutex
	hits := map[string]int{}
	var addrs []resolver.Address
	for range 2 {
		lis, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		srv := grpc.NewServer(grpc.UnaryInterceptor(func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
			mu.Lock()
			hits[lis.Addr().String()]++
			mu.Unlock()
			return handler(ctx, req)
		}))
		healthpb.RegisterHealthServer(srv, health.NewServer())
		go func() { _ = srv.Serve(lis) }()
		t.Cleanup(srv.Stop)
		addrs = append(addrs, resolver.Address{Addr: lis.Addr().String()})
	}

	r := manual.NewBuilderWithScheme("routrtest")
	r.InitialState(resolver.State{Addresses: addrs})
	// Registered, so Target keeps the scheme as it keeps dns:///
	resolver.Register(r)
	conn, err := NewClient("routrtest:///peers", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	client := healthpb.NewHealthClient(conn)
	// Round robin picks among the connected servers; the second may connect
	// after the first calls
	reached := func() int {
		mu.Lock()
		defer mu.Unlock()
		return len(hits)
	}
	for i := 0; i < 200 && reached() < 2; i++ {
		if _, err := client.Check(context.Background(), &healthpb.HealthCheckRequest{}, grpc.WaitForReady(true)); err != nil {
			t.Fatal(err)
		}
	}
	mu.Lock()
	defer mu.Unlock()
	if len(hits) != 2 {
		t.Errorf("calls reached %d of 2 servers: %v", len(hits), hits)
	}
}
