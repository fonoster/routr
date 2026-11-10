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
	"net"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// serve runs the Data API over a Store on an in-memory connection and
// returns a client connection to it.
func serve(t *testing.T, store Store) *grpc.ClientConn {
	t.Helper()
	api, err := New(store, Options{})
	if err != nil {
		t.Fatal(err)
	}
	lis := bufconn.Listen(1 << 20)
	server := grpc.NewServer()
	api.Register(server)
	go func() { _ = server.Serve(lis) }()
	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return lis.Dial() }),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		conn.Close()
		server.Stop()
		_ = store.Close()
	})
	return conn
}

func TestNewRequiresAStore(t *testing.T) {
	if _, err := New(nil, Options{}); err == nil {
		t.Error("nil store should fail")
	}
}

func TestServiceReadsOverTheWire(t *testing.T) {
	conn := serve(t, loadSample(t))
	ctx := context.Background()

	agent, err := agents.NewAgentsClient(conn).Get(ctx, &agents.GetAgentRequest{Ref: "agent-01"})
	if err != nil {
		t.Fatal(err)
	}
	if agent.GetUsername() != "1001" || agent.GetDomain().GetDomainUri() != "sip.local" {
		t.Errorf("agent = %v", agent)
	}

	found, err := agents.NewAgentsClient(conn).FindBy(ctx, &agents.FindByRequest{FieldName: "username", FieldValue: "1002"})
	if err != nil {
		t.Fatal(err)
	}
	if len(found.GetItems()) != 1 || found.GetItems()[0].GetRef() != "agent-02" {
		t.Errorf("found = %v", found)
	}
	found, err = agents.NewAgentsClient(conn).FindBy(ctx, &agents.FindByRequest{FieldName: "username", FieldValue: "none"})
	if err != nil || len(found.GetItems()) != 0 {
		t.Errorf("no match = %v, %v", found, err)
	}

	// rctl pages with a size and the last ref, until an empty page
	page, err := numbers.NewNumbersClient(conn).List(ctx, &numbers.ListNumberRequest{PageSize: 5})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.GetItems()) != 5 || page.GetNextPageToken() != "number-05" {
		t.Errorf("first page = %d items, token %q", len(page.GetItems()), page.GetNextPageToken())
	}
	page, err = numbers.NewNumbersClient(conn).List(ctx, &numbers.ListNumberRequest{PageSize: 5, PageToken: page.GetNextPageToken()})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.GetItems()) != 2 || page.GetNextPageToken() != "number-07" {
		t.Errorf("second page = %d items, token %q", len(page.GetItems()), page.GetNextPageToken())
	}
	page, err = numbers.NewNumbersClient(conn).List(ctx, &numbers.ListNumberRequest{PageSize: 5, PageToken: page.GetNextPageToken()})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.GetItems()) != 0 || page.GetNextPageToken() != "" {
		t.Errorf("last page = %v", page)
	}
	// No pageSize, an SDK list({}): the whole table, its last ref as the token
	whole, err := credentials.NewCredentialsServiceClient(conn).List(ctx, &credentials.ListCredentialsRequest{})
	if err != nil || len(whole.GetItems()) == 0 || whole.GetNextPageToken() == "" {
		t.Errorf("no pageSize = %v, %v", whole, err)
	}

	if _, err := peers.NewPeersClient(conn).Get(ctx, &peers.GetPeerRequest{Ref: "peer-02"}); err != nil {
		t.Error(err)
	}
	if _, err := domains.NewDomainsClient(conn).Get(ctx, &domains.GetDomainRequest{Ref: "domain-01"}); err != nil {
		t.Error(err)
	}
	if _, err := trunks.NewTrunksClient(conn).Get(ctx, &trunks.GetTrunkRequest{Ref: "trunk-04"}); err != nil {
		t.Error(err)
	}
	if _, err := acl.NewACLServiceClient(conn).Get(ctx, &acl.GetACLRequest{Ref: "acl-01"}); err != nil {
		t.Error(err)
	}
	for _, c := range []func() error{
		func() error {
			_, err := domains.NewDomainsClient(conn).FindBy(ctx, &domains.FindByRequest{FieldName: "domainUri", FieldValue: "sip.local"})
			return err
		},
		func() error {
			_, err := numbers.NewNumbersClient(conn).FindBy(ctx, &numbers.FindByRequest{FieldName: "telUrl", FieldValue: "tel:+17066041487"})
			return err
		},
		func() error {
			_, err := peers.NewPeersClient(conn).FindBy(ctx, &peers.FindByRequest{FieldName: "aor", FieldValue: "sip:voice@sip.local"})
			return err
		},
		func() error {
			_, err := trunks.NewTrunksClient(conn).FindBy(ctx, &trunks.FindByRequest{FieldName: "sendRegister", FieldValue: "true"})
			return err
		},
		func() error {
			_, err := agents.NewAgentsClient(conn).List(ctx, &agents.ListAgentsRequest{})
			return err
		},
		func() error {
			_, err := peers.NewPeersClient(conn).List(ctx, &peers.ListPeersRequest{})
			return err
		},
		func() error {
			_, err := domains.NewDomainsClient(conn).List(ctx, &domains.ListDomainRequest{})
			return err
		},
		func() error {
			_, err := trunks.NewTrunksClient(conn).List(ctx, &trunks.ListTrunkRequest{})
			return err
		},
		func() error {
			_, err := acl.NewACLServiceClient(conn).List(ctx, &acl.ListACLsRequest{})
			return err
		},
	} {
		if err := c(); err != nil {
			t.Error(err)
		}
	}
}

