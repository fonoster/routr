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
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"reflect"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// fakeDB answers each query from the rows registered for its table (the
// FROM clause) and records every query it ran. Rows are the values pgx
// would scan: string, bool, int (an INTEGER), time.Time, []string (an
// array), nil (NULL) and string for JSONB and enum columns.
type fakeDB struct {
	rows    map[string][][]any
	queries []query
	fail    error
	// failBegin fails opening a transaction
	failBegin error
	// onSelect answers the SELECTs it knows, ahead of the registered rows: what
	// they cannot serve, such as one column of a table
	onSelect func(sql string, args []any) ([][]any, bool)
	// onWrite answers the statements that are not a SELECT; nil treats them as
	// a read
	onWrite func(sql string, args []any) ([][]any, error)
	// commits and rollbacks count how the transactions ended
	commits, rollbacks int
}

// fakeTx runs on the fake database and counts how it ended; as with pgx, a
// rollback after a commit does nothing.
type fakeTx struct {
	db   *fakeDB
	done bool
}

func (db *fakeDB) Begin(context.Context) (Tx, error) {
	if db.failBegin != nil {
		return nil, db.failBegin
	}
	return &fakeTx{db: db}, nil
}

func (tx *fakeTx) Query(ctx context.Context, sql string, args ...any) (Rows, error) {
	return tx.db.Query(ctx, sql, args...)
}

func (tx *fakeTx) Commit(context.Context) error {
	tx.done = true
	tx.db.commits++
	return nil
}

func (tx *fakeTx) Rollback(context.Context) error {
	if !tx.done {
		tx.done = true
		tx.db.rollbacks++
	}
	return nil
}

type query struct {
	sql  string
	args []any
}

func (db *fakeDB) Query(_ context.Context, sql string, args ...any) (Rows, error) {
	db.queries = append(db.queries, query{sql, args})
	if db.fail != nil {
		return nil, db.fail
	}
	if db.onSelect != nil && strings.HasPrefix(sql, "SELECT") {
		if rows, ok := db.onSelect(sql, args); ok {
			return &fakeRows{rows: rows}, nil
		}
	}
	if db.onWrite != nil && !strings.HasPrefix(sql, "SELECT") {
		rows, err := db.onWrite(sql, args)
		// As with pgx, a statement's failure comes when its rows end
		return &fakeRows{rows: rows, err: err}, nil
	}
	for table, rows := range db.rows {
		if strings.Contains(sql, " FROM "+quote(table)+" ") || strings.HasSuffix(sql, " FROM "+quote(table)) {
			return &fakeRows{rows: rows, args: args}, nil
		}
	}
	return &fakeRows{}, nil
}

// fakeRows yields the rows whose ref (first string column after
// api_version, or the one named by the query) matches the argument, so one
// registration serves Get, FindBy and ANY($1) alike.
type fakeRows struct {
	rows [][]any
	args []any
	i    int
	cur  []any
	err  error
}

func (r *fakeRows) Next() bool {
	for r.i < len(r.rows) {
		row := r.rows[r.i]
		r.i++
		if r.matches(row) {
			r.cur = row
			return true
		}
	}
	return false
}

// matches keeps a row when no argument filters it, or when any of its
// string columns equals the argument (or is in the argument list).
func (r *fakeRows) matches(row []any) bool {
	if len(r.args) == 0 {
		return true
	}
	switch arg := r.args[0].(type) {
	case string:
		return rowHas(row, arg)
	case []string:
		for _, a := range arg {
			if rowHas(row, a) {
				return true
			}
		}
		return false
	case bool:
		for _, col := range row {
			if b, ok := col.(bool); ok && b == arg {
				return true
			}
		}
		return false
	}
	return true
}

func rowHas(row []any, value string) bool {
	for _, col := range row {
		if s, ok := col.(string); ok && s == value {
			return true
		}
	}
	return false
}

func (r *fakeRows) Scan(dest ...any) error {
	if len(dest) != len(r.cur) {
		return fmt.Errorf("scan: %d destinations for %d columns", len(dest), len(r.cur))
	}
	for i, d := range dest {
		if err := assign(d, r.cur[i]); err != nil {
			return fmt.Errorf("column %d: %w", i, err)
		}
	}
	return nil
}

func (r *fakeRows) Err() error { return r.err }
func (r *fakeRows) Close()     {}

