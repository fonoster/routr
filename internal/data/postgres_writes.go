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
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

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

// apiVersion is what pgdata's mappers stamped on every row they wrote.
const apiVersion = "v2"

// rollbackTimeout bounds the rollback of a failed write, which runs even when
// the request's context is done.
const rollbackTimeout = 5 * time.Second

// columnValue is one column a write sets.
type columnValue struct {
	col string
	val any
}

// rowWrite is what a Create or Update request writes: the columns of the
// kind's row and, when the request carries them, the child rows that replace
// the stored ones (a Trunk's URIs, a Domain's egress policies).
type rowWrite struct {
	kind     Kind
	ref      string
	columns  []columnValue
	children *childRows
}

// childRows are rows of a child table; each gets a generated ref and its
// owner's ref ahead of the values.
type childRows struct {
	table   string
	owner   string
	columns []string
	rows    [][]any
}

func newRowWrite(kind Kind, ref string) *rowWrite { return &rowWrite{kind: kind, ref: ref} }

func (w *rowWrite) set(col string, val any) {
	w.columns = append(w.columns, columnValue{col, val})
}

// setPresent sets the column when an update sent the field.
func setPresent[T any](w *rowWrite, col string, value *T) {
	if value != nil {
		w.set(col, *value)
	}
}

// setRefPresent sets a nullable column when an update sent the field: an empty
// string clears it, as pgdata's `|| null`.
func setRefPresent(w *rowWrite, col string, value *string) {
	if value != nil {
		w.set(col, nullIfEmpty(*value))
	}
}

// setExtended sets extended when the request carries it. An empty Struct is
// sent, so it writes an empty object.
func (w *rowWrite) setExtended(extended *structpb.Struct) error {
	if extended == nil {
		return nil
	}
	value, err := jsonText(extended.AsMap())
	if err != nil {
		return fmt.Errorf("extended: %w", err)
	}
	w.set("extended", value)
	return nil
}

// insertExtended is extended on create: NULL when the request has none.
func (w *rowWrite) insertExtended(extended *structpb.Struct) error {
	if extended == nil {
		w.set("extended", nil)
		return nil
	}
	return w.setExtended(extended)
}

// setTrace sets trace_enabled when the request carries a trace.
func (w *rowWrite) setTrace(t *trace.Trace) {
	if t != nil {
		w.set("trace_enabled", t.GetEnabled())
	}
}

func nullIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func jsonText(value any) (string, error) {
	b, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// newRef is what Prisma's @default(uuid()) generated: a random UUID v4.
func newRef() string {
	var b [16]byte
	// crypto/rand never fails
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// privacyToColumn maps the enum to the stored Privacy ('NONE' or 'ID').
func privacyToColumn(p agents.Privacy) (string, error) {
	switch p {
	case agents.Privacy_PRIVATE:
		return "ID", nil
	case agents.Privacy_NONE:
		return "NONE", nil
	}
	return "", fmt.Errorf("unknown privacy %d", p)
}

// balancingToColumn maps the enum to the column: UNSPECIFIED is no value.
func balancingToColumn(a peers.LoadBalancingAlgorithm) any {
	if a == peers.LoadBalancingAlgorithm_UNSPECIFIED {
		return nil
	}
	return a.String()
}

// maxContactsOnCreate is the column's @default(-1) for a request that left
// the field out, which proto3 cannot tell from 0. A limit of 0 would refuse
// every registration, and rctl never sends it unless asked.
func maxContactsOnCreate(value int32) int32 {
	if value == 0 {
		return -1
	}
	return value
}

func egressPolicyRows(policies []*domains.EgressPolicy) *childRows {
	c := &childRows{table: "egress_policies", owner: "domain_ref", columns: []string{"number_ref", "rule"}}
	for _, p := range policies {
		c.rows = append(c.rows, []any{p.GetNumberRef(), p.GetRule()})
	}
	return c
}

func trunkURIRows(uris []*trunks.TrunkURI) *childRows {
	c := &childRows{
		table:   "trunk_uris",
		owner:   "trunk_ref",
		columns: []string{"host", "port", "transport", "user", "weight", "priority", "enabled"},
	}
	for _, u := range uris {
		c.rows = append(c.rows, []any{
			u.GetHost(), u.GetPort(), u.GetTransport(), nullIfEmpty(u.GetUser()), u.GetWeight(), u.GetPriority(), boolOf(u.Enabled, true),
		})
	}
	return c
}

func extraHeadersText(headers []*numbers.ExtraHeader) (string, error) {
	type header struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	}
	list := make([]header, 0, len(headers))
	for _, h := range headers {
		list = append(list, header{h.GetName(), h.GetValue()})
	}
	return jsonText(list)
}

// insertOf maps a Create request to its row, as each manager's mapToPrisma.
// What a request leaves out takes Routr 2's default, the column's in
// schema.prisma: an Agent, a Peer and a Trunk URI are enabled, an Agent's
// privacy is NONE.
func (s *postgresStore) insertOf(req proto.Message) (*rowWrite, error) {
	switch r := req.(type) {
	case *acl.CreateACLRequest:
		w := newRowWrite(KindACL, newRef())
		w.set("api_version", apiVersion)
		w.set("name", r.GetName())
		w.set("allow", r.GetAllow())
		w.set("deny", r.GetDeny())
		return w, w.insertExtended(r.GetExtended())
	case *agents.CreateAgentRequest:
		requested := agents.Privacy_NONE
		if r.Privacy != nil {
			requested = *r.Privacy
		}
		privacy, err := privacyToColumn(requested)
		if err != nil {
			return nil, err
		}
		w := newRowWrite(KindAgent, newRef())
		w.set("api_version", apiVersion)
		w.set("domain_ref", nullIfEmpty(r.GetDomainRef()))
		w.set("credentials_ref", nullIfEmpty(r.GetCredentialsRef()))
		w.set("name", r.GetName())
		w.set("username", r.GetUsername())
		w.set("privacy", privacy)
		w.set("max_contacts", maxContactsOnCreate(r.GetMaxContacts()))
		w.set("expires", r.GetExpires())
		w.set("enabled", boolOf(r.Enabled, true))
		w.set("trace_enabled", r.GetTrace().GetEnabled())
		return w, w.insertExtended(r.GetExtended())
	case *credentials.CreateCredentialsRequest:
		password, err := s.cipher.Encrypt(r.GetPassword())
		if err != nil {
			return nil, fmt.Errorf("credentials password: %w", err)
		}
		w := newRowWrite(KindCredentials, newRef())
		w.set("api_version", apiVersion)
		w.set("name", r.GetName())
		w.set("username", r.GetUsername())
		w.set("password", password)
		return w, w.insertExtended(r.GetExtended())
	case *domains.CreateDomainRequest:
		w := newRowWrite(KindDomain, newRef())
		w.set("api_version", apiVersion)
		w.set("acl_ref", nullIfEmpty(r.GetAccessControlListRef()))
		w.set("name", r.GetName())
		w.set("domain_uri", r.GetDomainUri())
		w.set("trace_enabled", r.GetTrace().GetEnabled())
		w.children = egressPolicyRows(r.GetEgressPolicies())
		return w, w.insertExtended(r.GetExtended())
	case *numbers.CreateNumberRequest:
		w := newRowWrite(KindNumber, newRef())
		w.set("api_version", apiVersion)
		w.set("trunk_ref", nullIfEmpty(r.GetTrunkRef()))
		w.set("tel_url", r.GetTelUrl())
		w.set("name", r.GetName())
		w.set("aor_link", nullIfEmpty(r.GetAorLink()))
		w.set("city", r.GetCity())
		w.set("country", r.GetCountry())
		w.set("country_iso_code", r.GetCountryIsoCode())
		w.set("session_affinity_header", nullIfEmpty(r.GetSessionAffinityHeader()))
		if len(r.GetExtraHeaders()) == 0 {
			w.set("extra_headers", nil)
		} else {
			headers, err := extraHeadersText(r.GetExtraHeaders())
			if err != nil {
				return nil, fmt.Errorf("extra_headers: %w", err)
			}
			w.set("extra_headers", headers)
		}
		return w, w.insertExtended(r.GetExtended())
	case *peers.CreatePeerRequest:
		w := newRowWrite(KindPeer, newRef())
		w.set("api_version", apiVersion)
		w.set("credentials_ref", nullIfEmpty(r.GetCredentialsRef()))
		w.set("acl_ref", nullIfEmpty(r.GetAccessControlListRef()))
		w.set("name", r.GetName())
		w.set("username", r.GetUsername())
		w.set("aor", r.GetAor())
		w.set("contact_addr", nullIfEmpty(r.GetContactAddr()))
		w.set("balancing_algorithm", balancingToColumn(r.GetBalancingAlgorithm()))
		w.set("with_session_affinity", r.GetWithSessionAffinity())
		w.set("max_contacts", maxContactsOnCreate(r.GetMaxContacts()))
		w.set("expires", r.GetExpires())
		w.set("enabled", boolOf(r.Enabled, true))
		w.set("trace_enabled", r.GetTrace().GetEnabled())
		return w, w.insertExtended(r.GetExtended())
	case *trunks.CreateTrunkRequest:
		w := newRowWrite(KindTrunk, newRef())
		w.set("api_version", apiVersion)
		w.set("acl_ref", nullIfEmpty(r.GetAccessControlListRef()))
		w.set("inbound_credentials_ref", nullIfEmpty(r.GetInboundCredentialsRef()))
		w.set("outbound_credentials_ref", nullIfEmpty(r.GetOutboundCredentialsRef()))
		w.set("name", r.GetName())
		w.set("send_register", r.GetSendRegister())
		w.set("normalize_to_e164", r.GetNormalizeToE164())
		w.set("rewrite_from_with_number", r.GetRewriteFromWithNumber())
		w.set("from_domain", nullIfEmpty(r.GetFromDomain()))
		w.set("inbound_uri", r.GetInboundUri())
		w.set("trace_enabled", r.GetTrace().GetEnabled())
		w.children = trunkURIRows(r.GetUris())
		return w, w.insertExtended(r.GetExtended())
	}
	return nil, fmt.Errorf("not a create request: %T", req)
}

// updateOf maps an Update request to the columns it sent (pgdata's
// pickPresentFields): an absent optional, an empty list or an absent message
// keeps what is stored.
func (s *postgresStore) updateOf(req proto.Message) (*rowWrite, error) {
	switch r := req.(type) {
	case *acl.UpdateACLRequest:
		w := newRowWrite(KindACL, r.GetRef())
		setPresent(w, "name", r.Name)
		if len(r.GetAllow()) > 0 {
			w.set("allow", r.GetAllow())
		}
		if len(r.GetDeny()) > 0 {
			w.set("deny", r.GetDeny())
		}
		return w, w.setExtended(r.GetExtended())
	case *agents.UpdateAgentRequest:
		w := newRowWrite(KindAgent, r.GetRef())
		setPresent(w, "name", r.Name)
		if r.Privacy != nil {
			privacy, err := privacyToColumn(*r.Privacy)
			if err != nil {
				return nil, err
			}
			w.set("privacy", privacy)
		}
		setPresent(w, "enabled", r.Enabled)
		setRefPresent(w, "domain_ref", r.DomainRef)
		setRefPresent(w, "credentials_ref", r.CredentialsRef)
		setPresent(w, "max_contacts", r.MaxContacts)
		setPresent(w, "expires", r.Expires)
		w.setTrace(r.GetTrace())
		return w, w.setExtended(r.GetExtended())
	case *credentials.UpdateCredentialsRequest:
		w := newRowWrite(KindCredentials, r.GetRef())
		setPresent(w, "name", r.Name)
		setPresent(w, "username", r.Username)
		if r.Password != nil {
			password, err := s.cipher.Encrypt(*r.Password)
			if err != nil {
				return nil, fmt.Errorf("credentials password: %w", err)
			}
			w.set("password", password)
		}
		return w, w.setExtended(r.GetExtended())
	case *domains.UpdateDomainRequest:
		w := newRowWrite(KindDomain, r.GetRef())
		setPresent(w, "name", r.Name)
		setRefPresent(w, "acl_ref", r.AccessControlListRef)
		w.setTrace(r.GetTrace())
		if len(r.GetEgressPolicies()) > 0 {
			w.children = egressPolicyRows(r.GetEgressPolicies())
		}
		return w, w.setExtended(r.GetExtended())
	case *numbers.UpdateNumberRequest:
		w := newRowWrite(KindNumber, r.GetRef())
		setPresent(w, "name", r.Name)
		setPresent(w, "aor_link", r.AorLink)
		setPresent(w, "session_affinity_header", r.SessionAffinityHeader)
		if len(r.GetExtraHeaders()) > 0 {
			headers, err := extraHeadersText(r.GetExtraHeaders())
			if err != nil {
				return nil, fmt.Errorf("extra_headers: %w", err)
			}
			w.set("extra_headers", headers)
		}
		setRefPresent(w, "trunk_ref", r.TrunkRef)
		return w, w.setExtended(r.GetExtended())
	case *peers.UpdatePeerRequest:
		w := newRowWrite(KindPeer, r.GetRef())
		setPresent(w, "name", r.Name)
		setPresent(w, "aor", r.Aor)
		setPresent(w, "contact_addr", r.ContactAddr)
		if r.BalancingAlgorithm != nil && *r.BalancingAlgorithm != peers.LoadBalancingAlgorithm_UNSPECIFIED {
			w.set("balancing_algorithm", r.BalancingAlgorithm.String())
		}
		setPresent(w, "with_session_affinity", r.WithSessionAffinity)
		setRefPresent(w, "acl_ref", r.AccessControlListRef)
		setRefPresent(w, "credentials_ref", r.CredentialsRef)
		setPresent(w, "enabled", r.Enabled)
		setPresent(w, "max_contacts", r.MaxContacts)
		setPresent(w, "expires", r.Expires)
		w.setTrace(r.GetTrace())
		return w, w.setExtended(r.GetExtended())
	case *trunks.UpdateTrunkRequest:
		w := newRowWrite(KindTrunk, r.GetRef())
		if r.ApiVersion != nil {
			w.set("api_version", apiVersion)
		}
		setPresent(w, "name", r.Name)
		setPresent(w, "send_register", r.SendRegister)
		setPresent(w, "inbound_uri", r.InboundUri)
		setRefPresent(w, "acl_ref", r.AccessControlListRef)
		setRefPresent(w, "inbound_credentials_ref", r.InboundCredentialsRef)
		setRefPresent(w, "outbound_credentials_ref", r.OutboundCredentialsRef)
		setPresent(w, "normalize_to_e164", r.NormalizeToE164)
		setPresent(w, "rewrite_from_with_number", r.RewriteFromWithNumber)
		setRefPresent(w, "from_domain", r.FromDomain)
		w.setTrace(r.GetTrace())
		if len(r.GetUris()) > 0 {
			w.children = trunkURIRows(r.GetUris())
		}
		return w, w.setExtended(r.GetExtended())
	}
	return nil, fmt.Errorf("not an update request: %T", req)
}

// insertSQL is the INSERT of a row with those columns.
func insertSQL(tableName string, columns []string) string {
	names := make([]string, 0, len(columns))
	params := make([]string, 0, len(columns))
	for i, col := range columns {
		names = append(names, quote(col))
		params = append(params, "$"+strconv.Itoa(i+1))
	}
	return "INSERT INTO " + quote(tableName) + " (" + strings.Join(names, ", ") + ") VALUES (" + strings.Join(params, ", ") + ")"
}

// updateSQL is the UPDATE of a row by its ref ($1). updated_at always moves,
// as Prisma's @updatedAt, even with no column to set.
func updateSQL(tableName string, columns []columnValue) (string, []any) {
	sets := make([]string, 0, len(columns)+1)
	args := make([]any, 0, len(columns)+1)
	for i, c := range columns {
		sets = append(sets, quote(c.col)+" = $"+strconv.Itoa(i+2))
		args = append(args, c.val)
	}
	sets = append(sets, "updated_at = now()")
	return "UPDATE " + quote(tableName) + " SET " + strings.Join(sets, ", ") + " WHERE ref = $1 RETURNING ref", args
}

func scanRef(r Rows) (string, error) {
	var ref string
	err := r.Scan(&ref)
	return ref, err
}

// execute runs a statement that yields nothing the caller reads. pgx reports
// a statement's failure when its rows end, so they are read to the end.
func execute(ctx context.Context, q Querier, sql string, args ...any) error {
	_, err := queryAll(ctx, q, sql, func(Rows) (struct{}, error) { return struct{}{}, nil }, args...)
	return err
}

func insertChildren(ctx context.Context, q Querier, c *childRows, owner string) error {
	sql := insertSQL(c.table, append([]string{"ref", c.owner}, c.columns...))
	for _, row := range c.rows {
		if err := execute(ctx, q, sql, append([]any{newRef(), owner}, row...)...); err != nil {
			return err
		}
	}
	return nil
}

// inTx runs a write and reads the result back in one transaction, so a failure
// anywhere leaves the stored rows as they were. Prisma's nested create was one
// transaction too; pgdata's update deleted the old child rows outside it.
func (s *postgresStore) inTx(ctx context.Context, kind Kind, ref string, run func(Querier) error) (proto.Message, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, storeError(fmt.Errorf("begin: %w", err))
	}
	defer func() {
		rollbackCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), rollbackTimeout)
		defer cancel()
		// After a commit this is a no-op with an error nobody needs
		_ = tx.Rollback(rollbackCtx)
	}()
	if err := run(tx); err != nil {
		return nil, err
	}
	msg, err := s.getFrom(ctx, tx, kind, ref)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, storeError(fmt.Errorf("commit: %w", err))
	}
	return msg, nil
}