func TestServiceErrorsOverTheWire(t *testing.T) {
	conn := serve(t, loadSample(t))
	ctx := context.Background()

	_, err := agents.NewAgentsClient(conn).Get(ctx, &agents.GetAgentRequest{Ref: "agent-99"})
	if st, _ := status.FromError(err); st.Code() != codes.NotFound || st.Message() != "Resource not found: agent-99" {
		t.Errorf("not found = %v", err)
	}
	_, err = agents.NewAgentsClient(conn).Get(ctx, &agents.GetAgentRequest{})
	if st, _ := status.FromError(err); st.Code() != codes.InvalidArgument || st.Message() != refRequiredMessage {
		t.Errorf("no ref = %v", err)
	}
	_, err = credentials.NewCredentialsServiceClient(conn).Get(ctx, &credentials.GetCredentialsRequest{Ref: "x"})
	if st, _ := status.FromError(err); st.Code() != codes.NotFound {
		t.Errorf("credentials not found = %v", err)
	}
}

func TestServiceWritesAreUnimplemented(t *testing.T) {
	conn := serve(t, loadSample(t))
	ctx := context.Background()
	calls := []func() error{
		func() error { _, err := acl.NewACLServiceClient(conn).Create(ctx, &acl.CreateACLRequest{}); return err },
		func() error { _, err := acl.NewACLServiceClient(conn).Update(ctx, &acl.UpdateACLRequest{}); return err },
		func() error { _, err := acl.NewACLServiceClient(conn).Delete(ctx, &acl.DeleteACLRequest{}); return err },
		func() error {
			_, err := agents.NewAgentsClient(conn).Create(ctx, &agents.CreateAgentRequest{})
			return err
		},
		func() error {
			_, err := agents.NewAgentsClient(conn).Update(ctx, &agents.UpdateAgentRequest{})
			return err
		},
		func() error {
			_, err := agents.NewAgentsClient(conn).Delete(ctx, &agents.DeleteAgentRequest{})
			return err
		},
		func() error {
			_, err := credentials.NewCredentialsServiceClient(conn).Create(ctx, &credentials.CreateCredentialsRequest{})
			return err
		},
		func() error {
			_, err := credentials.NewCredentialsServiceClient(conn).Update(ctx, &credentials.UpdateCredentialsRequest{})
			return err
		},
		func() error {
			_, err := credentials.NewCredentialsServiceClient(conn).Delete(ctx, &credentials.DeleteCredentialsRequest{})
			return err
		},
		func() error {
			_, err := domains.NewDomainsClient(conn).Create(ctx, &domains.CreateDomainRequest{})
			return err
		},
		func() error {
			_, err := domains.NewDomainsClient(conn).Update(ctx, &domains.UpdateDomainRequest{})
			return err
		},
		func() error {
			_, err := domains.NewDomainsClient(conn).Delete(ctx, &domains.DeleteDomainRequest{})
			return err
		},
		func() error {
			_, err := numbers.NewNumbersClient(conn).Create(ctx, &numbers.CreateNumberRequest{})
			return err
		},
		func() error {
			_, err := numbers.NewNumbersClient(conn).Update(ctx, &numbers.UpdateNumberRequest{})
			return err
		},
		func() error {
			_, err := numbers.NewNumbersClient(conn).Delete(ctx, &numbers.DeleteNumberRequest{})
			return err
		},
		func() error { _, err := peers.NewPeersClient(conn).Create(ctx, &peers.CreatePeerRequest{}); return err },
		func() error { _, err := peers.NewPeersClient(conn).Update(ctx, &peers.UpdatePeerRequest{}); return err },
		func() error { _, err := peers.NewPeersClient(conn).Delete(ctx, &peers.DeletePeerRequest{}); return err },
		func() error {
			_, err := trunks.NewTrunksClient(conn).Create(ctx, &trunks.CreateTrunkRequest{})
			return err
		},
		func() error {
			_, err := trunks.NewTrunksClient(conn).Update(ctx, &trunks.UpdateTrunkRequest{})
			return err
		},
		func() error {
			_, err := trunks.NewTrunksClient(conn).Delete(ctx, &trunks.DeleteTrunkRequest{})
			return err
		},
	}
	for i, call := range calls {
		err := call()
		st, _ := status.FromError(err)
		if st.Code() != codes.Unimplemented || st.Message() != unimplementedMessage {
			t.Errorf("write %d = %v, want Unimplemented", i, err)
		}
	}
}

