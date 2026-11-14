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
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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

// pgdata's answers to a Get and to a Delete without a ref, which differ in
// their first letter.
const (
	refRequiredMessage       = "Parameter ref is required"
	deleteRefRequiredMessage = "parameter ref is required"
)

// fail is the answer to a failed operation: the status toStatus maps the
// error to, logged at error level when the client gets a fixed message in
// place of the cause (a store failure), at debug level when the status
// says it all (a miss, a bad request), and at warn level when the bad
// request is a value only the database refused: no validation caught it, so
// the log keeps the statement. A table the database does not have yet is a
// database the migrations have not reached: the client reads UNAVAILABLE and
// the log says why, at warn level and without the statement.
func (d *Data) fail(op string, err error, attrs ...any) error {
	st := toStatus(err)
	if isNotMigrated(err) {
		d.log.Warn(op+" failed: the database is not migrated yet", attrs...)
		return st
	}
	attrs = append(attrs, "error", err)
	var bad *BadRequestError
	if errors.As(err, &bad) && bad.Cause != nil {
		d.log.Warn(op+" failed", append(attrs, "cause", bad.Cause)...)
		return st
	}
	switch status.Code(st) {
	case codes.NotFound, codes.InvalidArgument, codes.AlreadyExists, codes.Unimplemented:
		d.log.Debug(op+" failed", attrs...)
	default:
		d.log.Error(op+" failed", attrs...)
	}
	return st
}

// getOne is Get for every kind: a ref is required, a miss is NOT_FOUND.
func getOne[T proto.Message](ctx context.Context, d *Data, kind Kind, ref string) (T, error) {
	var zero T
	if ref == "" {
		return zero, toStatus(&BadRequestError{Message: refRequiredMessage})
	}
	msg, err := d.store.Get(ctx, kind, ref)
	if err != nil {
		return zero, d.fail("get", err, "kind", kind, "ref", ref)
	}
	out, ok := msg.(T)
	if !ok {
		return zero, d.fail("get", fmt.Errorf("store returned %T for kind %s", msg, kind), "kind", kind, "ref", ref)
	}
	return out, nil
}

// findMany is FindBy for every kind: no match is an empty list, not an error.
func findMany[T proto.Message](ctx context.Context, d *Data, kind Kind, field, value string) ([]T, error) {
	msgs, err := d.store.FindBy(ctx, kind, field, value)
	if err != nil {
		return nil, d.fail("findBy", err, "kind", kind, "field", field)
	}
	return convert[T](d, kind, msgs)
}

// listPage is List for every kind. The next page token is the ref of the
// last item, even on the last page (the client learns the end from an empty
// page), exactly as pgdata answered.
func listPage[T proto.Message](ctx context.Context, d *Data, kind Kind, size int32, token string) ([]T, string, error) {
	msgs, err := d.store.List(ctx, kind, Page{Size: size, Token: token})
	if err != nil {
		return nil, "", d.fail("list", err, "kind", kind)
	}
	items, err := convert[T](d, kind, msgs)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(msgs) > 0 {
		next = refOf(msgs[len(msgs)-1])
	}
	return items, next, nil
}

// createOne is Create for every kind: a read-only backend answers before any
// validation, as simpledata's handler did; invalid is the request's validation.
func createOne[T proto.Message](ctx context.Context, d *Data, kind Kind, req proto.Message, invalid error) (T, error) {
	var zero T
	if d.writer == nil {
		return zero, unimplemented()
	}
	if invalid != nil {
		return zero, toStatus(invalid)
	}
	msg, err := d.writer.Create(ctx, req)
	return written[T](d, "create", kind, msg, err)
}

// updateOne is Update for every kind, with createOne's order.
func updateOne[T proto.Message](ctx context.Context, d *Data, kind Kind, req proto.Message, invalid error) (T, error) {
	var zero T
	if d.writer == nil {
		return zero, unimplemented()
	}
	if invalid != nil {
		return zero, toStatus(invalid)
	}
	msg, err := d.writer.Update(ctx, req)
	return written[T](d, "update", kind, msg, err)
}

func written[T proto.Message](d *Data, op string, kind Kind, msg proto.Message, err error) (T, error) {
	var zero T
	if err != nil {
		return zero, d.fail(op, err, "kind", kind)
	}
	out, ok := msg.(T)
	if !ok {
		return zero, d.fail(op, fmt.Errorf("store returned %T for kind %s", msg, kind), "kind", kind)
	}
	return out, nil
}

// deleteOne is Delete for every kind. pgdata answered an unreachable database
// and took every other failure, a missing ref included, as done; it is logged
// here. A delete the store refused (a BadRequestError) is answered as such, or
// the client would read OK for a resource still there.
func deleteOne(ctx context.Context, d *Data, kind Kind, ref string) (*emptypb.Empty, error) {
	if d.writer == nil {
		return nil, unimplemented()
	}
	if ref == "" {
		return nil, toStatus(&BadRequestError{Message: deleteRefRequiredMessage})
	}
	if err := d.writer.Delete(ctx, kind, ref); err != nil {
		var store *StoreError
		var refused *BadRequestError
		if (errors.As(err, &store) && store.Unavailable) || errors.As(err, &refused) {
			return nil, d.fail("delete", err, "kind", kind, "ref", ref)
		}
		d.log.Error("delete failed", "kind", kind, "ref", ref, "error", err)
	}
	return &emptypb.Empty{}, nil
}

