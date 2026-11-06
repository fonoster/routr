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

package data

import (
	"context"
	"fmt"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// refRequiredMessage is pgdata's answer to a Get without a ref.
const refRequiredMessage = "Parameter ref is required"

// getOne is Get for every kind: a ref is required, a miss is NOT_FOUND.
func getOne[T proto.Message](ctx context.Context, d *Data, kind Kind, ref string) (T, error) {
	var zero T
	if ref == "" {
		return zero, toStatus(&BadRequestError{Message: refRequiredMessage})
	}
	msg, err := d.store.Get(ctx, kind, ref)
	if err != nil {
		d.log.Debug("get failed", "kind", kind, "ref", ref, "error", err)
		return zero, toStatus(err)
	}
	out, ok := msg.(T)
	if !ok {
		return zero, toStatus(fmt.Errorf("store returned %T for kind %s", msg, kind))
	}
	return out, nil
}

// findMany is FindBy for every kind: no match is an empty list, not an error.
func findMany[T proto.Message](ctx context.Context, d *Data, kind Kind, field, value string) ([]T, error) {
	msgs, err := d.store.FindBy(ctx, kind, field, value)
	if err != nil {
		d.log.Debug("findBy failed", "kind", kind, "field", field, "error", err)
		return nil, toStatus(err)
	}
	return convert[T](kind, msgs)
}

// listPage is List for every kind. The next page token is the ref of the
// last item, even on the last page (the client learns the end from an empty
// page), exactly as pgdata answered.
func listPage[T proto.Message](ctx context.Context, d *Data, kind Kind, size int32, token string) ([]T, string, error) {
	msgs, err := d.store.List(ctx, kind, Page{Size: size, Token: token})
	if err != nil {
		d.log.Debug("list failed", "kind", kind, "error", err)
		return nil, "", toStatus(err)
	}
	items, err := convert[T](kind, msgs)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(msgs) > 0 {
		next = refOf(msgs[len(msgs)-1])
	}
	return items, next, nil
}

func convert[T proto.Message](kind Kind, msgs []proto.Message) ([]T, error) {
	items := make([]T, 0, len(msgs))
	for _, msg := range msgs {
		item, ok := msg.(T)
		if !ok {
			return nil, toStatus(fmt.Errorf("store returned %T for kind %s", msg, kind))
		}
		items = append(items, item)
	}
	return items, nil
}

// refOf reads the ref of any of the seven resource messages.
func refOf(msg proto.Message) string {
	switch m := msg.(type) {
	case *agents.Agent:
		return m.GetRef()
	case *peers.Peer:
		return m.GetRef()
	case *numbers.Number:
		return m.GetRef()
	case *trunks.Trunk:
		return m.GetRef()
	case *domains.Domain:
		return m.GetRef()
	case *credentials.Credentials:
		return m.GetRef()
	case *acl.AccessControlList:
		return m.GetRef()
	}
	return ""
}

// ACLs

type aclServer struct {
	acl.UnimplementedACLServiceServer
	d *Data
}

func (s *aclServer) Get(ctx context.Context, req *acl.GetACLRequest) (*acl.AccessControlList, error) {
	return getOne[*acl.AccessControlList](ctx, s.d, KindACL, req.GetRef())
}

func (s *aclServer) List(ctx context.Context, req *acl.ListACLsRequest) (*acl.ListACLsResponse, error) {
	items, next, err := listPage[*acl.AccessControlList](ctx, s.d, KindACL, req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, err
	}
	return &acl.ListACLsResponse{Items: items, NextPageToken: next}, nil
}

func (s *aclServer) Create(context.Context, *acl.CreateACLRequest) (*acl.AccessControlList, error) {
	return nil, unimplemented()
}

func (s *aclServer) Update(context.Context, *acl.UpdateACLRequest) (*acl.AccessControlList, error) {
	return nil, unimplemented()
}

func (s *aclServer) Delete(context.Context, *acl.DeleteACLRequest) (*emptypb.Empty, error) {
	return nil, unimplemented()
}

// Agents

type agentsServer struct {
	agents.UnimplementedAgentsServer
	d *Data
}

func (s *agentsServer) Get(ctx context.Context, req *agents.GetAgentRequest) (*agents.Agent, error) {
	return getOne[*agents.Agent](ctx, s.d, KindAgent, req.GetRef())
}

func (s *agentsServer) FindBy(ctx context.Context, req *agents.FindByRequest) (*agents.FindByResponse, error) {
	items, err := findMany[*agents.Agent](ctx, s.d, KindAgent, req.GetFieldName(), req.GetFieldValue())
	if err != nil {
		return nil, err
	}
	return &agents.FindByResponse{Items: items}, nil
}

func (s *agentsServer) List(ctx context.Context, req *agents.ListAgentsRequest) (*agents.ListAgentsResponse, error) {
	items, next, err := listPage[*agents.Agent](ctx, s.d, KindAgent, req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, err
	}
	return &agents.ListAgentsResponse{Items: items, NextPageToken: next}, nil
}

func (s *agentsServer) Create(context.Context, *agents.CreateAgentRequest) (*agents.Agent, error) {
	return nil, unimplemented()
}

func (s *agentsServer) Update(context.Context, *agents.UpdateAgentRequest) (*agents.Agent, error) {
	return nil, unimplemented()
}

func (s *agentsServer) Delete(context.Context, *agents.DeleteAgentRequest) (*emptypb.Empty, error) {
	return nil, unimplemented()
}

// Credentials

type credentialsServer struct {
	credentials.UnimplementedCredentialsServiceServer
	d *Data
}

func (s *credentialsServer) Get(ctx context.Context, req *credentials.GetCredentialsRequest) (*credentials.Credentials, error) {
	return getOne[*credentials.Credentials](ctx, s.d, KindCredentials, req.GetRef())
}

func (s *credentialsServer) List(ctx context.Context, req *credentials.ListCredentialsRequest) (*credentials.ListCredentialsResponse, error) {
	items, next, err := listPage[*credentials.Credentials](ctx, s.d, KindCredentials, req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, err
	}
	return &credentials.ListCredentialsResponse{Items: items, NextPageToken: next}, nil
}

func (s *credentialsServer) Create(context.Context, *credentials.CreateCredentialsRequest) (*credentials.Credentials, error) {
	return nil, unimplemented()
}

func (s *credentialsServer) Update(context.Context, *credentials.UpdateCredentialsRequest) (*credentials.Credentials, error) {
	return nil, unimplemented()
}

func (s *credentialsServer) Delete(context.Context, *credentials.DeleteCredentialsRequest) (*emptypb.Empty, error) {
	return nil, unimplemented()
}

// Domains

type domainsServer struct {
	domains.UnimplementedDomainsServer
	d *Data
}

func (s *domainsServer) Get(ctx context.Context, req *domains.GetDomainRequest) (*domains.Domain, error) {
	return getOne[*domains.Domain](ctx, s.d, KindDomain, req.GetRef())
}

func (s *domainsServer) FindBy(ctx context.Context, req *domains.FindByRequest) (*domains.FindByResponse, error) {
	items, err := findMany[*domains.Domain](ctx, s.d, KindDomain, req.GetFieldName(), req.GetFieldValue())
	if err != nil {
		return nil, err
	}
	return &domains.FindByResponse{Items: items}, nil
}

func (s *domainsServer) List(ctx context.Context, req *domains.ListDomainRequest) (*domains.ListDomainsResponse, error) {
	items, next, err := listPage[*domains.Domain](ctx, s.d, KindDomain, req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, err
	}
	return &domains.ListDomainsResponse{Items: items, NextPageToken: next}, nil
}

func (s *domainsServer) Create(context.Context, *domains.CreateDomainRequest) (*domains.Domain, error) {
	return nil, unimplemented()
}

func (s *domainsServer) Update(context.Context, *domains.UpdateDomainRequest) (*domains.Domain, error) {
	return nil, unimplemented()
}

func (s *domainsServer) Delete(context.Context, *domains.DeleteDomainRequest) (*emptypb.Empty, error) {
	return nil, unimplemented()
}

// Numbers

type numbersServer struct {
	numbers.UnimplementedNumbersServer
	d *Data
}

func (s *numbersServer) Get(ctx context.Context, req *numbers.GetNumberRequest) (*numbers.Number, error) {
	return getOne[*numbers.Number](ctx, s.d, KindNumber, req.GetRef())
}

func (s *numbersServer) FindBy(ctx context.Context, req *numbers.FindByRequest) (*numbers.FindByResponse, error) {
	items, err := findMany[*numbers.Number](ctx, s.d, KindNumber, req.GetFieldName(), req.GetFieldValue())
	if err != nil {
		return nil, err
	}
	return &numbers.FindByResponse{Items: items}, nil
}

func (s *numbersServer) List(ctx context.Context, req *numbers.ListNumberRequest) (*numbers.ListNumbersResponse, error) {
	items, next, err := listPage[*numbers.Number](ctx, s.d, KindNumber, req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, err
	}
	return &numbers.ListNumbersResponse{Items: items, NextPageToken: next}, nil
}

func (s *numbersServer) Create(context.Context, *numbers.CreateNumberRequest) (*numbers.Number, error) {
	return nil, unimplemented()
}

func (s *numbersServer) Update(context.Context, *numbers.UpdateNumberRequest) (*numbers.Number, error) {
	return nil, unimplemented()
}

func (s *numbersServer) Delete(context.Context, *numbers.DeleteNumberRequest) (*emptypb.Empty, error) {
	return nil, unimplemented()
}

// Peers

type peersServer struct {
	peers.UnimplementedPeersServer
	d *Data
}

func (s *peersServer) Get(ctx context.Context, req *peers.GetPeerRequest) (*peers.Peer, error) {
	return getOne[*peers.Peer](ctx, s.d, KindPeer, req.GetRef())
}

func (s *peersServer) FindBy(ctx context.Context, req *peers.FindByRequest) (*peers.FindByResponse, error) {
	items, err := findMany[*peers.Peer](ctx, s.d, KindPeer, req.GetFieldName(), req.GetFieldValue())
	if err != nil {
		return nil, err
	}
	return &peers.FindByResponse{Items: items}, nil
}

func (s *peersServer) List(ctx context.Context, req *peers.ListPeersRequest) (*peers.ListPeersResponse, error) {
	items, next, err := listPage[*peers.Peer](ctx, s.d, KindPeer, req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, err
	}
	return &peers.ListPeersResponse{Items: items, NextPageToken: next}, nil
}

func (s *peersServer) Create(context.Context, *peers.CreatePeerRequest) (*peers.Peer, error) {
	return nil, unimplemented()
}

func (s *peersServer) Update(context.Context, *peers.UpdatePeerRequest) (*peers.Peer, error) {
	return nil, unimplemented()
}

func (s *peersServer) Delete(context.Context, *peers.DeletePeerRequest) (*emptypb.Empty, error) {
	return nil, unimplemented()
}

// Trunks

type trunksServer struct {
	trunks.UnimplementedTrunksServer
	d *Data
}

func (s *trunksServer) Get(ctx context.Context, req *trunks.GetTrunkRequest) (*trunks.Trunk, error) {
	return getOne[*trunks.Trunk](ctx, s.d, KindTrunk, req.GetRef())
}

func (s *trunksServer) FindBy(ctx context.Context, req *trunks.FindByRequest) (*trunks.FindByResponse, error) {
	items, err := findMany[*trunks.Trunk](ctx, s.d, KindTrunk, req.GetFieldName(), req.GetFieldValue())
	if err != nil {
		return nil, err
	}
	return &trunks.FindByResponse{Items: items}, nil
}

func (s *trunksServer) List(ctx context.Context, req *trunks.ListTrunkRequest) (*trunks.ListTrunksResponse, error) {
	items, next, err := listPage[*trunks.Trunk](ctx, s.d, KindTrunk, req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, err
	}
	return &trunks.ListTrunksResponse{Items: items, NextPageToken: next}, nil
}

func (s *trunksServer) Create(context.Context, *trunks.CreateTrunkRequest) (*trunks.Trunk, error) {
	return nil, unimplemented()
}

func (s *trunksServer) Update(context.Context, *trunks.UpdateTrunkRequest) (*trunks.Trunk, error) {
	return nil, unimplemented()
}

func (s *trunksServer) Delete(context.Context, *trunks.DeleteTrunkRequest) (*emptypb.Empty, error) {
	return nil, unimplemented()
}