// TestServiceWritesOverTheWire answers writes from the postgres backend on the
// fake database: validation comes first, and each failure reaches the client
// with pgdata's code and message.
func TestServiceWritesOverTheWire(t *testing.T) {
	ctx := context.Background()
	db := sampleDB()
	var writeErr error
	db.onWrite = func(sql string, args []any) ([][]any, error) {
		if writeErr != nil {
			return nil, writeErr
		}
		if strings.HasPrefix(sql, "UPDATE") && args[0] == "c1" {
			return [][]any{{"c1"}}, nil
		}
		return nil, nil
	}
	conn := serve(t, newSampleStore(t, db))
	creds := credentials.NewCredentialsServiceClient(conn)

	check := func(name string, err error, code codes.Code, message string) {
		t.Helper()
		st, _ := status.FromError(err)
		if st.Code() != code || st.Message() != message {
			t.Errorf("%s = %v, want %v %q", name, err, code, message)
		}
	}

	_, err := creds.Create(ctx, &credentials.CreateCredentialsRequest{})
	check("create without a name", err, codes.InvalidArgument, "the friendly name for the resource is required")
	_, err = creds.Update(ctx, &credentials.UpdateCredentialsRequest{})
	check("update without a ref", err, codes.InvalidArgument, "the reference to the resource is required")
	if len(db.queries) != 0 {
		t.Errorf("a request that fails validation ran %v", db.queries)
	}

	renamed := "Renamed"
	updated, err := creds.Update(ctx, &credentials.UpdateCredentialsRequest{Ref: "c1", Name: &renamed})
	if err != nil || updated.GetRef() != "c1" || updated.GetPassword() != "1234" {
		t.Errorf("update = %v, %v", updated, err)
	}
	_, err = creds.Update(ctx, &credentials.UpdateCredentialsRequest{Ref: "nope", Name: &renamed})
	check("update of no row", err, codes.NotFound, "Resource not found: nope")

	_, err = creds.Delete(ctx, &credentials.DeleteCredentialsRequest{})
	check("delete without a ref", err, codes.InvalidArgument, "parameter ref is required")
	if _, err := creds.Delete(ctx, &credentials.DeleteCredentialsRequest{Ref: "nope"}); err != nil {
		t.Errorf("delete of no row = %v", err)
	}

	writeErr = &pgconn.PgError{Code: "23505", Detail: "Key (username)=(1001) already exists.", ConstraintName: "agents_username_key"}
	_, err = agents.NewAgentsClient(conn).Create(ctx, &agents.CreateAgentRequest{Name: "A", Username: "1001"})
	check("duplicate", err, codes.AlreadyExists, "Resource already exist for field: username")
	writeErr = &pgconn.PgError{Code: "23505", Detail: "Key (inbound_uri)=(sip.acme.io) already exists.", ConstraintName: "trunks_inbound_uri_key"}
	inboundURI := "sip.acme.io"
	_, err = trunks.NewTrunksClient(conn).Update(ctx, &trunks.UpdateTrunkRequest{Ref: "t1", InboundUri: &inboundURI})
	check("duplicate on update", err, codes.AlreadyExists, "Resource already exist for field: inbound_uri")

	writeErr = &pgconn.PgError{Code: "23503", ConstraintName: "agents_domain_ref_fkey"}
	_, err = agents.NewAgentsClient(conn).Create(ctx, &agents.CreateAgentRequest{Name: "A", Username: "1003", DomainRef: "nope"})
	check("missing dependency", err, codes.InvalidArgument, "Dependent resource doesn't exist for: agents_domain_ref_fkey")

	// Credentials a Trunk references stay, and the client reads why
	db.onSelect = func(sql string, _ []any) ([][]any, bool) {
		return [][]any{{"t1"}}, strings.HasPrefix(sql, `SELECT ref FROM "trunks"`)
	}
	_, err = creds.Delete(ctx, &credentials.DeleteCredentialsRequest{Ref: "c2"})
	check("delete of what a Trunk references", err, codes.InvalidArgument, "the Credentials c2 is in use by Trunk t1: remove it from the Trunk first")
	db.onSelect = nil

	// pgdata took every other failure of a delete as done, but for an
	// unreachable database; a database not migrated yet is one
	writeErr = &pgconn.PgError{Code: "42703"}
	if _, err := creds.Delete(ctx, &credentials.DeleteCredentialsRequest{Ref: "c1"}); err != nil {
		t.Errorf("delete refused by the database = %v, want OK", err)
	}
	writeErr = &pgconn.PgError{Code: "42P01"}
	_, err = creds.Delete(ctx, &credentials.DeleteCredentialsRequest{Ref: "c1"})
	check("delete on a database not migrated yet", err, codes.Unavailable, "Service unavailable")
	writeErr = &pgconn.PgError{Code: "57P01"}
	_, err = creds.Delete(ctx, &credentials.DeleteCredentialsRequest{Ref: "c1"})
	check("delete on an unreachable database", err, codes.Unavailable, "Service unavailable")

	_, err = agents.NewAgentsClient(conn).FindBy(ctx, &agents.FindByRequest{FieldName: "privacy", FieldValue: "ID"})
	if status.Code(err) != codes.InvalidArgument {
		t.Errorf("FindBy with an invalid enum value = %v, want InvalidArgument", err)
	}
}