func assign(dest, value any) error {
	switch d := dest.(type) {
	case *string:
		s, ok := value.(string)
		if !ok {
			return fmt.Errorf("want string, got %T", value)
		}
		*d = s
	case **string:
		if value == nil {
			*d = nil
			return nil
		}
		s, ok := value.(string)
		if !ok {
			return fmt.Errorf("want string or nil, got %T", value)
		}
		*d = &s
	case *bool:
		b, ok := value.(bool)
		if !ok {
			return fmt.Errorf("want bool, got %T", value)
		}
		*d = b
	case *int32:
		n, ok := value.(int)
		if !ok {
			return fmt.Errorf("want int, got %T", value)
		}
		*d = int32(n)
	case **int32:
		if value == nil {
			*d = nil
			return nil
		}
		n, ok := value.(int)
		if !ok {
			return fmt.Errorf("want int or nil, got %T", value)
		}
		v := int32(n)
		*d = &v
	case *time.Time:
		t, ok := value.(time.Time)
		if !ok {
			return fmt.Errorf("want time, got %T", value)
		}
		*d = t
	case *[]byte:
		if value == nil {
			*d = nil
			return nil
		}
		s, ok := value.(string)
		if !ok {
			return fmt.Errorf("want JSON string or nil, got %T", value)
		}
		*d = []byte(s)
	case *[]string:
		if value == nil {
			*d = nil
			return nil
		}
		list, ok := value.([]string)
		if !ok {
			return fmt.Errorf("want []string or nil, got %T", value)
		}
		*d = list
	default:
		return fmt.Errorf("unsupported destination %T", dest)
	}
	return nil
}

// prefixCipher adds and strips the "enc:" the fake database stores passwords
// with.
type prefixCipher struct{}

func (prefixCipher) Encrypt(value string) (string, error) { return "enc:" + value, nil }

func (prefixCipher) Decrypt(value string) (string, error) {
	if !strings.HasPrefix(value, "enc:") {
		return "", errors.New("not a ciphertext")
	}
	return strings.TrimPrefix(value, "enc:"), nil
}

var (
	created = time.Date(2026, 11, 6, 12, 0, 0, 500_000_000, time.UTC)
	updated = time.Date(2026, 11, 6, 13, 0, 0, 0, time.UTC)
)

// sampleDB is the Routr 2 schema populated with one of everything, in the
// column order of postgres_rows.go.
func sampleDB() *fakeDB {
	return &fakeDB{rows: map[string][][]any{
		"agents": {
			// api_version, ref, domain_ref, credentials_ref, name, username, privacy, max_contacts, expires, enabled, created_at, updated_at, extended, trace_enabled
			{"v2", "ag1", "d1", "c1", "John Doe", "1001", "ID", -1, 3600, true, created, updated, `{"tier": "gold", "n": 2}`, true},
			{"v2", "ag2", nil, nil, "Jane Doe", "1002", "NONE", 0, 0, false, created, updated, nil, false},
		},
		"peers": {
			// api_version, ref, credentials_ref, acl_ref, name, username, aor, contact_addr, balancing_algorithm, with_session_affinity, max_contacts, expires, enabled, created_at, updated_at, extended, trace_enabled
			{"v2", "p1", "c2", "a1", "Asterisk", "asterisk", "sip:conference@sip.local", "10.0.0.1:5060", "LEAST_SESSIONS", true, -1, 600, true, created, updated, `{"x": 1}`, false},
			{"v2", "p2", nil, nil, "FreeSWITCH", "freeswitch", "sip:voice@sip.local", nil, nil, false, -1, 0, true, created, updated, nil, false},
		},
		"domains": {
			// api_version, ref, acl_ref, name, domain_uri, created_at, updated_at, extended, trace_enabled
			{"v2", "d1", "a1", "Local", "sip.local", created, updated, `{"k": "v"}`, false},
		},
		"trunks": {
			// api_version, ref, acl_ref, inbound_credentials_ref, outbound_credentials_ref, name, send_register, normalize_to_e164, rewrite_from_with_number, from_domain, inbound_uri, created_at, updated_at, extended, trace_enabled
			{"v2", "t1", "a1", "c2", "c2", "Trunk", true, true, false, nil, "trunk01.acme.com", created, updated, nil, false},
		},
		"numbers": {
			// api_version, ref, trunk_ref, tel_url, name, aor_link, city, country, country_iso_code, session_affinity_header, extra_headers, created_at, updated_at, extended
			{"v2", "n1", "t1", "tel:+17066041487", "(706)604-1487", "sip:conference@sip.local", "Columbus, GA", "USA", "US", "X-Room-Id", `[{"name": "X-Room-Id", "value": "jsa"}]`, created, updated, `{"e": true}`},
		},
		"access_control_lists": {
			// api_version, ref, name, allow, deny, created_at, updated_at, extended
			{"v2", "a1", "Europe ACL", []string{"192.168.1.3/31", "127.0.0.1/8"}, []string{"0.0.0.0/1"}, created, updated, `{"region": "eu"}`},
		},
		"credentials": {
			// api_version, ref, name, username, password, created_at, updated_at, extended
			{"v2", "c1", "Agent Credentials", "1001", "enc:1234", created, updated, `{"c": 1}`},
			{"v2", "c2", "Trunk Credentials", "pbx-1", "enc:secret", created, updated, nil},
		},
		"egress_policies": {
			// ref, domain_ref, number_ref, rule
			{"ep1", "d1", "n1", ".*"},
		},
		"trunk_uris": {
			// ref, trunk_ref, host, port, transport, user, weight, priority, enabled
			{"u1", "t1", "sip.provider.net", 7060, "UDP", "pbx-1", 10, 10, true},
			{"u2", "t1", "sip2.provider.net", 5061, "TLS", nil, nil, nil, false},
		},
	}}
}

