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
	"log/slog"
	"net"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"google.golang.org/protobuf/proto"
)

// Querier runs a query that yields rows, on the pool or in a transaction. It
// is the shape of pgx v5's Query.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (Rows, error)
}

// Tx is an open transaction: writes and the read of their result share it.
type Tx interface {
	Querier
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
}

// Database is what the postgres backend needs from a database. *pgxpool.Pool
// satisfies it through PgxQuerier (postgres_pgx.go), and the tests use a fake.
type Database interface {
	Querier
	Begin(ctx context.Context) (Tx, error)
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
	// Cipher encrypts and decrypts Credentials.password; nil means Identity
	// (no CLOAK_ENCRYPTION_KEY in Routr 2's terms)
	Cipher Cipher
	// Logger receives a password it could not decrypt and the plain text
	// warning; nil means slog.Default()
	Logger *slog.Logger
	// Close releases the database when the Store closes; nil means nothing to
	// release
	Close func()
}

// postgresStore serves the Routr 2 schema (mods/pgdata/schema.prisma on
// main) with the query shapes @routr/pgdata had through Prisma: one query
// for the kind's rows, then one query per included relation, by refs. Each
// read is a bounded number of queries, never one per row.
type postgresStore struct {
	db     Database
	cipher Cipher
	log    *slog.Logger
	close  func()
}

// NewPostgres builds the postgres backend over a Database. The Store it
// returns is a Writer too.
func NewPostgres(db Database, opts PostgresOptions) (Store, error) {
	if db == nil {
		return nil, fmt.Errorf("data: a database is required")
	}
	cipher := opts.Cipher
	if cipher == nil {
		cipher = Identity{}
	}
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	return &postgresStore{db: db, cipher: cipher, log: log, close: opts.Close}, nil
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
	apiVersionColumn
	balancingColumn
)

var tables = map[Kind]table{
	KindAgent: {"agents", map[string]column{
		"apiVersion": {"api_version", apiVersionColumn}, "ref": {"ref", textColumn},
		"domainRef": {"domain_ref", textColumn}, "credentialsRef": {"credentials_ref", textColumn},
		"name": {"name", textColumn}, "username": {"username", textColumn},
		"privacy": {"privacy", privacyColumn}, "enabled": {"enabled", boolColumn},
		"traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindPeer: {"peers", map[string]column{
		"apiVersion": {"api_version", apiVersionColumn}, "ref": {"ref", textColumn},
		"credentialsRef": {"credentials_ref", textColumn}, "accessControlListRef": {"acl_ref", textColumn},
		"name": {"name", textColumn}, "username": {"username", textColumn}, "aor": {"aor", textColumn},
		"contactAddr": {"contact_addr", textColumn}, "balancingAlgorithm": {"balancing_algorithm", balancingColumn},
		"withSessionAffinity": {"with_session_affinity", boolColumn}, "enabled": {"enabled", boolColumn},
		"traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindDomain: {"domains", map[string]column{
		"apiVersion": {"api_version", apiVersionColumn}, "ref": {"ref", textColumn},
		"accessControlListRef": {"acl_ref", textColumn}, "name": {"name", textColumn},
		"domainUri": {"domain_uri", textColumn}, "traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindTrunk: {"trunks", map[string]column{
		"apiVersion": {"api_version", apiVersionColumn}, "ref": {"ref", textColumn},
		"accessControlListRef": {"acl_ref", textColumn}, "inboundCredentialsRef": {"inbound_credentials_ref", textColumn},
		"outboundCredentialsRef": {"outbound_credentials_ref", textColumn}, "name": {"name", textColumn},
		"sendRegister": {"send_register", boolColumn}, "normalizeToE164": {"normalize_to_e164", boolColumn},
		"rewriteFromWithNumber": {"rewrite_from_with_number", boolColumn}, "fromDomain": {"from_domain", textColumn},
		"inboundUri": {"inbound_uri", textColumn}, "traceEnabled": {"trace_enabled", boolColumn},
	}},
	KindNumber: {"numbers", map[string]column{
		"apiVersion": {"api_version", apiVersionColumn}, "ref": {"ref", textColumn}, "trunkRef": {"trunk_ref", textColumn},
		"telUrl": {"tel_url", textColumn}, "name": {"name", textColumn}, "aorLink": {"aor_link", textColumn},
		"city": {"city", textColumn}, "country": {"country", textColumn}, "countryIsoCode": {"country_iso_code", textColumn},
		"sessionAffinityHeader": {"session_affinity_header", textColumn},
	}},
	KindCredentials: {"credentials", map[string]column{
		"apiVersion": {"api_version", apiVersionColumn}, "ref": {"ref", textColumn},
		"name": {"name", textColumn}, "username": {"username", textColumn},
	}},
	KindACL: {"access_control_lists", map[string]column{
		"apiVersion": {"api_version", apiVersionColumn}, "ref": {"ref", textColumn}, "name": {"name", textColumn},
	}},
}

