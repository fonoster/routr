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
	"io"
	"net"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"google.golang.org/protobuf/proto"
)

// Querier is what the postgres backend needs from a database: a query that
// yields rows. It is the shape of pgx v5's Query; *pgxpool.Pool satisfies it
// through PgxQuerier (postgres_pgx.go), and the tests use a fake.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (Rows, error)
}

// Rows is the part of pgx.Rows the backend reads.
type Rows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
	Close()
}

// PostgresOptions tunes the postgres backend.
type PostgresOptions struct {
	// Cipher decrypts Credentials.password; nil means Identity (no
	// CLOAK_ENCRYPTION_KEY in Routr 2's terms)
	Cipher Cipher
	// Close releases the database when the Store closes; nil means nothing to
	// release
	Close func()
}

// postgresStore serves the Routr 2 schema (mods/pgdata/schema.prisma on
// main) with the query shapes @routr/pgdata had through Prisma: one query
// for the kind's rows, then one query per included relation, by refs. Each
// read is a bounded number of queries, never one per row.
type postgresStore struct {
	db     Querier
	cipher Cipher
	close  func()
}

// NewPostgres builds the postgres backend over a Querier.
func NewPostgres(db Querier, opts PostgresOptions) (Store, error) {
	if db == nil {
		return nil, fmt.Errorf("data: a database is required")
	}
	cipher := opts.Cipher
	if cipher == nil {
		cipher = Identity{}
	}
	return &postgresStore{db: db, cipher: cipher, close: opts.Close}, nil
}

// table names a kind's table and the column of each FindBy field, as
// Prisma's model named the fields (the scalar fields a where clause took).
type table struct {
	name   string
	fields map[string]column
}

// column is one FindBy-able column and how its value is typed.
type column struct {
	name string
	kind columnKind
}

type columnKind int

const (
	textColumn columnKind = iota
	boolColumn
	privacyColumn
)

var tables = map[Kind]table{
	KindAgent: {"agents", map[string]column{
		"apiVersion": {"api_version", textColumn}, "ref": {"ref", textColumn},
		"domainRef": {"domain_ref", textColumn}, "credentialsRef": {"credentials_ref", textColumn},
		"name": {"name", textColumn}, "username": {"username", textColumn},
		"privacy": {"privacy", privacyColumn}, "enabled": {"enabled", boolColumn},
		"traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindPeer: {"peers", map[string]column{
		"apiVersion": {"api_version", textColumn}, "ref": {"ref", textColumn},
		"credentialsRef": {"credentials_ref", textColumn}, "accessControlListRef": {"acl_ref", textColumn},
		"name": {"name", textColumn}, "username": {"username", textColumn}, "aor": {"aor", textColumn},
		"contactAddr": {"contact_addr", textColumn}, "balancingAlgorithm": {"balancing_algorithm", textColumn},
		"withSessionAffinity": {"with_session_affinity", boolColumn}, "enabled": {"enabled", boolColumn},
		"traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindDomain: {"domains", map[string]column{
		"apiVersion": {"api_version", textColumn}, "ref": {"ref", textColumn},
		"accessControlListRef": {"acl_ref", textColumn}, "name": {"name", textColumn},
		"domainUri": {"domain_uri", textColumn}, "traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindTrunk: {"trunks", map[string]column{
		"apiVersion": {"api_version", textColumn}, "ref": {"ref", textColumn},
		"accessControlListRef": {"acl_ref", textColumn}, "inboundCredentialsRef": {"inbound_credentials_ref", textColumn},
		"outboundCredentialsRef": {"outbound_credentials_ref", textColumn}, "name": {"name", textColumn},
		"sendRegister": {"send_register", boolColumn}, "normalizeToE164": {"normalize_to_e164", boolColumn},
		"rewriteFromWithNumber": {"rewrite_from_with_number", boolColumn}, "fromDomain": {"from_domain", textColumn},
		"inboundUri": {"inbound_uri", textColumn}, "traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindNumber: {"numbers", map[string]column{
		"apiVersion": {"api_version", textColumn}, "ref": {"ref", textColumn}, "trunkRef": {"trunk_ref", textColumn},
		"telUrl": {"tel_url", textColumn}, "name": {"name", textColumn}, "aorLink": {"aor_link", textColumn},
		"city": {"city", textColumn}, "country": {"country", textColumn}, "countryIsoCode": {"country_iso_code", textColumn},
		"sessionAffinityHeader": {"session_affinity_header", textColumn},
	}},
	KindCredentials: {"credentials", map[string]column{
		"apiVersion": {"api_version", textColumn}, "ref": {"ref", textColumn},
		"name": {"name", textColumn}, "username": {"username", textColumn},
	}},
	KindACL: {"access_control_lists", map[string]column{
		"apiVersion": {"api_version", textColumn}, "ref": {"ref", textColumn}, "name": {"name", textColumn},
	}},
}