func newSampleStore(t *testing.T, db *fakeDB) Store {
	t.Helper()
	s, err := NewPostgres(db, PostgresOptions{Cipher: prefixCipher{}})
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestNewPostgresRequiresADatabase(t *testing.T) {
	if _, err := NewPostgres(nil, PostgresOptions{}); err == nil {
		t.Error("nil Querier should fail")
	}
	closed := false
	s, err := NewPostgres(&fakeDB{}, PostgresOptions{Close: func() { closed = true }})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil || !closed {
		t.Error("Close should release the database")
	}
}

func TestPostgresGetAgent(t *testing.T) {
	db := sampleDB()
	s := newSampleStore(t, db)
	msg, err := s.Get(context.Background(), KindAgent, "ag1")
	if err != nil {
		t.Fatal(err)
	}
	agent := msg.(*agents.Agent)

	if agent.GetApiVersion() != "v2" || agent.GetUsername() != "1001" || agent.GetName() != "John Doe" {
		t.Errorf("agent = %v", agent)
	}
	// The stored 'ID' is Prisma's PRIVATE
	if agent.GetPrivacy() != agents.Privacy_PRIVATE || !agent.GetEnabled() || agent.GetMaxContacts() != -1 || agent.GetExpires() != 3600 {
		t.Errorf("agent scalars = %v", agent)
	}
	if !agent.GetTrace().GetEnabled() {
		t.Error("trace_enabled should map to trace.enabled")
	}
	// getTime() / 1000, whole seconds
	if agent.GetCreatedAt() != int32(created.Unix()) || agent.GetUpdatedAt() != int32(updated.Unix()) {
		t.Errorf("timestamps = %d/%d", agent.GetCreatedAt(), agent.GetUpdatedAt())
	}
	if got := agent.GetExtended().AsMap(); got["tier"] != "gold" || got["n"] != float64(2) {
		t.Errorf("extended = %v", got)
	}
	if agent.GetCredentials().GetPassword() != "1234" || agent.GetCredentials().GetUsername() != "1001" {
		t.Errorf("credentials = %v (password must be decrypted)", agent.GetCredentials())
	}
	// A nested resource's extended is an empty Struct on the wire
	if nested := agent.GetCredentials().GetExtended(); nested == nil || len(nested.GetFields()) != 0 {
		t.Errorf("nested extended = %v, want an empty Struct", nested)
	}

	domain := agent.GetDomain()
	if domain.GetDomainUri() != "sip.local" || domain.GetAccessControlList().GetRef() != "a1" {
		t.Fatalf("domain = %v", domain)
	}
	if len(domain.GetAccessControlList().GetAllow()) != 2 || domain.GetAccessControlList().GetDeny()[0] != "0.0.0.0/1" {
		t.Errorf("acl = %v", domain.GetAccessControlList())
	}
	if len(domain.GetEgressPolicies()) != 1 {
		t.Fatalf("egress policies = %v", domain.GetEgressPolicies())
	}
	policy := domain.GetEgressPolicies()[0]
	if policy.GetRule() != ".*" || policy.GetNumberRef() != "n1" || policy.GetNumber().GetTelUrl() != "tel:+17066041487" {
		t.Errorf("policy = %v", policy)
	}
	// Connect routes agent-to-PSTN calls through this trunk
	trunk := policy.GetNumber().GetTrunk()
	if trunk.GetRef() != "t1" || !trunk.GetSendRegister() || trunk.GetInboundUri() != "trunk01.acme.com" {
		t.Fatalf("trunk = %v", trunk)
	}
	if trunk.GetOutboundCredentials().GetPassword() != "secret" || trunk.GetAccessControlList().GetRef() != "a1" {
		t.Errorf("trunk includes = %v", trunk)
	}
	if len(trunk.GetUris()) != 2 || trunk.GetUris()[0].GetUser() != "pbx-1" || trunk.GetUris()[1].GetTransport() != "TLS" || trunk.GetUris()[1].GetWeight() != 0 {
		t.Errorf("uris = %v", trunk.GetUris())
	}

	// One query for the agent, then one per relation, by refs
	if db.queries[0].sql != `SELECT `+agentColumns+` FROM "agents" WHERE ref = $1` || db.queries[0].args[0] != "ag1" {
		t.Errorf("agent query = %v", db.queries[0])
	}
	var anyQueries int
	for _, q := range db.queries[1:] {
		if !strings.Contains(q.sql, "= ANY($1)") {
			t.Errorf("relation query without ANY: %s", q.sql)
		}
		if _, ok := q.args[0].([]string); !ok {
			t.Errorf("relation query args = %v", q.args)
		}
		anyQueries++
	}
	// credentials, domains, acls, egress policies, numbers, trunks, acls,
	// credentials, uris
	if anyQueries != 9 {
		t.Errorf("%d relation queries, want 9: %v", anyQueries, db.queries)
	}
}

func TestPostgresGetAgentWithoutRelations(t *testing.T) {
	s := newSampleStore(t, sampleDB())
	msg, err := s.Get(context.Background(), KindAgent, "ag2")
	if err != nil {
		t.Fatal(err)
	}
	agent := msg.(*agents.Agent)
	if agent.GetDomain() != nil || agent.GetCredentials() != nil || agent.GetExtended() != nil {
		t.Errorf("agent = %v", agent)
	}
	if agent.GetPrivacy() != agents.Privacy_NONE || agent.GetMaxContacts() != 0 || agent.GetTrace() == nil || agent.GetTrace().GetEnabled() {
		t.Errorf("agent = %v", agent)
	}
}

func TestPostgresGetEveryKind(t *testing.T) {
	s := newSampleStore(t, sampleDB())
	ctx := context.Background()

	msg, err := s.Get(ctx, KindPeer, "p1")
	if err != nil {
		t.Fatal(err)
	}
	peer := msg.(*peers.Peer)
	if peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_LEAST_SESSIONS || !peer.GetWithSessionAffinity() || peer.GetContactAddr() != "10.0.0.1:5060" {
		t.Errorf("peer = %v", peer)
	}
	if peer.GetCredentials().GetPassword() != "secret" || peer.GetAccessControlList().GetName() != "Europe ACL" {
		t.Errorf("peer includes = %v", peer)
	}
	msg, err = s.Get(ctx, KindPeer, "p2")
	if err != nil {
		t.Fatal(err)
	}
	peer = msg.(*peers.Peer)
	if peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_UNSPECIFIED || peer.GetContactAddr() != "" || peer.GetCredentials() != nil {
		t.Errorf("peer without relations = %v", peer)
	}

	msg, err = s.Get(ctx, KindDomain, "d1")
	if err != nil {
		t.Fatal(err)
	}
	domain := msg.(*domains.Domain)
	if domain.GetExtended().AsMap()["k"] != "v" || domain.GetTrace() == nil {
		t.Errorf("domain = %v", domain)
	}
	// DomainManager included the policy's number, not its trunk
	if n := domain.GetEgressPolicies()[0].GetNumber(); n.GetRef() != "n1" || n.GetTrunk() != nil {
		t.Errorf("domain egress number = %v, want no trunk", n)
	}

	msg, err = s.Get(ctx, KindNumber, "n1")
	if err != nil {
		t.Fatal(err)
	}
	number := msg.(*numbers.Number)
	if number.GetCity() != "Columbus, GA" || number.GetSessionAffinityHeader() != "X-Room-Id" || number.GetExtended().AsMap()["e"] != true {
		t.Errorf("number = %v", number)
	}
	if len(number.GetExtraHeaders()) != 1 || number.GetExtraHeaders()[0].GetValue() != "jsa" {
		t.Errorf("extra headers = %v", number.GetExtraHeaders())
	}
	if number.GetTrunk().GetRef() != "t1" || len(number.GetTrunk().GetUris()) != 2 {
		t.Errorf("number trunk = %v", number.GetTrunk())
	}

	msg, err = s.Get(ctx, KindTrunk, "t1")
	if err != nil {
		t.Fatal(err)
	}
	trunk := msg.(*trunks.Trunk)
	if !trunk.GetNormalizeToE164() || trunk.GetRewriteFromWithNumber() || trunk.GetFromDomain() != "" || trunk.GetExtended() != nil {
		t.Errorf("trunk = %v", trunk)
	}
	if trunk.GetInboundCredentials().GetRef() != "c2" || trunk.GetOutboundCredentials().GetRef() != "c2" {
		t.Errorf("trunk credentials = %v", trunk)
	}

	msg, err = s.Get(ctx, KindCredentials, "c1")
	if err != nil {
		t.Fatal(err)
	}
	creds := msg.(*credentials.Credentials)
	if creds.GetPassword() != "1234" || creds.GetExtended().AsMap()["c"] != float64(1) {
		t.Errorf("credentials = %v", creds)
	}

	msg, err = s.Get(ctx, KindACL, "a1")
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.(*acl.AccessControlList); got.GetExtended().AsMap()["region"] != "eu" || len(got.GetAllow()) != 2 {
		t.Errorf("acl = %v", got)
	}
}

func TestPostgresGetNotFound(t *testing.T) {
	s := newSampleStore(t, sampleDB())
	_, err := s.Get(context.Background(), KindAgent, "nope")
	var notFound *NotFoundError
	if !errors.As(err, &notFound) || notFound.Ref != "nope" {
		t.Errorf("err = %v", err)
	}
	if _, err := s.Get(context.Background(), Kind("bogus"), "x"); err == nil {
		t.Error("unknown kind should fail")
	}
}

func TestPostgresQueryErrors(t *testing.T) {
	db := sampleDB()
	db.fail = &net.OpError{Op: "dial", Net: "tcp", Err: syscall.ECONNREFUSED}
	s := newSampleStore(t, db)
	_, err := s.Get(context.Background(), KindAgent, "ag1")
	var store *StoreError
	if !errors.As(err, &store) || !store.Unavailable || !strings.Contains(err.Error(), "connection refused") || !strings.Contains(err.Error(), `FROM "agents"`) {
		t.Errorf("err = %v, want an unavailable StoreError naming the query", err)
	}
	if _, err := s.List(context.Background(), KindACL, Page{Size: 1}); !errors.As(err, &store) {
		t.Errorf("List = %v, want a StoreError", err)
	}
	if _, err := s.FindBy(context.Background(), KindACL, "name", "x"); !errors.As(err, &store) {
		t.Errorf("FindBy = %v, want a StoreError", err)
	}

	// A query the database refused: the database is there
	db.fail = &pgconn.PgError{Code: "42703", Message: `column "x" does not exist`}
	if _, err := s.Get(context.Background(), KindAgent, "ag1"); !errors.As(err, &store) || store.Unavailable {
		t.Errorf("err = %v, want a StoreError that is not unavailable", err)
	}

	// A table the database does not have yet: the migrations have not run
	db.fail = &pgconn.PgError{Code: "42P01", Message: `relation "agents" does not exist`}
	if _, err := s.Get(context.Background(), KindAgent, "ag1"); !errors.As(err, &store) || !store.Unavailable {
		t.Errorf("err = %v, want an unavailable StoreError", err)
	}
}

func TestIsUnavailable(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"connection refused", &net.OpError{Op: "dial", Net: "tcp", Err: syscall.ECONNREFUSED}, true},
		{"wrapped network error", fmt.Errorf("query x: %w", &net.OpError{Op: "read", Err: syscall.ECONNRESET}), true},
		{"connection dropped", io.ErrUnexpectedEOF, true},
		{"server shutting down", &pgconn.PgError{Code: "57P01"}, true},
		{"connection failure", &pgconn.PgError{Code: "08006"}, true},
		{"too many connections", &pgconn.PgError{Code: "53300"}, true},
		{"undefined table", &pgconn.PgError{Code: "42P01"}, true},
		{"wrapped undefined table", fmt.Errorf("query x: %w", &pgconn.PgError{Code: "42P01"}), true},
		{"undefined column", &pgconn.PgError{Code: "42703"}, false},
		{"bad row", errors.New("invalid extended"), false},
		{"nil", nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isUnavailable(tt.err); got != tt.want {
				t.Errorf("isUnavailable(%v) = %v, want %v", tt.err, got, tt.want)
			}
		})
	}
}

