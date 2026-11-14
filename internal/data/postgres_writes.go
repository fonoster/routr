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
	// check, when set, runs first in the write's transaction: a rule on the
	// row as it will be stored that needs the stored rows (a Number's aliases
	// on its Trunk, a Trunk's number formats)
	check func(ctx context.Context, q Querier) error
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
// the field out; a 0 it sent stays 0, a limit that refuses every registration.
func maxContactsOnCreate(value *int32) int32 {
	if value == nil {
		return -1
	}
	return *value
}

func egressPolicyRows(policies []*domains.EgressPolicy) *childRows {
	c := &childRows{table: "egress_policies", owner: "domain_ref", columns: []string{"number_ref", "rule"}}
	for _, p := range policies {
		c.rows = append(c.rows, []any{p.GetNumberRef(), p.GetRule()})
	}
	return c
}

// trunkURIRows writes the transport as the Transport enum's label, upper
// case, whatever the case the client sent (hasValidTransports).
func trunkURIRows(uris []*trunks.TrunkURI) *childRows {
	c := &childRows{
		table:   "trunk_uris",
		owner:   "trunk_ref",
		columns: []string{"host", "port", "transport", "user", "weight", "priority", "enabled"},
	}
	for _, u := range uris {
		c.rows = append(c.rows, []any{
			u.GetHost(), u.GetPort(), strings.ToUpper(u.GetTransport()), nullIfEmpty(u.GetUser()), u.GetWeight(), u.GetPriority(), boolOf(u.Enabled, true),
		})
	}
	return c
}

// numberFormatToColumn maps the enum to a number_format label: UNSPECIFIED
// is NULL.
func numberFormatToColumn(f trunks.NumberFormat) any {
	if f == trunks.NumberFormat_UNSPECIFIED {
		return nil
	}
	return f.String()
}

// aliasesColumn is a Number's aliases as stored: an empty array, never NULL.
func aliasesColumn(aliases []string) []string {
	if aliases == nil {
		return []string{}
	}
	return aliases
}

// lockTrunk takes the Trunk's row so alias checks on one Trunk run one at a
// time; a ref to no Trunk is left to the foreign key.
func lockTrunk(ctx context.Context, q Querier, trunkRef string) error {
	return execute(ctx, q, `SELECT 1 FROM "trunks" WHERE ref = $1 FOR NO KEY UPDATE`, trunkRef)
}

type aliasesRow struct {
	ref     string
	aliases []string
}

func scanAliasesRow(r Rows) (aliasesRow, error) {
	var a aliasesRow
	err := r.Scan(&a.ref, &a.aliases)
	return a, err
}

// checkAliasesOnTrunk refuses aliases another Number of the Trunk has (an
// index scan of numbers_trunk_ref_idx). ref is the Number's own, left out.
func checkAliasesOnTrunk(ctx context.Context, q Querier, ref, trunkRef string, aliases []string) error {
	if err := lockTrunk(ctx, q, trunkRef); err != nil {
		return err
	}
	others, err := queryAll(ctx, q,
		`SELECT ref, aliases FROM "numbers" WHERE trunk_ref = $1 AND aliases && $2 AND ref <> $3 ORDER BY ref`,
		scanAliasesRow, trunkRef, aliases, ref)
	if err != nil {
		return err
	}
	owners := make(map[string]string)
	for i := len(others) - 1; i >= 0; i-- {
		for _, alias := range others[i].aliases {
			owners[alias] = others[i].ref
		}
	}
	for _, alias := range aliases {
		if owner, ok := owners[alias]; ok {
			return &BadRequestError{Message: usedAliasMessage(alias, owner)}
		}
	}
	return nil
}

// storedAliases is a Number's Trunk and aliases as stored.
type storedAliases struct {
	trunkRef *string
	aliases  []string
}

func scanStoredAliases(r Rows) (storedAliases, error) {
	var a storedAliases
	err := r.Scan(&a.trunkRef, &a.aliases)
	return a, err
}

// checkNumberUpdateAliases checks the aliases a Number will have on the Trunk
// it will be on: an update that moves it brings its stored aliases along.
func checkNumberUpdateAliases(ctx context.Context, q Querier, r *numbers.UpdateNumberRequest) error {
	stored, err := queryAll(ctx, q, `SELECT trunk_ref, aliases FROM "numbers" WHERE ref = $1 FOR UPDATE`,
		scanStoredAliases, r.GetRef())
	if err != nil || len(stored) == 0 {
		// No row is Update's NotFoundError
		return err
	}
	trunkRef := stringOf(stored[0].trunkRef)
	if r.TrunkRef != nil {
		trunkRef = *r.TrunkRef
	}
	aliases := stored[0].aliases
	if len(r.GetAliases()) > 0 {
		aliases = r.GetAliases()
	}
	if trunkRef == "" || len(aliases) == 0 {
		return nil
	}
	return checkAliasesOnTrunk(ctx, q, r.GetRef(), trunkRef, aliases)
}