// findByArg types the FindBy value for its column: the strings "true" and
// "false" become booleans for a boolean column (pgdata's workaround for
// Prisma), the privacy enum names become the stored values, anything else
// stays text. A value the column cannot take is the error Prisma raised.
func findByArg(kind Kind, field, value string) (string, any, error) {
	t, ok := tables[kind]
	if !ok {
		return "", nil, fmt.Errorf("unknown kind %q", kind)
	}
	col, ok := t.fields[field]
	if !ok {
		return "", nil, fmt.Errorf("unknown field %q for %s", field, kind)
	}
	switch col.kind {
	case boolColumn:
		b, err := strconv.ParseBool(value)
		if err != nil || (value != "true" && value != "false") {
			return "", nil, fmt.Errorf("field %q of %s takes true or false, not %q", field, kind, value)
		}
		return col.name, b, nil
	case privacyColumn:
		switch value {
		case "PRIVATE":
			return col.name, "ID", nil
		case "NONE":
			return col.name, "NONE", nil
		}
		return "", nil, fmt.Errorf("field %q of %s takes PRIVATE or NONE, not %q", field, kind, value)
	}
	return col.name, value, nil
}

// listQuery builds the List query: newest first, the ref breaking ties so
// a page is deterministic, after the cursor when there is one, limited when
// the page has a size. Prisma's cursor on a non-unique createdAt left the
// order among equal timestamps to the database.
func listQuery(cols, tableName string, page Page) (string, []any) {
	sql := "SELECT " + cols + " FROM " + quote(tableName)
	var args []any
	if page.Token != "" {
		sql += " WHERE (created_at, ref) < (SELECT created_at, ref FROM " + quote(tableName) + " WHERE ref = $1)"
		args = append(args, page.Token)
	}
	sql += " ORDER BY created_at DESC, ref DESC"
	if page.Size > 0 {
		args = append(args, int64(page.Size))
		sql += " LIMIT $" + strconv.Itoa(len(args))
	}
	return sql, args
}

func quote(ident string) string { return `"` + ident + `"` }

// Get answers the row with the ref and what its kind includes.
func (s *postgresStore) Get(ctx context.Context, kind Kind, ref string) (proto.Message, error) {
	t, ok := tables[kind]
	if !ok {
		return nil, fmt.Errorf("unknown kind %q", kind)
	}
	l := &pgLoader{ctx: ctx, s: s}
	items, err := l.load(kind, "SELECT "+columnsOf(kind)+" FROM "+quote(t.name)+" WHERE ref = $1", ref)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, &NotFoundError{Ref: ref}
	}
	return items[0], nil
}

// FindBy answers every row whose column equals the value.
func (s *postgresStore) FindBy(ctx context.Context, kind Kind, field, value string) ([]proto.Message, error) {
	col, arg, err := findByArg(kind, field, value)
	if err != nil {
		return nil, err
	}
	l := &pgLoader{ctx: ctx, s: s}
	return l.load(kind, "SELECT "+columnsOf(kind)+" FROM "+quote(tables[kind].name)+" WHERE "+quote(col)+" = $1", arg)
}

// List answers one page, newest first.
func (s *postgresStore) List(ctx context.Context, kind Kind, page Page) ([]proto.Message, error) {
	t, ok := tables[kind]
	if !ok {
		return nil, fmt.Errorf("unknown kind %q", kind)
	}
	sql, args := listQuery(columnsOf(kind), t.name, page)
	l := &pgLoader{ctx: ctx, s: s}
	return l.load(kind, sql, args...)
}

// Close releases the database.
func (s *postgresStore) Close() error {
	if s.close != nil {
		s.close()
	}
	return nil
}

// queryAll runs a query and scans every row. A failure is a StoreError: its
// text names the query for the log, and it tells whether the database was
// reachable at all.
func queryAll[R any](ctx context.Context, db Querier, sql string, scan func(Rows) (R, error), args ...any) ([]R, error) {
	rows, err := db.Query(ctx, sql, args...)
	if err != nil {
		return nil, storeError(fmt.Errorf("query %s: %w", sql, err))
	}
	defer rows.Close()
	var out []R
	for rows.Next() {
		r, err := scan(rows)
		if err != nil {
			return nil, storeError(fmt.Errorf("scan %s: %w", sql, err))
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, storeError(fmt.Errorf("read %s: %w", sql, err))
	}
	return out, nil
}

// storeError wraps a database failure as a StoreError.
func storeError(err error) error {
	return &StoreError{Unavailable: isUnavailable(err), Err: err}
}

// isUnavailable tells whether an error means the database could not be
// reached: a failed connection, a network error, a connection that dropped
// mid-read, or a server-side connection exception (SQLSTATE class 08),
// operator intervention such as a shutdown (57P) or exhausted resources
// such as too many connections (53). A query the database refused is not
// one: the database answered.
func isUnavailable(err error) bool {
	var connErr *pgconn.ConnectError
	if errors.As(err, &connErr) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return strings.HasPrefix(pgErr.Code, "08") || strings.HasPrefix(pgErr.Code, "57P") || strings.HasPrefix(pgErr.Code, "53")
	}
	return false
}