func TestPostgresDecryptFailure(t *testing.T) {
	ctx := context.Background()
	db := sampleDB()
	db.rows["credentials"][0][4] = "plain"
	db.onWrite = func(sql string, args []any) ([][]any, error) { return [][]any{{args[0]}}, nil }
	var logged bytes.Buffer
	s, err := NewPostgres(db, PostgresOptions{Cipher: prefixCipher{}, Logger: slog.New(slog.NewTextHandler(&logged, nil))})
	if err != nil {
		t.Fatal(err)
	}
	// A password the key cannot open is served as stored and logged by its ref
	msg, err := s.Get(ctx, KindCredentials, "c1")
	if err != nil || msg.(*credentials.Credentials).GetPassword() != "plain" {
		t.Errorf("read = %v, %v", msg, err)
	}
	if got := logged.String(); !strings.Contains(got, "ref=c1") || strings.Contains(got, "plain") {
		t.Errorf("log = %q, want the ref and not the value", got)
	}
	// and fails neither the write that reads it back nor the transaction
	name := "Renamed"
	msg, err = s.(Writer).Update(ctx, &credentials.UpdateCredentialsRequest{Ref: "c1", Name: &name})
	if err != nil || msg.(*credentials.Credentials).GetPassword() != "plain" {
		t.Errorf("update = %v, %v", msg, err)
	}
	if db.commits != 1 || db.rollbacks != 0 {
		t.Errorf("commits = %d, rollbacks = %d", db.commits, db.rollbacks)
	}
	// The identity cipher serves what is stored
	s, _ = NewPostgres(db, PostgresOptions{})
	msg, err = s.Get(ctx, KindCredentials, "c1")
	if err != nil || msg.(*credentials.Credentials).GetPassword() != "plain" {
		t.Errorf("identity: %v, %v", msg, err)
	}
}

