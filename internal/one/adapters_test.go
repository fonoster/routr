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
	"errors"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/pb/processor"
)

// The adapters are gRPC clients at compile time
var (
	_ processor.ProcessorClient = processorAdapter{}
	_ location.LocationClient   = locationAdapter{}
	_ agents.AgentsClient       = agentsAdapter{}
	_ domains.DomainsClient     = domainsAdapter{}
	_ trunks.TrunksClient       = trunksAdapter{}
)

// The fakes record what they got and answer what they were given, or fail
// with it.

type fakeLocation struct {
	location.UnimplementedLocationServer
	got    proto.Message
	routes *location.FindRoutesResponse
	err    error
}

func (f *fakeLocation) AddRoute(_ context.Context, in *location.AddRouteRequest) (*emptypb.Empty, error) {
	f.got = in
	return &emptypb.Empty{}, f.err
}

func (f *fakeLocation) FindRoutes(_ context.Context, in *location.FindRoutesRequest) (*location.FindRoutesResponse, error) {
	f.got = in
	return f.routes, f.err
}

func (f *fakeLocation) RemoveRoutes(_ context.Context, in *location.RemoveRoutesRequest) (*emptypb.Empty, error) {
	f.got = in
	return &emptypb.Empty{}, f.err
}

type fakeProcessor struct {
	processor.UnimplementedProcessorServer
	got    *processor.MessageRequest
	answer *processor.MessageResponse
	err    error
}

func (f *fakeProcessor) ProcessMessage(_ context.Context, in *processor.MessageRequest) (*processor.MessageResponse, error) {
	f.got = in
	return f.answer, f.err
}

type fakeAgents struct {
	agents.UnimplementedAgentsServer
	got   proto.Message
	agent *agents.Agent
	found *agents.FindByResponse
	err   error
}

func (f *fakeAgents) Get(_ context.Context, in *agents.GetAgentRequest) (*agents.Agent, error) {
	f.got = in
	return f.agent, f.err
}

func (f *fakeAgents) FindBy(_ context.Context, in *agents.FindByRequest) (*agents.FindByResponse, error) {
	f.got = in
	return f.found, f.err
}

func (f *fakeAgents) Create(_ context.Context, in *agents.CreateAgentRequest) (*agents.Agent, error) {
	f.got = in
	return f.agent, f.err
}

func (f *fakeAgents) Update(_ context.Context, in *agents.UpdateAgentRequest) (*agents.Agent, error) {
	f.got = in
	return f.agent, f.err
}

func (f *fakeAgents) Delete(_ context.Context, in *agents.DeleteAgentRequest) (*emptypb.Empty, error) {
	f.got = in
	return &emptypb.Empty{}, f.err
}

type fakeDomains struct {
	domains.UnimplementedDomainsServer
	got   proto.Message
	found *domains.FindByResponse
	err   error
}

func (f *fakeDomains) FindBy(_ context.Context, in *domains.FindByRequest) (*domains.FindByResponse, error) {
	f.got = in
	return f.found, f.err
}

type fakeTrunks struct {
	trunks.UnimplementedTrunksServer
	got   proto.Message
	found *trunks.FindByResponse
	err   error
}

func (f *fakeTrunks) FindBy(_ context.Context, in *trunks.FindByRequest) (*trunks.FindByResponse, error) {
	f.got = in
	return f.found, f.err
}

func TestLocationAdapterCallsTheServerDirectly(t *testing.T) {
	ctx := context.Background()
	routes := &location.FindRoutesResponse{Routes: []*location.Route{{Host: "10.0.0.1", Port: "5060"}}}
	f := &fakeLocation{routes: routes}
	a := locationAdapter{srv: f}

	req := &location.FindRoutesRequest{Aor: "sip:1001@sip.local"}
	got, err := a.FindRoutes(ctx, req, grpc.WaitForReady(true))
	if err != nil || got != routes {
		t.Fatalf("the server's answer, same memory, call options dropped: %v %v", got, err)
	}
	if f.got != req {
		t.Errorf("the request reached the server as it was: %v", f.got)
	}

	add := &location.AddRouteRequest{Aor: "sip:1001@sip.local"}
	if _, err := a.AddRoute(ctx, add); err != nil || f.got != add {
		t.Errorf("AddRoute: %v, got %v", err, f.got)
	}
	rm := &location.RemoveRoutesRequest{Aor: "sip:1001@sip.local"}
	if _, err := a.RemoveRoutes(ctx, rm); err != nil || f.got != rm {
		t.Errorf("RemoveRoutes: %v, got %v", err, f.got)
	}

	f.err = status.Error(codes.NotFound, "no routes")
	if _, err := a.FindRoutes(ctx, req); status.Code(err) != codes.NotFound {
		t.Errorf("the server's error comes back as it is: %v", err)
	}
}

func TestProcessorAdapterCallsTheServerDirectly(t *testing.T) {
	ctx := context.Background()
	answer := &processor.MessageResponse{Metadata: map[string]string{"served-by": "fake"}}
	f := &fakeProcessor{answer: answer}
	a := processorAdapter{srv: f}

	req := &processor.MessageRequest{Ref: "call-1"}
	got, err := a.ProcessMessage(ctx, req, grpc.WaitForReady(true))
	if err != nil || got != answer || f.got != req {
		t.Fatalf("answer and request shared, not copied: %v %v, got %v", got, err, f.got)
	}
	f.err = status.Error(codes.Unavailable, "no capacity")
	if _, err := a.ProcessMessage(ctx, req); status.Code(err) != codes.Unavailable {
		t.Errorf("the error comes back as it is: %v", err)
	}
}

