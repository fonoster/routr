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

package location

import (
	"context"
	"net"
	"testing"
	"time"

	locationpb "github.com/fonoster/routr/internal/common/pb/location"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
)

// The component over the wire, through the generated client: what the Node
// SDK, rctl and the Node Connect see.

func TestOverTheWire(t *testing.T) {
	store := NewMemoryStore()
	t.Cleanup(func() { _ = store.Close() })
	server := grpc.NewServer()
	New(store).Register(server)
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = server.Serve(lis) }()
	t.Cleanup(server.Stop)

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	client := locationpb.NewLocationClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	const aor = "sip:1001@sip.local"
	_, err = client.FindRoutes(ctx, &locationpb.FindRoutesRequest{Aor: aor, CallId: "call-01"})
	assertStatus(t, err, codes.NotFound, "no routes found for aor: "+aor)

	_, err = client.AddRoute(ctx, &locationpb.AddRouteRequest{Aor: "tel:1001", Route: simpleRoute01(time.Now()), MaxContacts: -1})
	assertStatus(t, err, codes.InvalidArgument, `aor tel:1001 has an invalid schema, only "sip:" or "backend:" are allowed`)

	if _, err := client.AddRoute(ctx, &locationpb.AddRouteRequest{Aor: aor, Route: simpleRoute01(time.Now()), MaxContacts: 1}); err != nil {
		t.Fatal(err)
	}
	_, err = client.AddRoute(ctx, &locationpb.AddRouteRequest{Aor: aor, Route: simpleRoute02(time.Now()), MaxContacts: 1})
	assertStatus(t, err, codes.InvalidArgument, "exceeds maximum of 1 allowed contacts")

	res, err := client.FindRoutes(ctx, &locationpb.FindRoutesRequest{Aor: aor, CallId: "call-01"})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.GetRoutes()) != 1 || res.GetRoutes()[0].GetUser() != "1001" || res.GetRoutes()[0].GetLabels()["priority"] != "1" {
		t.Fatalf("unexpected routes: %v", res.GetRoutes())
	}

	if _, err := client.RemoveRoutes(ctx, &locationpb.RemoveRoutesRequest{Aor: aor}); err != nil {
		t.Fatal(err)
	}
	_, err = client.FindRoutes(ctx, &locationpb.FindRoutesRequest{Aor: aor, CallId: "call-01"})
	assertStatus(t, err, codes.NotFound, "no routes found for aor: "+aor)
}