// brokenStore fails or answers the wrong type, to cover the handlers'
// error paths.
type brokenStore struct {
	err error
}

func (s brokenStore) Get(context.Context, Kind, string) (proto.Message, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &peers.Peer{}, nil
}

func (s brokenStore) FindBy(context.Context, Kind, string, string) ([]proto.Message, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []proto.Message{&peers.Peer{}}, nil
}

func (s brokenStore) List(context.Context, Kind, Page) ([]proto.Message, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []proto.Message{&peers.Peer{}}, nil
}

func (brokenStore) Close() error { return nil }

func TestServiceStoreFailures(t *testing.T) {
	ctx := context.Background()
	// The client gets pgdata's fixed messages, never the query or the
	// driver's text
	for name, tt := range map[string]struct {
		err     error
		code    codes.Code
		message string
	}{
		"unreachable": {&StoreError{Unavailable: true, Err: errors.New(`query SELECT ref FROM "agents": connection refused`)}, codes.Unavailable, "Service unavailable"},
		"refused":     {&StoreError{Err: errors.New(`query SELECT ref FROM "agents": ERROR: relation "agents" does not exist`)}, codes.Unknown, "Unknown error"},
		"plain error": {errors.New("database is down"), codes.Unknown, "Unknown error"},
		"not found":   {&NotFoundError{Ref: "a"}, codes.NotFound, "Resource not found: a"},
		"bad request": {&BadRequestError{Message: "no"}, codes.InvalidArgument, "no"},
		"grpc status": {status.Error(codes.PermissionDenied, "nope"), codes.PermissionDenied, "nope"},
	} {
		conn := serve(t, brokenStore{err: tt.err})
		client := agents.NewAgentsClient(conn)
		for op, call := range map[string]func() error{
			"get": func() error { _, err := client.Get(ctx, &agents.GetAgentRequest{Ref: "a"}); return err },
			"findBy": func() error {
				_, err := client.FindBy(ctx, &agents.FindByRequest{FieldName: "ref", FieldValue: "a"})
				return err
			},
			"list": func() error { _, err := client.List(ctx, &agents.ListAgentsRequest{}); return err },
		} {
			err := call()
			if st, _ := status.FromError(err); st.Code() != tt.code || st.Message() != tt.message {
				t.Errorf("%s/%s = %v, want %s %q", name, op, err, tt.code, tt.message)
			}
		}
	}

	conn := serve(t, brokenStore{})
	client := agents.NewAgentsClient(conn)
	for name, call := range map[string]func() error{
		"get": func() error { _, err := client.Get(ctx, &agents.GetAgentRequest{Ref: "a"}); return err },
		"findBy": func() error {
			_, err := client.FindBy(ctx, &agents.FindByRequest{FieldName: "ref", FieldValue: "a"})
			return err
		},
		"list": func() error { _, err := client.List(ctx, &agents.ListAgentsRequest{}); return err },
	} {
		err := call()
		if st, _ := status.FromError(err); st.Code() != codes.Unknown || st.Message() != "Unknown error" {
			t.Errorf("%s with the wrong type = %v, want Unknown \"Unknown error\"", name, err)
		}
	}
}

func TestRefOf(t *testing.T) {
	for _, msg := range []proto.Message{
		&agents.Agent{Ref: "r"}, &peers.Peer{Ref: "r"}, &numbers.Number{Ref: "r"}, &trunks.Trunk{Ref: "r"},
		&domains.Domain{Ref: "r"}, &credentials.Credentials{Ref: "r"}, &acl.AccessControlList{Ref: "r"},
	} {
		if refOf(msg) != "r" {
			t.Errorf("refOf(%T) = %q", msg, refOf(msg))
		}
	}
	if refOf(&agents.GetAgentRequest{Ref: "r"}) != "" {
		t.Error("a request has no ref to read")
	}
}

func TestMessageOf(t *testing.T) {
	for _, kind := range Kinds {
		if MessageOf(kind) == nil {
			t.Errorf("MessageOf(%s) = nil", kind)
		}
	}
	if MessageOf(Kind("bogus")) != nil {
		t.Error("unknown kind should have no message")
	}
}