func TestPostgresBadJSONColumns(t *testing.T) {
	db := sampleDB()
	db.rows["numbers"][0][10] = `{"not": "a list"}`
	s := newSampleStore(t, db)
	if _, err := s.Get(context.Background(), KindNumber, "n1"); err == nil || !strings.Contains(err.Error(), "extra_headers") {
		t.Errorf("err = %v", err)
	}
	db = sampleDB()
	db.rows["agents"][0][12] = `[1, 2]`
	s = newSampleStore(t, db)
	if _, err := s.Get(context.Background(), KindAgent, "ag1"); err == nil || !strings.Contains(err.Error(), "extended") {
		t.Errorf("err = %v", err)
	}
}

func TestPostgresFindBy(t *testing.T) {
	db := sampleDB()
	s := newSampleStore(t, db)
	ctx := context.Background()

	items, err := s.FindBy(ctx, KindTrunk, "sendRegister", "true")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || refOf(items[0]) != "t1" {
		t.Errorf("items = %v", items)
	}
	q := db.queries[0]
	if q.sql != `SELECT `+trunkColumns+` FROM "trunks" WHERE "send_register" = $1` || q.args[0] != true {
		t.Errorf("query = %v", q)
	}

	items, err = s.FindBy(ctx, KindAgent, "username", "1002")
	if err != nil || len(items) != 1 || refOf(items[0]) != "ag2" {
		t.Errorf("by username: %v, %v", items, err)
	}
	items, err = s.FindBy(ctx, KindAgent, "username", "9999")
	if err != nil || len(items) != 0 {
		t.Errorf("no match: %v, %v", items, err)
	}
}

