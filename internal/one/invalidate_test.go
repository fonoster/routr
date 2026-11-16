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

package one

import (
	"context"
	"net"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/data"
)

// serveAgents serves a fake Agents service with the invalidating
// interceptor in front, over the wire as rctl reaches it, until the test
// ends.
func serveAgents(t *testing.T, cache *FindCache, fake *fakeAgents) agents.AgentsClient {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(invalidateOnWrite(cache)))
	agents.RegisterAgentsServer(srv, fake)
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return agents.NewAgentsClient(conn)
}

func TestInvalidateOnWrite(t *testing.T) {
	ctx := context.Background()
	cache, _ := newTestCache(t, CacheOptions{})
	fake := &fakeAgents{
		agent: &agents.Agent{Ref: "agent-01", Username: "1001"},
		found: &agents.FindByResponse{},
	}
	client := serveAgents(t, cache, fake)

	reseed := func() {
		cache.Clear()
		seed(t, cache, data.KindAgent, "username", "1001")
		seed(t, cache, data.KindAgent, "ref", "agent-01")
		seed(t, cache, data.KindAgent, "username", "1002")
		seed(t, cache, data.KindDomain, "domainUri", "sip.local")
	}

	reseed()
	if _, err := client.Create(ctx, &agents.CreateAgentRequest{Name: "John"}); err != nil {
		t.Fatal(err)
	}
	if kept(cache, data.KindAgent, "username", "1001") || kept(cache, data.KindAgent, "ref", "agent-01") {
		t.Error("Create: the created row's entries still kept")
	}
	if !kept(cache, data.KindAgent, "username", "1002") || !kept(cache, data.KindDomain, "domainUri", "sip.local") {
		t.Error("Create: other rows and kinds dropped")
	}

	reseed()
	if _, err := client.Update(ctx, &agents.UpdateAgentRequest{Ref: "agent-01"}); err != nil {
		t.Fatal(err)
	}
	if kept(cache, data.KindAgent, "username", "1001") {
		t.Error("Update: the updated row's entries still kept")
	}

	reseed()
	if _, err := client.Delete(ctx, &agents.DeleteAgentRequest{Ref: "agent-01"}); err != nil {
		t.Fatal(err)
	}
	if kept(cache, data.KindAgent, "ref", "agent-01") {
		t.Error("Delete: the deleted ref still kept")
	}
	if !kept(cache, data.KindAgent, "username", "1002") {
		t.Error("Delete: another row dropped")
	}

	// A read drops nothing
	reseed()
	if _, err := client.FindBy(ctx, &agents.FindByRequest{FieldName: "username", FieldValue: "1001"}); err != nil {
		t.Fatal(err)
	}
	if cache.Size() != 4 {
		t.Errorf("FindBy over the wire touches the cache: %d entries", cache.Size())
	}

	// A failed write drops nothing
	fake.err = status.Error(codes.Unimplemented, "milestone 2")
	if _, err := client.Create(ctx, &agents.CreateAgentRequest{Name: "John"}); status.Code(err) != codes.Unimplemented {
		t.Fatalf("the write's status comes back: %v", err)
	}
	if cache.Size() != 4 {
		t.Errorf("a failed write invalidated: %d entries", cache.Size())
	}
}

func TestWriteMethodsCoverEveryKind(t *testing.T) {
	seen := map[data.Kind]int{}
	for _, kind := range writeMethods {
		seen[kind]++
	}
	for _, kind := range data.Kinds {
		if seen[kind] != 3 {
			t.Errorf("%s: %d write methods, want Create, Update and Delete", kind, seen[kind])
		}
	}
}
