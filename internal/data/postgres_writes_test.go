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
	"reflect"
	"regexp"
	"strings"
	"syscall"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trace"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

func ptr[T any](v T) *T { return &v }

func columnsOfWrite(w *rowWrite) map[string]any {
	out := make(map[string]any, len(w.columns))
	for _, c := range w.columns {
		out[c.col] = c.val
	}
	return out
}

func writeStore(t *testing.T, db *fakeDB) *postgresStore {
	t.Helper()
	return newSampleStore(t, db).(*postgresStore)
}

func statementsOf(db *fakeDB) []string {
	var out []string
	for _, q := range db.queries {
		if !strings.HasPrefix(q.sql, "SELECT") {
			out = append(out, q.sql)
		}
	}
	return out
}

func TestNewRef(t *testing.T) {
	format := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	if ref := newRef(); !format.MatchString(ref) {
		t.Errorf("newRef() = %q, want a UUID v4", ref)
	}
	if newRef() == newRef() {
		t.Error("newRef should not repeat")
	}
}

func TestInsertOf(t *testing.T) {
	s := writeStore(t, &fakeDB{})
	extended, _ := structpb.NewStruct(map[string]any{"k": "v"})

	w, err := s.insertOf(&agents.CreateAgentRequest{
		Name: "n", Username: "u", Privacy: agents.Privacy_PRIVATE.Enum(), Enabled: ptr(false), DomainRef: "d", Extended: extended,
		Trace: &trace.Trace{Enabled: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"api_version": "v2", "domain_ref": "d", "credentials_ref": nil, "name": "n", "username": "u", "privacy": "ID",
		"max_contacts": int32(-1), "expires": int32(0), "enabled": false, "trace_enabled": true, "extended": `{"k":"v"}`,
	}
	if got := columnsOfWrite(w); !reflect.DeepEqual(got, want) {
		t.Errorf("agent = %v, want %v", got, want)
	}
	if w.ref == "" || w.kind != KindAgent {
		t.Errorf("agent write = %+v", w)
	}

	w, err = s.insertOf(&agents.CreateAgentRequest{Name: "n", Username: "u", Privacy: agents.Privacy_NONE.Enum(), MaxContacts: 5})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["privacy"] != "NONE" || got["max_contacts"] != int32(5) || got["extended"] != nil {
		t.Errorf("agent = %v", got)
	}

	if _, err := s.insertOf(&agents.CreateAgentRequest{Privacy: agents.Privacy(9).Enum()}); err == nil {
		t.Error("an unknown privacy should fail")
	}

	w, err = s.insertOf(&credentials.CreateCredentialsRequest{Name: "n", Username: "u", Password: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["password"] != "enc:secret" {
		t.Errorf("credentials = %v, want the password encrypted", got)
	}

	w, err = s.insertOf(&peers.CreatePeerRequest{Name: "n", Username: "u", Aor: "sip:a@b"})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["balancing_algorithm"] != nil || got["contact_addr"] != nil || got["max_contacts"] != int32(-1) {
		t.Errorf("peer = %v", got)
	}
	w, err = s.insertOf(&peers.CreatePeerRequest{Name: "n", Username: "u", Aor: "sip:a@b", BalancingAlgorithm: peers.LoadBalancingAlgorithm_LEAST_SESSIONS})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["balancing_algorithm"] != "LEAST_SESSIONS" {
		t.Errorf("peer = %v", got)
	}

	w, err = s.insertOf(&numbers.CreateNumberRequest{Name: "n", TelUrl: "tel:1", ExtraHeaders: []*numbers.ExtraHeader{{Name: "X-A", Value: "b"}}})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["extra_headers"] != `[{"name":"X-A","value":"b"}]` || got["aor_link"] != nil || got["trunk_ref"] != nil {
		t.Errorf("number = %v", got)
	}

	w, err = s.insertOf(&trunks.CreateTrunkRequest{Name: "n", InboundUri: "i.com", Uris: []*trunks.TrunkURI{{Host: "h.com", Port: 5060, Transport: "UDP", Weight: 1, Enabled: ptr(true)}}})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["from_domain"] != nil || got["acl_ref"] != nil {
		t.Errorf("trunk = %v", got)
	}
	wantURI := [][]any{{"h.com", int32(5060), "UDP", nil, int32(1), int32(0), true}}
	if w.children == nil || w.children.table != "trunk_uris" || !reflect.DeepEqual(w.children.rows, wantURI) {
		t.Errorf("trunk uris = %+v", w.children)
	}

	w, err = s.insertOf(&domains.CreateDomainRequest{Name: "n", DomainUri: "d.com", EgressPolicies: []*domains.EgressPolicy{{Rule: ".*", NumberRef: "n1"}}})
	if err != nil {
		t.Fatal(err)
	}
	if w.children == nil || w.children.table != "egress_policies" || !reflect.DeepEqual(w.children.rows, [][]any{{"n1", ".*"}}) {
		t.Errorf("domain policies = %+v", w.children)
	}

	w, err = s.insertOf(&acl.CreateACLRequest{Name: "n", Allow: []string{"a"}, Deny: []string{"b"}})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); !reflect.DeepEqual(got["allow"], []string{"a"}) || !reflect.DeepEqual(got["deny"], []string{"b"}) {
		t.Errorf("acl = %v", got)
	}

	if _, err := s.insertOf(&acl.DeleteACLRequest{}); err == nil {
		t.Error("a request that is no Create should fail")
	}
}

// What a Create leaves out takes the column's default in schema.prisma, as
// Prisma's undefined did; what it sends, false included, is what is stored.
func TestInsertOfDefaults(t *testing.T) {
	s := writeStore(t, &fakeDB{})

	w, err := s.insertOf(&agents.CreateAgentRequest{Name: "n", Username: "u"})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["privacy"] != "NONE" || got["enabled"] != true {
		t.Errorf("agent defaults = %v", got)
	}
	w, err = s.insertOf(&agents.CreateAgentRequest{Name: "n", Username: "u", Privacy: agents.Privacy_PRIVATE.Enum(), Enabled: ptr(false)})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["privacy"] != "ID" || got["enabled"] != false {
		t.Errorf("agent explicit = %v", got)
	}

	w, err = s.insertOf(&peers.CreatePeerRequest{Name: "n", Username: "u", Aor: "sip:a@b"})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["enabled"] != true {
		t.Errorf("peer defaults = %v", got)
	}
	w, err = s.insertOf(&peers.CreatePeerRequest{Name: "n", Username: "u", Aor: "sip:a@b", Enabled: ptr(false)})
	if err != nil {
		t.Fatal(err)
	}
	if got := columnsOfWrite(w); got["enabled"] != false {
		t.Errorf("peer explicit = %v", got)
	}

	w, err = s.insertOf(&trunks.CreateTrunkRequest{Name: "n", InboundUri: "i.com", Uris: []*trunks.TrunkURI{
		{Host: "a.com", Port: 5060, Transport: "UDP"},
		{Host: "b.com", Port: 5060, Transport: "UDP", Enabled: ptr(false)},
	}})
	if err != nil {
		t.Fatal(err)
	}
	const enabledColumn = 6
	if got := w.children.rows; got[0][enabledColumn] != true || got[1][enabledColumn] != false {
		t.Errorf("trunk uris = %v", got)
	}
}

// The cases of mods/pgdata/test/update.unit.test.ts: only what the request
// sent is written.
func TestUpdateOf(t *testing.T) {
	s := writeStore(t, &fakeDB{})
	emptyExtended, _ := structpb.NewStruct(nil)
	tests := []struct {
		name     string
		req      proto.Message
		want     map[string]any
		children string
	}{
		{"only the name of a Domain", &domains.UpdateDomainRequest{Ref: "r", Name: ptr("n")}, map[string]any{"name": "n"}, ""},
		{"replaces egress policies", &domains.UpdateDomainRequest{Ref: "r", EgressPolicies: []*domains.EgressPolicy{{Rule: "^1", NumberRef: "n"}}}, map[string]any{}, "egress_policies"},
		{"keeps egress policies on an empty list", &domains.UpdateDomainRequest{Ref: "r", EgressPolicies: []*domains.EgressPolicy{}}, map[string]any{}, ""},
		{"clears a Domain reference", &domains.UpdateDomainRequest{Ref: "r", AccessControlListRef: ptr("")}, map[string]any{"acl_ref": nil}, ""},
		{"the rest of a Trunk untouched", &trunks.UpdateTrunkRequest{Ref: "r", Name: ptr("n")}, map[string]any{"name": "n"}, ""},
		{"an explicit false", &trunks.UpdateTrunkRequest{Ref: "r", SendRegister: ptr(false)}, map[string]any{"send_register": false}, ""},
		{"caller identity", &trunks.UpdateTrunkRequest{Ref: "r", NormalizeToE164: ptr(true), RewriteFromWithNumber: ptr(true), FromDomain: ptr("sip.example.com")},
			map[string]any{"normalize_to_e164": true, "rewrite_from_with_number": true, "from_domain": "sip.example.com"}, ""},
		{"clears from domain", &trunks.UpdateTrunkRequest{Ref: "r", FromDomain: ptr("")}, map[string]any{"from_domain": nil}, ""},
		{"replaces Trunk URIs", &trunks.UpdateTrunkRequest{Ref: "r", Uris: []*trunks.TrunkURI{{Host: "new.example", Port: 5060}}}, map[string]any{}, "trunk_uris"},
		{"api version is always v2", &trunks.UpdateTrunkRequest{Ref: "r", ApiVersion: ptr("v2beta1")}, map[string]any{"api_version": "v2"}, ""},
		{"keeps ACL rules not sent", &acl.UpdateACLRequest{Ref: "r", Allow: []string{"192.168.1.0/24"}}, map[string]any{"allow": []string{"192.168.1.0/24"}}, ""},
		{"an empty extended is sent", &acl.UpdateACLRequest{Ref: "r", Extended: emptyExtended}, map[string]any{"extended": "{}"}, ""},
		{"Agent", &agents.UpdateAgentRequest{Ref: "r", Privacy: agents.Privacy_NONE.Enum(), Enabled: ptr(false), DomainRef: ptr(""), MaxContacts: ptr(int32(0)), Trace: &trace.Trace{}},
			map[string]any{"privacy": "NONE", "enabled": false, "domain_ref": nil, "max_contacts": int32(0), "trace_enabled": false}, ""},
		{"Credentials encrypts", &credentials.UpdateCredentialsRequest{Ref: "r", Password: ptr("p")}, map[string]any{"password": "enc:p"}, ""},
		{"Number", &numbers.UpdateNumberRequest{Ref: "r", AorLink: ptr(""), TrunkRef: ptr(""), ExtraHeaders: []*numbers.ExtraHeader{{Name: "X", Value: "y"}}},
			map[string]any{"aor_link": "", "trunk_ref": nil, "extra_headers": `[{"name":"X","value":"y"}]`}, ""},
		{"Peer with an unspecified algorithm", &peers.UpdatePeerRequest{Ref: "r", BalancingAlgorithm: peers.LoadBalancingAlgorithm_UNSPECIFIED.Enum()}, map[string]any{}, ""},
		{"Peer", &peers.UpdatePeerRequest{Ref: "r", BalancingAlgorithm: peers.LoadBalancingAlgorithm_ROUND_ROBIN.Enum(), ContactAddr: ptr("")},
			map[string]any{"balancing_algorithm": "ROUND_ROBIN", "contact_addr": ""}, ""},
	}
	for _, tt := range tests {
		w, err := s.updateOf(tt.req)
		if err != nil {
			t.Errorf("%s: %v", tt.name, err)
			continue
		}
		if got := columnsOfWrite(w); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("%s = %v, want %v", tt.name, got, tt.want)
		}
		if w.ref != "r" {
			t.Errorf("%s: ref = %q", tt.name, w.ref)
		}
		children := ""
		if w.children != nil {
			children = w.children.table
		}
		if children != tt.children {
			t.Errorf("%s: children = %q, want %q", tt.name, children, tt.children)
		}
	}
	if _, err := s.updateOf(&acl.DeleteACLRequest{}); err == nil {
		t.Error("a request that is no Update should fail")
	}
}

func TestInsertAndUpdateSQL(t *testing.T) {
	if got, want := insertSQL("trunk_uris", []string{"ref", "user"}), `INSERT INTO "trunk_uris" ("ref", "user") VALUES ($1, $2)`; got != want {
		t.Errorf("insertSQL = %q, want %q", got, want)
	}
	sql, args := updateSQL("agents", []columnValue{{"name", "n"}, {"enabled", false}})
	if want := `UPDATE "agents" SET "name" = $2, "enabled" = $3, updated_at = now() WHERE ref = $1 RETURNING ref`; sql != want {
		t.Errorf("updateSQL = %q, want %q", sql, want)
	}
	if !reflect.DeepEqual(args, []any{"n", false}) {
		t.Errorf("updateSQL args = %v", args)
	}
	if sql, _ := updateSQL("agents", nil); sql != `UPDATE "agents" SET updated_at = now() WHERE ref = $1 RETURNING ref` {
		t.Errorf("updateSQL with no column = %q", sql)
	}
}

func TestPostgresCreate(t *testing.T) {
	db := sampleDB()
	var password any
	db.onWrite = func(sql string, args []any) ([][]any, error) {
		if strings.HasPrefix(sql, `INSERT INTO "credentials"`) {
			// ref, api_version, name, username, password, extended, created_at, updated_at
			password = args[4]
			db.rows["credentials"] = append(db.rows["credentials"], []any{"v2", args[0], args[2], args[3], args[4], created, updated, nil})
		}
		return nil, nil
	}
	s := writeStore(t, db)
	msg, err := s.Create(context.Background(), &credentials.CreateCredentialsRequest{Name: "n", Username: "u", Password: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	got := msg.(*credentials.Credentials)
	if got.GetPassword() != "secret" || got.GetUsername() != "u" || got.GetRef() == "" || got.GetApiVersion() != "v2" {
		t.Errorf("created = %v", got)
	}
	if password != "enc:secret" {
		t.Errorf("stored password = %v, want it encrypted", password)
	}
	if db.commits != 1 || db.rollbacks != 0 {
		t.Errorf("commits = %d, rollbacks = %d", db.commits, db.rollbacks)
	}
}

func TestPostgresCreateWritesChildrenInOneTransaction(t *testing.T) {
	db := sampleDB()
	db.onWrite = func(sql string, args []any) ([][]any, error) {
		if strings.HasPrefix(sql, `INSERT INTO "trunks"`) {
			db.rows["trunks"] = append(db.rows["trunks"], []any{"v2", args[0], nil, nil, nil, "n", false, false, false, nil, "i.com", created, updated, nil, false})
		}
		return nil, nil
	}
	s := writeStore(t, db)
	_, err := s.Create(context.Background(), &trunks.CreateTrunkRequest{
		Name: "n", InboundUri: "i.com",
		Uris: []*trunks.TrunkURI{{Host: "a.com", Port: 1, Transport: "UDP"}, {Host: "b.com", Port: 2, Transport: "TCP"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	statements := statementsOf(db)
	if len(statements) != 3 || !strings.HasPrefix(statements[0], `INSERT INTO "trunks"`) || !strings.HasPrefix(statements[1], `INSERT INTO "trunk_uris"`) || !strings.HasPrefix(statements[2], `INSERT INTO "trunk_uris"`) {
		t.Errorf("statements = %v", statements)
	}
	if db.commits != 1 {
		t.Errorf("commits = %d", db.commits)
	}
}

func TestPostgresCreateErrors(t *testing.T) {
	ctx := context.Background()
	req := &agents.CreateAgentRequest{Name: "n", Username: "u"}

	db := sampleDB()
	db.onWrite = func(string, []any) ([][]any, error) {
		return nil, &pgconn.PgError{Code: "23505", Detail: "Key (username)=(u) already exists.", ConstraintName: "agents_username_key"}
	}
	_, err := writeStore(t, db).Create(ctx, req)
	var exists *AlreadyExistsError
	if !errors.As(err, &exists) || exists.Message != "Resource already exist for field: username" {
		t.Errorf("unique violation = %v", err)
	}
	if db.commits != 0 || db.rollbacks != 1 {
		t.Errorf("commits = %d, rollbacks = %d", db.commits, db.rollbacks)
	}

	db = sampleDB()
	db.onWrite = func(string, []any) ([][]any, error) {
		return nil, &pgconn.PgError{Code: "23503", ConstraintName: "agents_domain_ref_fkey"}
	}
	_, err = writeStore(t, db).Create(ctx, req)
	var bad *BadRequestError
	if !errors.As(err, &bad) || bad.Message != "Dependent resource doesn't exist for: agents_domain_ref_fkey (index)" {
		t.Errorf("foreign key violation = %v", err)
	}

	db = sampleDB()
	db.onWrite = func(string, []any) ([][]any, error) {
		return nil, &pgconn.PgError{Code: "22P02"}
	}
	_, err = writeStore(t, db).Create(ctx, req)
	var store *StoreError
	if !errors.As(err, &store) || store.Unavailable {
		t.Errorf("a value the column refuses = %v, want a StoreError", err)
	}

	db = sampleDB()
	db.failBegin = &net.OpError{Op: "dial", Net: "tcp", Err: syscall.ECONNREFUSED}
	_, err = writeStore(t, db).Create(ctx, req)
	if !errors.As(err, &store) || !store.Unavailable {
		t.Errorf("no database = %v, want an unavailable StoreError", err)
	}
}

func TestPostgresUpdate(t *testing.T) {
	ctx := context.Background()
	db := sampleDB()
	db.onWrite = func(sql string, args []any) ([][]any, error) {
		if strings.HasPrefix(sql, "UPDATE") {
			return [][]any{{args[0]}}, nil
		}
		return nil, nil
	}
	s := writeStore(t, db)
	msg, err := s.Update(ctx, &trunks.UpdateTrunkRequest{Ref: "t1", Name: ptr("n"), Uris: []*trunks.TrunkURI{{Host: "new.example", Port: 5060, Transport: "UDP"}}})
	if err != nil {
		t.Fatal(err)
	}
	if msg.(*trunks.Trunk).GetRef() != "t1" {
		t.Errorf("updated = %v", msg)
	}
	statements := statementsOf(db)
	if len(statements) != 3 || !strings.HasPrefix(statements[0], `UPDATE "trunks"`) || !strings.HasPrefix(statements[1], `DELETE FROM "trunk_uris"`) || !strings.HasPrefix(statements[2], `INSERT INTO "trunk_uris"`) {
		t.Errorf("statements = %v", statements)
	}
	if db.commits != 1 {
		t.Errorf("commits = %d", db.commits)
	}
}

func TestPostgresUpdateErrors(t *testing.T) {
	ctx := context.Background()

	db := sampleDB()
	db.onWrite = func(string, []any) ([][]any, error) { return nil, nil }
	_, err := writeStore(t, db).Update(ctx, &domains.UpdateDomainRequest{Ref: "nope", EgressPolicies: []*domains.EgressPolicy{{Rule: "x", NumberRef: "n1"}}})
	var notFound *NotFoundError
	if !errors.As(err, &notFound) || notFound.Ref != "nope" {
		t.Errorf("no row = %v, want NotFoundError", err)
	}
	if statements := statementsOf(db); len(statements) != 1 {
		t.Errorf("statements after a miss = %v", statements)
	}
	if db.commits != 0 || db.rollbacks != 1 {
		t.Errorf("commits = %d, rollbacks = %d", db.commits, db.rollbacks)
	}

	// The insert of the new policies fails: the delete rolls back with it
	db = sampleDB()
	db.onWrite = func(sql string, args []any) ([][]any, error) {
		switch {
		case strings.HasPrefix(sql, "UPDATE"):
			return [][]any{{args[0]}}, nil
		case strings.HasPrefix(sql, "INSERT"):
			return nil, &pgconn.PgError{Code: "23503", ConstraintName: "egress_policies_number_ref_fkey"}
		}
		return nil, nil
	}
	_, err = writeStore(t, db).Update(ctx, &domains.UpdateDomainRequest{Ref: "d1", EgressPolicies: []*domains.EgressPolicy{{Rule: "x", NumberRef: "nope"}}})
	var bad *BadRequestError
	if !errors.As(err, &bad) || bad.Message != "Dependent resource doesn't exist for: egress_policies_number_ref_fkey (index)" {
		t.Errorf("foreign key violation = %v", err)
	}
	if db.commits != 0 || db.rollbacks != 1 {
		t.Errorf("commits = %d, rollbacks = %d", db.commits, db.rollbacks)
	}

	// pgdata did not map a duplicate on update
	db = sampleDB()
	db.onWrite = func(string, []any) ([][]any, error) {
		return nil, &pgconn.PgError{Code: "23505", Detail: "Key (inbound_uri)=(a) already exists."}
	}
	_, err = writeStore(t, db).Update(ctx, &trunks.UpdateTrunkRequest{Ref: "t1", InboundUri: ptr("a")})
	var store *StoreError
	var exists *AlreadyExistsError
	if !errors.As(err, &store) || errors.As(err, &exists) {
		t.Errorf("duplicate on update = %v, want a StoreError", err)
	}
}

func TestPostgresDelete(t *testing.T) {
	ctx := context.Background()
	db := sampleDB()
	db.onWrite = func(string, []any) ([][]any, error) { return nil, nil }
	s := writeStore(t, db)
	if err := s.Delete(ctx, KindAgent, "nope"); err != nil {
		t.Errorf("Delete = %v", err)
	}
	if statements := statementsOf(db); len(statements) != 1 || statements[0] != `DELETE FROM "agents" WHERE ref = $1` {
		t.Errorf("statements = %v", statements)
	}
	if err := s.Delete(ctx, Kind("bogus"), "r"); err == nil {
		t.Error("unknown kind should fail")
	}
}

func TestUniqueField(t *testing.T) {
	for _, tt := range []struct {
		err  *pgconn.PgError
		want string
	}{
		{&pgconn.PgError{Detail: "Key (domain_uri)=(sip.local) already exists."}, "domain_uri"},
		{&pgconn.PgError{Detail: `Key ("user", host)=(a, b) already exists.`}, "user"},
		{&pgconn.PgError{ConstraintName: "agents_username_key"}, "agents_username_key"},
		{&pgconn.PgError{Detail: "(no key", ConstraintName: "c"}, "c"},
	} {
		if got := uniqueField(tt.err); got != tt.want {
			t.Errorf("uniqueField(%+v) = %q, want %q", tt.err, got, tt.want)
		}
	}
}