func TestFindByArg(t *testing.T) {
	tests := []struct {
		kind  Kind
		field string
		value string
		col   string
		arg   any
		fails bool
	}{
		{KindAgent, "username", "1001", "username", "1001", false},
		{KindAgent, "domainRef", "d1", "domain_ref", "d1", false},
		{KindAgent, "enabled", "true", "enabled", true, false},
		{KindAgent, "enabled", "false", "enabled", false, false},
		{KindAgent, "enabled", "yes", "", nil, true},
		{KindAgent, "privacy", "PRIVATE", "privacy", "ID", false},
		{KindAgent, "privacy", "NONE", "privacy", "NONE", false},
		{KindAgent, "privacy", "ID", "", nil, true},
		{KindAgent, "apiVersion", "v2", "api_version", "v2", false},
		{KindAgent, "apiVersion", "v3", "", nil, true},
		{KindPeer, "balancingAlgorithm", "ROUND_ROBIN", "balancing_algorithm", "ROUND_ROBIN", false},
		{KindPeer, "balancingAlgorithm", "RANDOM", "", nil, true},
		{KindAgent, "maxContacts", "1", "", nil, true},
		{KindAgent, "domain", "x", "", nil, true},
		{KindPeer, "aor", "sip:a@b", "aor", "sip:a@b", false},
		{KindPeer, "accessControlListRef", "a1", "acl_ref", "a1", false},
		{KindDomain, "domainUri", "sip.local", "domain_uri", "sip.local", false},
		{KindNumber, "telUrl", "tel:+1", "tel_url", "tel:+1", false},
		{KindTrunk, "inboundUri", "h", "inbound_uri", "h", false},
		{KindTrunk, "sendRegister", "true", "send_register", true, false},
		{KindCredentials, "username", "u", "username", "u", false},
		{KindACL, "name", "n", "name", "n", false},
		{Kind("bogus"), "name", "n", "", nil, true},
	}
	for _, tt := range tests {
		col, arg, err := findByArg(tt.kind, tt.field, tt.value)
		if tt.fails {
			if err == nil {
				t.Errorf("findByArg(%s, %s, %s) should fail", tt.kind, tt.field, tt.value)
			}
			continue
		}
		if err != nil || col != tt.col || !reflect.DeepEqual(arg, tt.arg) {
			t.Errorf("findByArg(%s, %s, %s) = %s, %v, %v; want %s, %v", tt.kind, tt.field, tt.value, col, arg, err, tt.col, tt.arg)
		}
	}
}