// Create inserts the row and its children and answers the resource as Get
// does. An existing unique value is an AlreadyExistsError and a ref to nothing
// a BadRequestError, with pgdata's messages.
func (s *postgresStore) Create(ctx context.Context, req proto.Message) (proto.Message, error) {
	w, err := s.insertOf(req)
	if err != nil {
		return nil, err
	}
	msg, err := s.inTx(ctx, w.kind, w.ref, func(q Querier) error {
		columns := make([]string, 0, len(w.columns)+1)
		args := make([]any, 0, len(w.columns)+1)
		columns = append(columns, "ref")
		args = append(args, w.ref)
		for _, c := range w.columns {
			columns = append(columns, c.col)
			args = append(args, c.val)
		}
		columns = append(columns, "created_at", "updated_at")
		now := time.Now().UTC()
		args = append(args, now, now)
		if err := execute(ctx, q, insertSQL(tables[w.kind].name, columns), args...); err != nil {
			return err
		}
		if w.children != nil {
			return insertChildren(ctx, q, w.children, w.ref)
		}
		return nil
	})
	if err != nil {
		return nil, createError(err)
	}
	return msg, nil
}

// Update sets the columns the request sent and replaces the children it
// carries. A ref to no row is a NotFoundError. pgdata mapped only a missing
// dependency among the constraint errors of an update, so a duplicate stays a
// failure of the store.
func (s *postgresStore) Update(ctx context.Context, req proto.Message) (proto.Message, error) {
	w, err := s.updateOf(req)
	if err != nil {
		return nil, err
	}
	msg, err := s.inTx(ctx, w.kind, w.ref, func(q Querier) error {
		sql, args := updateSQL(tables[w.kind].name, w.columns)
		updated, err := queryAll(ctx, q, sql, scanRef, append([]any{w.ref}, args...)...)
		if err != nil {
			return err
		}
		if len(updated) == 0 {
			return &NotFoundError{Ref: w.ref}
		}
		if w.children == nil {
			return nil
		}
		deleteChildren := "DELETE FROM " + quote(w.children.table) + " WHERE " + quote(w.children.owner) + " = $1"
		if err := execute(ctx, q, deleteChildren, w.ref); err != nil {
			return err
		}
		return insertChildren(ctx, q, w.children, w.ref)
	})
	if err != nil {
		return nil, dependencyError(err)
	}
	return msg, nil
}