// checkTrunkUpdateFormats checks the number formats a Trunk will have: what
// the update sends over what is stored.
func checkTrunkUpdateFormats(ctx context.Context, q Querier, r *trunks.UpdateTrunkRequest) error {
	stored, err := queryAll(ctx, q,
		`SELECT called_number_format, called_number_prefix, caller_number_format, caller_number_prefix FROM "trunks" WHERE ref = $1 FOR UPDATE`,
		func(rows Rows) ([4]*string, error) {
			var row [4]*string
			err := rows.Scan(&row[0], &row[1], &row[2], &row[3])
			return row, err
		}, r.GetRef())
	if err != nil || len(stored) == 0 {
		// No row is Update's NotFoundError
		return err
	}
	called := trunkNumberFormat{"calledNumber", numberFormatOfColumn(stored[0][0]), stringOf(stored[0][1])}
	caller := trunkNumberFormat{"callerNumber", numberFormatOfColumn(stored[0][2]), stringOf(stored[0][3])}
	if r.CalledNumberFormat != nil {
		called.format = *r.CalledNumberFormat
	}
	if r.CalledNumberPrefix != nil {
		called.prefix = *r.CalledNumberPrefix
	}
	if r.CallerNumberFormat != nil {
		caller.format = *r.CallerNumberFormat
	}
	if r.CallerNumberPrefix != nil {
		caller.prefix = *r.CallerNumberPrefix
	}
	return validateTrunkNumberFormats(called, caller)
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
		w.set("max_contacts", maxContactsOnCreate(r.MaxContacts))
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
		w.set("aliases", aliasesColumn(r.GetAliases()))
		if trunkRef, aliases := r.GetTrunkRef(), r.GetAliases(); trunkRef != "" && len(aliases) > 0 {
			ref := w.ref
			w.check = func(ctx context.Context, q Querier) error {
				return checkAliasesOnTrunk(ctx, q, ref, trunkRef, aliases)
			}
		}
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
		w.set("max_contacts", maxContactsOnCreate(r.MaxContacts))
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
		w.set("rewrite_from_with_number", r.GetRewriteFromWithNumber())
		w.set("called_number_format", numberFormatToColumn(r.GetCalledNumberFormat()))
		w.set("called_number_prefix", nullIfEmpty(r.GetCalledNumberPrefix()))
		w.set("caller_number_format", numberFormatToColumn(r.GetCallerNumberFormat()))
		w.set("caller_number_prefix", nullIfEmpty(r.GetCallerNumberPrefix()))
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
		switch {
		case r.GetClearAliases():
			w.set("aliases", []string{})
		case len(r.GetAliases()) > 0:
			w.set("aliases", r.GetAliases())
		}
		movesTrunk := r.TrunkRef != nil && *r.TrunkRef != ""
		if movesTrunk || (len(r.GetAliases()) > 0 && !r.GetClearAliases()) {
			w.check = func(ctx context.Context, q Querier) error { return checkNumberUpdateAliases(ctx, q, r) }
		}
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
		setPresent(w, "rewrite_from_with_number", r.RewriteFromWithNumber)
		if r.CalledNumberFormat != nil {
			w.set("called_number_format", numberFormatToColumn(*r.CalledNumberFormat))
		}
		setRefPresent(w, "called_number_prefix", r.CalledNumberPrefix)
		if r.CallerNumberFormat != nil {
			w.set("caller_number_format", numberFormatToColumn(*r.CallerNumberFormat))
		}
		setRefPresent(w, "caller_number_prefix", r.CallerNumberPrefix)
		if r.CalledNumberFormat != nil || r.CalledNumberPrefix != nil || r.CallerNumberFormat != nil || r.CallerNumberPrefix != nil {
			w.check = func(ctx context.Context, q Querier) error { return checkTrunkUpdateFormats(ctx, q, r) }
		}
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
	var msg proto.Message
	err := s.transact(ctx, func(q Querier) error {
		if err := run(q); err != nil {
			return err
		}
		var err error
		msg, err = s.getFrom(ctx, q, kind, ref)
		return err
	})
	if err != nil {
		return nil, err
	}
	return msg, nil
}