func TestFindByInvalidValuesAreBadRequests(t *testing.T) {
	for _, tt := range []struct {
		kind         Kind
		field, value string
	}{
		{KindAgent, "privacy", "ID"},
		{KindAgent, "enabled", "yes"},
		{KindAgent, "apiVersion", "v3"},
		{KindPeer, "balancingAlgorithm", "RANDOM"},
	} {
		_, _, err := findByArg(tt.kind, tt.field, tt.value)
		var bad *BadRequestError
		if !errors.As(err, &bad) {
			t.Errorf("findByArg(%s, %s, %s) = %v, want a BadRequestError", tt.kind, tt.field, tt.value, err)
		}
	}
	// A field that is no column stays the failure Prisma raised
	_, _, err := findByArg(KindAgent, "domain", "x")
	var bad *BadRequestError
	if err == nil || errors.As(err, &bad) {
		t.Errorf("findByArg(agent, domain) = %v, want an error that is not a bad request", err)
	}
}

func TestListQuery(t *testing.T) {
	tests := []struct {
		page Page
		sql  string
		args []any
	}{
		{Page{Size: 50}, `SELECT c FROM "agents" ORDER BY created_at DESC, ref DESC LIMIT $1`, []any{int64(50)}},
		{Page{Size: 50, Token: "ag1"}, `SELECT c FROM "agents" WHERE (created_at, ref) < (SELECT created_at, ref FROM "agents" WHERE ref = $1) ORDER BY created_at DESC, ref DESC LIMIT $2`, []any{"ag1", int64(50)}},
		{Page{Size: -2}, `SELECT c FROM (SELECT c FROM "agents" ORDER BY created_at ASC, ref ASC LIMIT $1) AS page ORDER BY created_at DESC, ref DESC`, []any{int64(2)}},
		{Page{Size: -2, Token: "ag1"}, `SELECT c FROM (SELECT c FROM "agents" WHERE (created_at, ref) > (SELECT created_at, ref FROM "agents" WHERE ref = $1) ORDER BY created_at ASC, ref ASC LIMIT $2) AS page ORDER BY created_at DESC, ref DESC`, []any{"ag1", int64(2)}},
	}
	for _, tt := range tests {
		sql, args := listQuery("c", "agents", tt.page)
		if sql != tt.sql || !reflect.DeepEqual(args, tt.args) {
			t.Errorf("listQuery(%+v) = %q, %v; want %q, %v", tt.page, sql, args, tt.sql, tt.args)
		}
	}
}