// Delete removes the row; the schema's foreign keys cascade or set null. A ref
// to no row is no error, which is how pgdata answered it.
func (s *postgresStore) Delete(ctx context.Context, kind Kind, ref string) error {
	t, ok := tables[kind]
	if !ok {
		return fmt.Errorf("unknown kind %q", kind)
	}
	return execute(ctx, s.db, "DELETE FROM "+quote(t.name)+" WHERE ref = $1", ref)
}

// createError is the answer for a failed create: Prisma's P2002 and P2003.
func createError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return &AlreadyExistsError{Message: "Resource already exist for field: " + uniqueField(pgErr)}
	}
	return dependencyError(err)
}

// dependencyError is Prisma's P2003, whose field_name on Postgres was the
// constraint's name with " (index)" after it.
func dependencyError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return &BadRequestError{Message: "Dependent resource doesn't exist for: " + pgErr.ConstraintName + " (index)"}
	}
	return err
}

// uniqueField is the first target of Prisma's P2002, which it parsed from the
// error's detail: `Key (username)=(1001) already exists.` names the column.
func uniqueField(pgErr *pgconn.PgError) string {
	_, rest, ok := strings.Cut(pgErr.Detail, "(")
	if !ok {
		return pgErr.ConstraintName
	}
	columns, _, ok := strings.Cut(rest, ")=(")
	if !ok {
		return pgErr.ConstraintName
	}
	first, _, _ := strings.Cut(columns, ", ")
	return strings.ReplaceAll(first, `"`, "")
}