func convert[T proto.Message](d *Data, kind Kind, msgs []proto.Message) ([]T, error) {
	items := make([]T, 0, len(msgs))
	for _, msg := range msgs {
		item, ok := msg.(T)
		if !ok {
			return nil, d.fail("read", fmt.Errorf("store returned %T for kind %s", msg, kind), "kind", kind)
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

func (s *aclServer) Create(ctx context.Context, req *acl.CreateACLRequest) (*acl.AccessControlList, error) {
	return createOne[*acl.AccessControlList](ctx, s.d, KindACL, req, validateCreateACL(req))
}

func (s *aclServer) Update(ctx context.Context, req *acl.UpdateACLRequest) (*acl.AccessControlList, error) {
	return updateOne[*acl.AccessControlList](ctx, s.d, KindACL, req, validateUpdateACL(req))
}

func (s *aclServer) Delete(ctx context.Context, req *acl.DeleteACLRequest) (*emptypb.Empty, error) {
	return deleteOne(ctx, s.d, KindACL, req.GetRef())
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

func (s *agentsServer) Create(ctx context.Context, req *agents.CreateAgentRequest) (*agents.Agent, error) {
	return createOne[*agents.Agent](ctx, s.d, KindAgent, req, validateCreateAgent(req))
}

func (s *agentsServer) Update(ctx context.Context, req *agents.UpdateAgentRequest) (*agents.Agent, error) {
	return updateOne[*agents.Agent](ctx, s.d, KindAgent, req, validateUpdateAgent(req))
}

func (s *agentsServer) Delete(ctx context.Context, req *agents.DeleteAgentRequest) (*emptypb.Empty, error) {
	return deleteOne(ctx, s.d, KindAgent, req.GetRef())
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

func (s *credentialsServer) Create(ctx context.Context, req *credentials.CreateCredentialsRequest) (*credentials.Credentials, error) {
	return createOne[*credentials.Credentials](ctx, s.d, KindCredentials, req, validateCreateCredentials(req))
}

func (s *credentialsServer) Update(ctx context.Context, req *credentials.UpdateCredentialsRequest) (*credentials.Credentials, error) {
	return updateOne[*credentials.Credentials](ctx, s.d, KindCredentials, req, validateUpdateCredentials(req))
}

func (s *credentialsServer) Delete(ctx context.Context, req *credentials.DeleteCredentialsRequest) (*emptypb.Empty, error) {
	return deleteOne(ctx, s.d, KindCredentials, req.GetRef())
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

func (s *domainsServer) Create(ctx context.Context, req *domains.CreateDomainRequest) (*domains.Domain, error) {
	return createOne[*domains.Domain](ctx, s.d, KindDomain, req, validateCreateDomain(req))
}

func (s *domainsServer) Update(ctx context.Context, req *domains.UpdateDomainRequest) (*domains.Domain, error) {
	return updateOne[*domains.Domain](ctx, s.d, KindDomain, req, validateUpdateDomain(req))
}

func (s *domainsServer) Delete(ctx context.Context, req *domains.DeleteDomainRequest) (*emptypb.Empty, error) {
	return deleteOne(ctx, s.d, KindDomain, req.GetRef())
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

func (s *numbersServer) Create(ctx context.Context, req *numbers.CreateNumberRequest) (*numbers.Number, error) {
	return createOne[*numbers.Number](ctx, s.d, KindNumber, req, validateCreateNumber(req, !s.d.allowNonE164Numbers))
}

func (s *numbersServer) Update(ctx context.Context, req *numbers.UpdateNumberRequest) (*numbers.Number, error) {
	return updateOne[*numbers.Number](ctx, s.d, KindNumber, req, validateUpdateNumber(req))
}

func (s *numbersServer) Delete(ctx context.Context, req *numbers.DeleteNumberRequest) (*emptypb.Empty, error) {
	return deleteOne(ctx, s.d, KindNumber, req.GetRef())
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

func (s *peersServer) Create(ctx context.Context, req *peers.CreatePeerRequest) (*peers.Peer, error) {
	return createOne[*peers.Peer](ctx, s.d, KindPeer, req, validateCreatePeer(req))
}

func (s *peersServer) Update(ctx context.Context, req *peers.UpdatePeerRequest) (*peers.Peer, error) {
	return updateOne[*peers.Peer](ctx, s.d, KindPeer, req, validateUpdatePeer(req))
}

func (s *peersServer) Delete(ctx context.Context, req *peers.DeletePeerRequest) (*emptypb.Empty, error) {
	return deleteOne(ctx, s.d, KindPeer, req.GetRef())
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

func (s *trunksServer) Create(ctx context.Context, req *trunks.CreateTrunkRequest) (*trunks.Trunk, error) {
	return createOne[*trunks.Trunk](ctx, s.d, KindTrunk, req, validateCreateTrunk(req))
}

func (s *trunksServer) Update(ctx context.Context, req *trunks.UpdateTrunkRequest) (*trunks.Trunk, error) {
	return updateOne[*trunks.Trunk](ctx, s.d, KindTrunk, req, validateUpdateTrunk(req))
}

func (s *trunksServer) Delete(ctx context.Context, req *trunks.DeleteTrunkRequest) (*emptypb.Empty, error) {
	return deleteOne(ctx, s.d, KindTrunk, req.GetRef())
}