func TestPostgresList(t *testing.T) {
	db := sampleDB()
	s := newSampleStore(t, db)
	items, err := s.List(context.Background(), KindAgent, Page{Size: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Errorf("items = %v", items)
	}
	if !strings.HasSuffix(db.queries[0].sql, "LIMIT $1") || db.queries[0].args[0] != int64(10) {
		t.Errorf("query = %v", db.queries[0])
	}
	if _, err := s.List(context.Background(), Kind("bogus"), Page{}); err == nil {
		t.Error("unknown kind should fail")
	}
}

func TestPostgresListSizeZeroHasNoLimit(t *testing.T) {
	sql, args := listQuery("c", "agents", Page{})
	if strings.Contains(sql, "LIMIT") || len(args) != 0 {
		t.Errorf("listQuery(size 0) = %q, %v; want no LIMIT", sql, args)
	}
	sql, args = listQuery("c", "agents", Page{Token: "a"})
	if strings.Contains(sql, "LIMIT") || !reflect.DeepEqual(args, []any{"a"}) {
		t.Errorf("listQuery(size 0, token) = %q, %v; want no LIMIT, after the token", sql, args)
	}
}

func TestExtendedOf(t *testing.T) {
	if s, err := extendedOf(nil, true); s != nil || err != nil {
		t.Errorf("NULL = %v, %v", s, err)
	}
	if s, err := extendedOf([]byte("null"), true); s != nil || err != nil {
		t.Errorf("json null = %v, %v", s, err)
	}
	s, err := extendedOf([]byte(`{"a": "b", "n": [1, 2]}`), true)
	if err != nil || s.AsMap()["a"] != "b" || len(s.AsMap()["n"].([]any)) != 2 {
		t.Errorf("object = %v, %v", s, err)
	}
	if _, err := extendedOf([]byte(`"scalar"`), true); err == nil {
		t.Error("a non-object should fail")
	}
	s, err = extendedOf([]byte(`{"a": "b"}`), false)
	if err != nil || s == nil || len(s.GetFields()) != 0 {
		t.Errorf("nested = %v, %v; want an empty Struct", s, err)
	}
}

func TestExtraHeadersOf(t *testing.T) {
	if h, err := extraHeadersOf(nil); h != nil || err != nil {
		t.Errorf("NULL = %v, %v", h, err)
	}
	h, err := extraHeadersOf([]byte(`[{"name": "X-A", "value": "1"}, {"name": "X-B", "value": "2"}]`))
	if err != nil || len(h) != 2 || h[1].GetName() != "X-B" {
		t.Errorf("list = %v, %v", h, err)
	}
	if _, err := extraHeadersOf([]byte(`{"name": "X-A"}`)); err == nil {
		t.Error("an object should fail")
	}
}

func TestColumnMappers(t *testing.T) {
	if privacyOfColumn("ID") != agents.Privacy_PRIVATE || privacyOfColumn("NONE") != agents.Privacy_NONE {
		t.Error("privacy")
	}
	rr := "ROUND_ROBIN"
	bogus := "RANDOM"
	if balancingAlgorithmOfColumn(nil) != peers.LoadBalancingAlgorithm_UNSPECIFIED ||
		balancingAlgorithmOfColumn(&rr) != peers.LoadBalancingAlgorithm_ROUND_ROBIN ||
		balancingAlgorithmOfColumn(&bogus) != peers.LoadBalancingAlgorithm_UNSPECIFIED {
		t.Error("balancing algorithm")
	}
	// The fraction of a second goes, as it did in getTime() / 1000 | 0
	if seconds(created) != int32(created.Unix()) || created.Nanosecond() == 0 {
		t.Errorf("seconds = %d", seconds(created))
	}
	if columnsOf(Kind("bogus")) != "" {
		t.Error("unknown kind has no columns")
	}
}