// findByArg types the FindBy value for its column: the strings "true" and
// "false" become booleans for a boolean column (pgdata's workaround for
// Prisma), the privacy enum names become the stored values, anything else
// stays text. A value the column cannot take is a bad request, which the
// database would only answer with an error; a field that is no column is the
// error Prisma raised.
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
		if value != "true" && value != "false" {
			return "", nil, quotedValue(field, kind, "true or false", value)
		}
		return col.name, value == "true", nil
	case privacyColumn:
		switch value {
		case "PRIVATE":
			return col.name, "ID", nil
		case "NONE":
			return col.name, "NONE", nil
		}
		return "", nil, quotedValue(field, kind, "PRIVATE or NONE", value)
	case apiVersionColumn:
		if value != "v2beta1" && value != "v2" {
			return "", nil, quotedValue(field, kind, "v2beta1 or v2", value)
		}
	case balancingColumn:
		if value != "ROUND_ROBIN" && value != "LEAST_SESSIONS" {
			return "", nil, quotedValue(field, kind, "ROUND_ROBIN or LEAST_SESSIONS", value)
		}
	}
	return col.name, value, nil
}

// listQuery builds the List query of a page: newest first, the ref breaking
// ties so a page is deterministic, after the cursor when there is one. A size
// of 0 has no LIMIT. A negative size reads Prisma's negative take: that many items walking
// back from the cursor (or from the end), still answered newest first.
// Prisma's cursor on a non-unique createdAt left the order among equal
// timestamps to the database.
func listQuery(cols, tableName string, page Page) (string, []any) {
	const newestFirst = " ORDER BY created_at DESC, ref DESC"
	sql := "SELECT " + cols + " FROM " + quote(tableName)
	var args []any
	if page.Token != "" {
		compare := " < "
		if page.Size < 0 {
			compare = " > "
		}
		sql += " WHERE (created_at, ref)" + compare + "(SELECT created_at, ref FROM " + quote(tableName) + " WHERE ref = $1)"
		args = append(args, page.Token)
	}
	if page.Size < 0 {
		args = append(args, -int64(page.Size))
		sql += " ORDER BY created_at ASC, ref ASC LIMIT $" + strconv.Itoa(len(args))
		return "SELECT " + cols + " FROM (" + sql + ") AS page" + newestFirst, args
	}
	if page.Size == 0 {
		return sql + newestFirst, args
	}
	args = append(args, int64(page.Size))
	return sql + newestFirst + " LIMIT $" + strconv.Itoa(len(args)), args
}

func quote(ident string) string { return `"` + ident + `"` }

// Get answers the row with the ref and what its kind includes.
func (s *postgresStore) Get(ctx context.Context, kind Kind, ref string) (proto.Message, error) {
	return s.getFrom(ctx, s.db, kind, ref)
}

// getFrom is Get on the pool or in a transaction.
func (s *postgresStore) getFrom(ctx context.Context, q Querier, kind Kind, ref string) (proto.Message, error) {
	t, ok := tables[kind]
	if !ok {
		return nil, fmt.Errorf("unknown kind %q", kind)
	}
	l := &pgLoader{ctx: ctx, s: s, q: q}
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
	l := &pgLoader{ctx: ctx, s: s, q: s.db}
	return l.load(kind, "SELECT "+columnsOf(kind)+" FROM "+quote(tables[kind].name)+" WHERE "+quote(col)+" = $1", arg)
}

// List answers one page, newest first; a size of 0 is no limit, whether the
// client sent 0 or left pageSize out (see Page).
func (s *postgresStore) List(ctx context.Context, kind Kind, page Page) ([]proto.Message, error) {
	t, ok := tables[kind]
	if !ok {
		return nil, fmt.Errorf("unknown kind %q", kind)
	}
	sql, args := listQuery(columnsOf(kind), t.name, page)
	l := &pgLoader{ctx: ctx, s: s, q: s.db}
	return l.load(kind, sql, args...)
}

// undefinedTable is the SQLSTATE of a table the database does not have.
const undefinedTable = "42P01"

// refuseCloakedPasswords runs at startup with no encryption key. Passwords
// cloaked by an earlier key would be served as they are stored and every digest
// checked against them would fail, so a database holding one is refused. With
// none, passwords are stored in plain text, which is logged as a warning. A
// database not migrated yet has no passwords to protect; any other failure of
// the check refuses to start, since nothing was checked.
func (s *postgresStore) refuseCloakedPasswords(ctx context.Context) error {
	const sql = `SELECT 1 FROM "credentials" WHERE password LIKE 'v1.aesgcm256.%' LIMIT 1`
	found, err := queryAll(ctx, s.db, sql, func(Rows) (struct{}, error) { return struct{}{}, nil })
	if err != nil && !isNotMigrated(err) {
		return fmt.Errorf("spec.data.url: checking the stored passwords: %w", err)
	}
	if len(found) > 0 {
		return errors.New("spec.data.encryptionKey: is empty, but the database holds encrypted passwords; set the key they were written with")
	}
	s.log.Warn("spec.data.encryptionKey is empty: passwords are stored in plain text")
	return nil
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
// such as too many connections (53), or a table it does not have yet
// (42P01): a database the migrations have not reached answers as one that is
// not up, and the client retries. Any other query the database refused is not
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
	if isNotMigrated(err) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return strings.HasPrefix(pgErr.Code, "08") || strings.HasPrefix(pgErr.Code, "57P") || strings.HasPrefix(pgErr.Code, "53")
	}
	return false
}

// isNotMigrated tells whether the database refused a query for a table it
// does not have: the migrations have not run yet.
func isNotMigrated(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == undefinedTable
}
