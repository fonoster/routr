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

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/pb/processor"
)

// The in-process adapters (ROUTR3.md § 3.1): a component that takes a
// dependency as a generated *Client interface gets one of these, which calls
// the sibling component's *Server implementation directly. Same process, no
// socket, no copy: the grpc.CallOptions are dropped and the messages are
// shared, so neither side changes what it was handed.

// locationAdapter is a location.LocationClient over a LocationServer.
type locationAdapter struct {
	srv location.LocationServer
}

func (a locationAdapter) AddRoute(ctx context.Context, in *location.AddRouteRequest, _ ...grpc.CallOption) (*emptypb.Empty, error) {
	return a.srv.AddRoute(ctx, in)
}

func (a locationAdapter) FindRoutes(ctx context.Context, in *location.FindRoutesRequest, _ ...grpc.CallOption) (*location.FindRoutesResponse, error) {
	return a.srv.FindRoutes(ctx, in)
}

func (a locationAdapter) RemoveRoutes(ctx context.Context, in *location.RemoveRoutesRequest, _ ...grpc.CallOption) (*emptypb.Empty, error) {
	return a.srv.RemoveRoutes(ctx, in)
}

// processorAdapter is a processor.ProcessorClient over a ProcessorServer:
// the Dispatcher's binding to Connect and the EdgePort's to the Dispatcher.
type processorAdapter struct {
	srv processor.ProcessorServer
}

func (a processorAdapter) ProcessMessage(ctx context.Context, in *processor.MessageRequest, _ ...grpc.CallOption) (*processor.MessageResponse, error) {
	return a.srv.ProcessMessage(ctx, in)
}

// agentsAdapter is an agents.AgentsClient over an AgentsServer.
type agentsAdapter struct {
	srv agents.AgentsServer
}

func (a agentsAdapter) Create(ctx context.Context, in *agents.CreateAgentRequest, _ ...grpc.CallOption) (*agents.Agent, error) {
	return a.srv.Create(ctx, in)
}

func (a agentsAdapter) Update(ctx context.Context, in *agents.UpdateAgentRequest, _ ...grpc.CallOption) (*agents.Agent, error) {
	return a.srv.Update(ctx, in)
}

func (a agentsAdapter) Get(ctx context.Context, in *agents.GetAgentRequest, _ ...grpc.CallOption) (*agents.Agent, error) {
	return a.srv.Get(ctx, in)
}

func (a agentsAdapter) Delete(ctx context.Context, in *agents.DeleteAgentRequest, _ ...grpc.CallOption) (*emptypb.Empty, error) {
	return a.srv.Delete(ctx, in)
}

func (a agentsAdapter) List(ctx context.Context, in *agents.ListAgentsRequest, _ ...grpc.CallOption) (*agents.ListAgentsResponse, error) {
	return a.srv.List(ctx, in)
}

func (a agentsAdapter) FindBy(ctx context.Context, in *agents.FindByRequest, _ ...grpc.CallOption) (*agents.FindByResponse, error) {
	return a.srv.FindBy(ctx, in)
}

// domainsAdapter is a domains.DomainsClient over a DomainsServer.
type domainsAdapter struct {
	srv domains.DomainsServer
}

func (a domainsAdapter) Create(ctx context.Context, in *domains.CreateDomainRequest, _ ...grpc.CallOption) (*domains.Domain, error) {
	return a.srv.Create(ctx, in)
}

func (a domainsAdapter) Update(ctx context.Context, in *domains.UpdateDomainRequest, _ ...grpc.CallOption) (*domains.Domain, error) {
	return a.srv.Update(ctx, in)
}

func (a domainsAdapter) Get(ctx context.Context, in *domains.GetDomainRequest, _ ...grpc.CallOption) (*domains.Domain, error) {
	return a.srv.Get(ctx, in)
}

func (a domainsAdapter) Delete(ctx context.Context, in *domains.DeleteDomainRequest, _ ...grpc.CallOption) (*emptypb.Empty, error) {
	return a.srv.Delete(ctx, in)
}

func (a domainsAdapter) List(ctx context.Context, in *domains.ListDomainRequest, _ ...grpc.CallOption) (*domains.ListDomainsResponse, error) {
	return a.srv.List(ctx, in)
}

func (a domainsAdapter) FindBy(ctx context.Context, in *domains.FindByRequest, _ ...grpc.CallOption) (*domains.FindByResponse, error) {
	return a.srv.FindBy(ctx, in)
}

// trunksAdapter is a trunks.TrunksClient over a TrunksServer.
type trunksAdapter struct {
	srv trunks.TrunksServer
}

func (a trunksAdapter) Create(ctx context.Context, in *trunks.CreateTrunkRequest, _ ...grpc.CallOption) (*trunks.Trunk, error) {
	return a.srv.Create(ctx, in)
}

func (a trunksAdapter) Update(ctx context.Context, in *trunks.UpdateTrunkRequest, _ ...grpc.CallOption) (*trunks.Trunk, error) {
	return a.srv.Update(ctx, in)
}

func (a trunksAdapter) Get(ctx context.Context, in *trunks.GetTrunkRequest, _ ...grpc.CallOption) (*trunks.Trunk, error) {
	return a.srv.Get(ctx, in)
}

func (a trunksAdapter) Delete(ctx context.Context, in *trunks.DeleteTrunkRequest, _ ...grpc.CallOption) (*emptypb.Empty, error) {
	return a.srv.Delete(ctx, in)
}

func (a trunksAdapter) List(ctx context.Context, in *trunks.ListTrunkRequest, _ ...grpc.CallOption) (*trunks.ListTrunksResponse, error) {
	return a.srv.List(ctx, in)
}

func (a trunksAdapter) FindBy(ctx context.Context, in *trunks.FindByRequest, _ ...grpc.CallOption) (*trunks.FindByResponse, error) {
	return a.srv.FindBy(ctx, in)
}