// transact runs in one transaction, which commits when run succeeds.
func (s *postgresStore) transact(ctx context.Context, run func(Querier) error) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return storeError(fmt.Errorf("begin: %w", err))
	}
	defer func() {
		rollbackCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), rollbackTimeout)
		defer cancel()
		// After a commit this is a no-op with an error nobody needs
		_ = tx.Rollback(rollbackCtx)
	}()
	if err := run(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return storeError(fmt.Errorf("commit: %w", err))
	}
	return nil
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
		if w.check != nil {
			if err := w.check(ctx, q); err != nil {
				return err
			}
		}
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
		return nil, writeError(err)
	}
	return msg, nil
}

// Update sets the columns the request sent and replaces the children it
// carries. A ref to no row is a NotFoundError. Its constraint errors are
// Create's: an existing unique value is an AlreadyExistsError naming the
// field, where pgdata left it a failure of the store (UNKNOWN).
func (s *postgresStore) Update(ctx context.Context, req proto.Message) (proto.Message, error) {
	w, err := s.updateOf(req)
	if err != nil {
		return nil, err
	}
	msg, err := s.inTx(ctx, w.kind, w.ref, func(q Querier) error {
		if w.check != nil {
			if err := w.check(ctx, q); err != nil {
				return err
			}
		}
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
		return nil, writeError(err)
	}
	return msg, nil
}

// trunkGuards are the resources a Trunk's inbound access rests on, with the
// columns of "trunks" that point at them. The schema's foreign keys would set
// those columns to null, and a Trunk with neither an ACL nor credentials accepts
// any call (Connect's checkAccessFromPSTN), so such a delete is refused.
var trunkGuards = map[Kind]struct {
	label string
	where string
}{
	KindCredentials: {"Credentials", "inbound_credentials_ref = $1 OR outbound_credentials_ref = $1"},
	KindACL:         {"AccessControlList", "acl_ref = $1"},
}

// Delete removes the row; the schema's foreign keys cascade or set null. A ref
// to no row is no error, which is how pgdata answered it. Credentials or an ACL
// a Trunk references is a BadRequestError and stays; pgdata deleted them.
func (s *postgresStore) Delete(ctx context.Context, kind Kind, ref string) error {
	t, ok := tables[kind]
	if !ok {
		return fmt.Errorf("unknown kind %q", kind)
	}
	del := "DELETE FROM " + quote(t.name) + " WHERE ref = $1"
	guard, guarded := trunkGuards[kind]
	if !guarded {
		return execute(ctx, s.db, del, ref)
	}
	return s.transact(ctx, func(q Querier) error {
		// The lock holds back a write that would point a Trunk at this row (its
		// foreign key check takes a share of it) until the delete ends, and waits
		// for one in progress, so the check below sees it.
		lock := "SELECT 1 FROM " + quote(t.name) + " WHERE ref = $1 FOR UPDATE"
		found, err := queryAll(ctx, q, lock, func(Rows) (struct{}, error) { return struct{}{}, nil }, ref)
		if err != nil || len(found) == 0 {
			return err
		}
		referrers, err := queryAll(ctx, q, `SELECT ref FROM "trunks" WHERE `+guard.where+" LIMIT 1", scanRef, ref)
		if err != nil {
			return err
		}
		if len(referrers) > 0 {
			return &BadRequestError{Message: fmt.Sprintf("the %s %s is in use by Trunk %s: remove it from the Trunk first", guard.label, ref, referrers[0])}
		}
		return execute(ctx, q, del, ref)
	})
}

// writeError is the answer for a failed create or update: Prisma's P2002
// and P2003.
func writeError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return &AlreadyExistsError{Message: "Resource already exist for field: " + uniqueField(pgErr)}
	}
	return dependencyError(err)
}

// dependencyError is the answer pgdata gave for Prisma's P2003, naming the
// foreign key constraint the write broke. Anything else may be a value the
// database refused (refusedValueError).
func dependencyError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return &BadRequestError{Message: "Dependent resource doesn't exist for: " + pgErr.ConstraintName}
	}
	return refusedValueError(err)
}

// dataException is the SQLSTATE class of a value its column cannot take: too
// long (22001), out of range (22003), not a label of its enum (22P02).
const dataException = "22"

// refusedValueError is the answer for a write PostgreSQL refused as data: a
// bad request with PostgreSQL's message, which names the type and, at most,
// the value the client sent. Its detail and its hint stay out, and the SQL
// too, which the cause keeps for the log (Data.fail). pgdata answered
// Prisma's own error here.
func refusedValueError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && strings.HasPrefix(pgErr.Code, dataException) {
		return &BadRequestError{Message: "the database refused a value: " + pgErr.Message, Cause: err}
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