func TestDataAdaptersCallTheServersDirectly(t *testing.T) {
	ctx := context.Background()

	foundAgents := &agents.FindByResponse{Items: []*agents.Agent{{Ref: "agent-01"}}}
	fa := &fakeAgents{found: foundAgents, agent: foundAgents.Items[0]}
	aa := agentsAdapter{srv: fa}
	find := &agents.FindByRequest{FieldName: "username", FieldValue: "1001"}
	if got, err := aa.FindBy(ctx, find, grpc.WaitForReady(true)); err != nil || got != foundAgents || fa.got != find {
		t.Errorf("agents FindBy: %v %v, got %v", got, err, fa.got)
	}
	get := &agents.GetAgentRequest{Ref: "agent-01"}
	if got, err := aa.Get(ctx, get); err != nil || got != fa.agent || fa.got != get {
		t.Errorf("agents Get: %v %v, got %v", got, err, fa.got)
	}
	create := &agents.CreateAgentRequest{Name: "x"}
	if _, err := aa.Create(ctx, create); err != nil || fa.got != create {
		t.Errorf("agents Create: %v, got %v", err, fa.got)
	}
	update := &agents.UpdateAgentRequest{Ref: "agent-01"}
	if _, err := aa.Update(ctx, update); err != nil || fa.got != update {
		t.Errorf("agents Update: %v, got %v", err, fa.got)
	}
	del := &agents.DeleteAgentRequest{Ref: "agent-01"}
	if _, err := aa.Delete(ctx, del); err != nil || fa.got != del {
		t.Errorf("agents Delete: %v, got %v", err, fa.got)
	}
	if _, err := aa.List(ctx, &agents.ListAgentsRequest{}); status.Code(err) != codes.Unimplemented {
		t.Errorf("an unimplemented method's status comes back: %v", err)
	}

	foundDomains := &domains.FindByResponse{Items: []*domains.Domain{{Ref: "domain-01"}}}
	fd := &fakeDomains{found: foundDomains}
	dfind := &domains.FindByRequest{FieldName: "domainUri", FieldValue: "sip.local"}
	if got, err := (domainsAdapter{srv: fd}).FindBy(ctx, dfind); err != nil || got != foundDomains || fd.got != dfind {
		t.Errorf("domains FindBy: %v %v, got %v", got, err, fd.got)
	}

	ft := &fakeTrunks{err: errors.New("db down")}
	tfind := &trunks.FindByRequest{FieldName: "inboundUri", FieldValue: "trunk.local"}
	if _, err := (trunksAdapter{srv: ft}).FindBy(ctx, tfind); err == nil || err.Error() != "db down" || ft.got != tfind {
		t.Errorf("trunks FindBy error: %v, got %v", err, ft.got)
	}
}

func TestCachedClientsCacheFindByOnly(t *testing.T) {
	ctx := context.Background()
	cache, _ := newTestCache(t, CacheOptions{})

	fa := &fakeAgents{found: &agents.FindByResponse{Items: []*agents.Agent{{Ref: "agent-01"}}}, agent: &agents.Agent{Ref: "agent-01"}}
	ca := cachedAgents{AgentsClient: agentsAdapter{srv: fa}, cache: cache}
	first, err := ca.FindBy(ctx, &agents.FindByRequest{FieldName: "username", FieldValue: "1001"})
	if err != nil || first != fa.found {
		t.Fatalf("miss: %v %v", first, err)
	}
	fa.found = &agents.FindByResponse{}
	second, _ := ca.FindBy(ctx, &agents.FindByRequest{FieldName: "username", FieldValue: "1001"})
	if second != first {
		t.Error("hit: the kept answer, not the server's new one")
	}
	fa.got = nil
	if _, err := ca.Get(ctx, &agents.GetAgentRequest{Ref: "agent-01"}); err != nil || fa.got == nil {
		t.Error("Get goes straight through")
	}

	fd := &fakeDomains{found: &domains.FindByResponse{}}
	cd := cachedDomains{DomainsClient: domainsAdapter{srv: fd}, cache: cache}
	cd.FindBy(ctx, &domains.FindByRequest{FieldName: "domainUri", FieldValue: "none.local"})
	fd.got = nil
	cd.FindBy(ctx, &domains.FindByRequest{FieldName: "domainUri", FieldValue: "none.local"})
	if fd.got != nil {
		t.Error("an empty answer is kept too")
	}

	ft := &fakeTrunks{err: status.Error(codes.Unavailable, "db down")}
	ct := cachedTrunks{TrunksClient: trunksAdapter{srv: ft}, cache: cache}
	if _, err := ct.FindBy(ctx, &trunks.FindByRequest{FieldName: "inboundUri", FieldValue: "x"}); status.Code(err) != codes.Unavailable {
		t.Errorf("a failed load's error: %v", err)
	}
	if cache.Size() != 2 {
		t.Errorf("agents and domains kept, the failed trunks not: %d entries", cache.Size())
	}
}
