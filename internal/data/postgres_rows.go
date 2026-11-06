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
	"encoding/json"
	"fmt"
	"time"

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

// The rows of the Routr 2 schema, one struct per table, scanned in the
// order of the column list next to each. Nullable columns scan to pointers.

const agentColumns = "api_version, ref, domain_ref, credentials_ref, name, username, privacy, " +
	"max_contacts, expires, enabled, created_at, updated_at, extended, trace_enabled"

type agentRow struct {
	apiVersion, ref           string
	domainRef, credentialsRef *string
	name, username, privacy   string
	maxContacts, expires      int32
	enabled                   bool
	createdAt, updatedAt      time.Time
	extended                  []byte
	traceEnabled              bool
}

func scanAgent(r Rows) (*agentRow, error) {
	a := &agentRow{}
	err := r.Scan(&a.apiVersion, &a.ref, &a.domainRef, &a.credentialsRef, &a.name, &a.username, &a.privacy,
		&a.maxContacts, &a.expires, &a.enabled, &a.createdAt, &a.updatedAt, &a.extended, &a.traceEnabled)
	return a, err
}

const peerColumns = "api_version, ref, credentials_ref, acl_ref, name, username, aor, contact_addr, " +
	"balancing_algorithm, with_session_affinity, max_contacts, expires, enabled, created_at, updated_at, " +
	"extended, trace_enabled"

type peerRow struct {
	apiVersion, ref                 string
	credentialsRef, aclRef          *string
	name, username, aor             string
	contactAddr, balancingAlgorithm *string
	withSessionAffinity             bool
	maxContacts, expires            int32
	enabled                         bool
	createdAt, updatedAt            time.Time
	extended                        []byte
	traceEnabled                    bool
}

func scanPeer(r Rows) (*peerRow, error) {
	p := &peerRow{}
	err := r.Scan(&p.apiVersion, &p.ref, &p.credentialsRef, &p.aclRef, &p.name, &p.username, &p.aor, &p.contactAddr,
		&p.balancingAlgorithm, &p.withSessionAffinity, &p.maxContacts, &p.expires, &p.enabled, &p.createdAt, &p.updatedAt,
		&p.extended, &p.traceEnabled)
	return p, err
}

const domainColumns = "api_version, ref, acl_ref, name, domain_uri, created_at, updated_at, extended, trace_enabled"

type domainRow struct {
	apiVersion, ref      string
	aclRef               *string
	name, domainURI      string
	createdAt, updatedAt time.Time
	extended             []byte
	traceEnabled         bool
}

func scanDomain(r Rows) (*domainRow, error) {
	d := &domainRow{}
	err := r.Scan(&d.apiVersion, &d.ref, &d.aclRef, &d.name, &d.domainURI, &d.createdAt, &d.updatedAt, &d.extended, &d.traceEnabled)
	return d, err
}

const trunkColumns = "api_version, ref, acl_ref, inbound_credentials_ref, outbound_credentials_ref, name, " +
	"send_register, normalize_to_e164, rewrite_from_with_number, from_domain, inbound_uri, created_at, updated_at, " +
	"extended, trace_enabled"

type trunkRow struct {
	apiVersion, ref                                       string
	aclRef, inboundCredentialsRef, outboundCredentialsRef *string
	name                                                  string
	sendRegister, normalizeToE164, rewriteFromWithNumber  bool
	fromDomain, inboundURI                                *string
	createdAt, updatedAt                                  time.Time
	extended                                              []byte
	traceEnabled                                          bool
}

func scanTrunk(r Rows) (*trunkRow, error) {
	t := &trunkRow{}
	err := r.Scan(&t.apiVersion, &t.ref, &t.aclRef, &t.inboundCredentialsRef, &t.outboundCredentialsRef, &t.name,
		&t.sendRegister, &t.normalizeToE164, &t.rewriteFromWithNumber, &t.fromDomain, &t.inboundURI, &t.createdAt, &t.updatedAt,
		&t.extended, &t.traceEnabled)
	return t, err
}

const numberColumns = "api_version, ref, trunk_ref, tel_url, name, aor_link, city, country, country_iso_code, " +
	"session_affinity_header, extra_headers, created_at, updated_at, extended"

type numberRow struct {
	apiVersion, ref               string
	trunkRef                      *string
	telURL, name                  string
	aorLink                       *string
	city, country, countryIsoCode string
	sessionAffinityHeader         *string
	extraHeaders                  []byte
	createdAt, updatedAt          time.Time
	extended                      []byte
}

func scanNumber(r Rows) (*numberRow, error) {
	n := &numberRow{}
	err := r.Scan(&n.apiVersion, &n.ref, &n.trunkRef, &n.telURL, &n.name, &n.aorLink, &n.city, &n.country, &n.countryIsoCode,
		&n.sessionAffinityHeader, &n.extraHeaders, &n.createdAt, &n.updatedAt, &n.extended)
	return n, err
}

const aclColumns = "api_version, ref, name, allow, deny, created_at, updated_at, extended"

type aclRow struct {
	apiVersion, ref, name string
	allow, deny           []string
	createdAt, updatedAt  time.Time
	extended              []byte
}

func scanACL(r Rows) (*aclRow, error) {
	a := &aclRow{}
	err := r.Scan(&a.apiVersion, &a.ref, &a.name, &a.allow, &a.deny, &a.createdAt, &a.updatedAt, &a.extended)
	return a, err
}

const credentialsColumns = "api_version, ref, name, username, password, created_at, updated_at, extended"

type credentialsRow struct {
	apiVersion, ref, name, username, password string
	createdAt, updatedAt                      time.Time
	extended                                  []byte
}

func scanCredentials(r Rows) (*credentialsRow, error) {
	c := &credentialsRow{}
	err := r.Scan(&c.apiVersion, &c.ref, &c.name, &c.username, &c.password, &c.createdAt, &c.updatedAt, &c.extended)
	return c, err
}

const egressPolicyColumns = "ref, domain_ref, number_ref, rule"

type egressPolicyRow struct {
	ref, domainRef, numberRef, rule string
}

func scanEgressPolicy(r Rows) (*egressPolicyRow, error) {
	p := &egressPolicyRow{}
	err := r.Scan(&p.ref, &p.domainRef, &p.numberRef, &p.rule)
	return p, err
}

const trunkURIColumns = "ref, trunk_ref, host, port, transport, \"user\", weight, priority, enabled"

type trunkURIRow struct {
	ref, trunkRef, host string
	port                int32
	transport           string
	user                *string
	weight, priority    *int32
	enabled             bool
}

func scanTrunkURI(r Rows) (*trunkURIRow, error) {
	u := &trunkURIRow{}
	err := r.Scan(&u.ref, &u.trunkRef, &u.host, &u.port, &u.transport, &u.user, &u.weight, &u.priority, &u.enabled)
	return u, err
}

// columnsOf is the column list of a kind's table.
func columnsOf(kind Kind) string {
	switch kind {
	case KindAgent:
		return agentColumns
	case KindPeer:
		return peerColumns
	case KindDomain:
		return domainColumns
	case KindTrunk:
		return trunkColumns
	case KindNumber:
		return numberColumns
	case KindCredentials:
		return credentialsColumns
	case KindACL:
		return aclColumns
	}
	return ""
}

// pgLoader runs one read: the kind's query, then the relation queries
// pgdata's includeFields asked Prisma for, each by the refs the rows name.
type pgLoader struct {
	ctx context.Context
	s   *postgresStore
	// q is where the read runs: the pool, or a write's transaction
	q Querier
}

// load runs the kind's query and assembles the messages.
func (l *pgLoader) load(kind Kind, sql string, args ...any) ([]proto.Message, error) {
	switch kind {
	case KindAgent:
		rows, err := queryAll(l.ctx, l.q, sql, scanAgent, args...)
		if err != nil {
			return nil, err
		}
		return l.agents(rows)
	case KindPeer:
		rows, err := queryAll(l.ctx, l.q, sql, scanPeer, args...)
		if err != nil {
			return nil, err
		}
		return l.peers(rows)
	case KindDomain:
		rows, err := queryAll(l.ctx, l.q, sql, scanDomain, args...)
		if err != nil {
			return nil, err
		}
		list, err := l.domains(rows, true, false)
		return messagesOf(list, err)
	case KindTrunk:
		rows, err := queryAll(l.ctx, l.q, sql, scanTrunk, args...)
		if err != nil {
			return nil, err
		}
		list, err := l.trunks(rows, true)
		return messagesOf(list, err)
	case KindNumber:
		rows, err := queryAll(l.ctx, l.q, sql, scanNumber, args...)
		if err != nil {
			return nil, err
		}
		list, err := l.numbers(rows, true, true)
		return messagesOf(list, err)
	case KindCredentials:
		rows, err := queryAll(l.ctx, l.q, sql, scanCredentials, args...)
		if err != nil {
			return nil, err
		}
		list, err := l.credentials(rows, true)
		return messagesOf(list, err)
	case KindACL:
		rows, err := queryAll(l.ctx, l.q, sql, scanACL, args...)
		if err != nil {
			return nil, err
		}
		return messagesOf(mapACLs(rows, true), nil)
	}
	return nil, fmt.Errorf("unknown kind %q", kind)
}

func messagesOf[T proto.Message](list []T, err error) ([]proto.Message, error) {
	if err != nil {
		return nil, err
	}
	out := make([]proto.Message, 0, len(list))
	for _, item := range list {
		out = append(out, item)
	}
	return out, nil
}

// byRefs fetches a table's rows for a set of refs (one query, or none for
// an empty set) and keys them by the ref the keyOf reads.
func byRefs[R any](l *pgLoader, cols, tableName, fk string, refs []string, scan func(Rows) (R, error), keyOf func(R) string) (map[string][]R, error) {
	out := make(map[string][]R, len(refs))
	if len(refs) == 0 {
		return out, nil
	}
	sql := "SELECT " + cols + " FROM " + quote(tableName) + " WHERE " + quote(fk) + " = ANY($1)"
	rows, err := queryAll(l.ctx, l.q, sql, scan, refs)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		k := keyOf(r)
		out[k] = append(out[k], r)
	}
	return out, nil
}

// refsOf collects the distinct non-null refs the rows name.
func refsOf[R any](rows []R, refOf func(R) *string) []string {
	seen := make(map[string]bool, len(rows))
	var refs []string
	for _, r := range rows {
		ref := refOf(r)
		if ref == nil || seen[*ref] {
			continue
		}
		seen[*ref] = true
		refs = append(refs, *ref)
	}
	return refs
}

func (l *pgLoader) aclsByRef(refs []string, top bool) (map[string]*acl.AccessControlList, error) {
	rows, err := byRefs(l, aclColumns, "access_control_lists", "ref", refs, scanACL, func(r *aclRow) string { return r.ref })
	if err != nil {
		return nil, err
	}
	out := make(map[string]*acl.AccessControlList, len(rows))
	for ref, list := range rows {
		out[ref] = mapACL(list[0], top)
	}
	return out, nil
}

func (l *pgLoader) credentialsByRef(refs []string) (map[string]*credentials.Credentials, error) {
	rows, err := byRefs(l, credentialsColumns, "credentials", "ref", refs, scanCredentials, func(r *credentialsRow) string { return r.ref })
	if err != nil {
		return nil, err
	}
	out := make(map[string]*credentials.Credentials, len(rows))
	for ref, list := range rows {
		c, err := l.mapCredentials(list[0], false)
		if err != nil {
			return nil, err
		}
		out[ref] = c
	}
	return out, nil
}

// credentials maps top-level Credentials rows, decrypting the password.
func (l *pgLoader) credentials(rows []*credentialsRow, top bool) ([]*credentials.Credentials, error) {
	out := make([]*credentials.Credentials, 0, len(rows))
	for _, r := range rows {
		c, err := l.mapCredentials(r, top)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (l *pgLoader) mapCredentials(r *credentialsRow, top bool) (*credentials.Credentials, error) {
	password, err := l.s.cipher.Decrypt(r.password)
	if err != nil {
		return nil, fmt.Errorf("credentials %s: %w", r.ref, err)
	}
	extended, err := extendedOf(r.extended, top)
	if err != nil {
		return nil, fmt.Errorf("credentials %s: %w", r.ref, err)
	}
	return &credentials.Credentials{
		ApiVersion: r.apiVersion,
		Ref:        r.ref,
		Name:       r.name,
		Username:   r.username,
		Password:   password,
		CreatedAt:  seconds(r.createdAt),
		UpdatedAt:  seconds(r.updatedAt),
		Extended:   extended,
	}, nil
}

func mapACLs(rows []*aclRow, top bool) []*acl.AccessControlList {
	out := make([]*acl.AccessControlList, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapACL(r, top))
	}
	return out
}

func mapACL(r *aclRow, top bool) *acl.AccessControlList {
	// An ACL's extended is a JSON object or null, so this cannot fail
	extended, _ := extendedOf(r.extended, top)
	return &acl.AccessControlList{
		ApiVersion: r.apiVersion,
		Ref:        r.ref,
		Name:       r.name,
		Allow:      r.allow,
		Deny:       r.deny,
		CreatedAt:  seconds(r.createdAt),
		UpdatedAt:  seconds(r.updatedAt),
		Extended:   extended,
	}
}

// trunks maps Trunk rows with what TrunkManager included: the ACL, both
// Credentials and the URIs.
func (l *pgLoader) trunks(rows []*trunkRow, top bool) ([]*trunks.Trunk, error) {
	acls, err := l.aclsByRef(refsOf(rows, func(r *trunkRow) *string { return r.aclRef }), false)
	if err != nil {
		return nil, err
	}
	credRefs := append(
		refsOf(rows, func(r *trunkRow) *string { return r.inboundCredentialsRef }),
		refsOf(rows, func(r *trunkRow) *string { return r.outboundCredentialsRef })...)
	creds, err := l.credentialsByRef(credRefs)
	if err != nil {
		return nil, err
	}
	trunkRefs := make([]string, 0, len(rows))
	for _, r := range rows {
		trunkRefs = append(trunkRefs, r.ref)
	}
	uris, err := byRefs(l, trunkURIColumns, "trunk_uris", "trunk_ref", trunkRefs, scanTrunkURI, func(u *trunkURIRow) string { return u.trunkRef })
	if err != nil {
		return nil, err
	}

	out := make([]*trunks.Trunk, 0, len(rows))
	for _, r := range rows {
		extended, err := extendedOf(r.extended, top)
		if err != nil {
			return nil, fmt.Errorf("trunk %s: %w", r.ref, err)
		}
		t := &trunks.Trunk{
			ApiVersion:            r.apiVersion,
			Ref:                   r.ref,
			Name:                  r.name,
			SendRegister:          r.sendRegister,
			NormalizeToE164:       r.normalizeToE164,
			RewriteFromWithNumber: r.rewriteFromWithNumber,
			FromDomain:            stringOf(r.fromDomain),
			InboundUri:            stringOf(r.inboundURI),
			CreatedAt:             seconds(r.createdAt),
			UpdatedAt:             seconds(r.updatedAt),
			Extended:              extended,
			Trace:                 &trace.Trace{Enabled: r.traceEnabled},
		}
		if r.aclRef != nil {
			t.AccessControlList = acls[*r.aclRef]
		}
		if r.inboundCredentialsRef != nil {
			t.InboundCredentials = creds[*r.inboundCredentialsRef]
		}
		if r.outboundCredentialsRef != nil {
			t.OutboundCredentials = creds[*r.outboundCredentialsRef]
		}
		for _, u := range uris[r.ref] {
			t.Uris = append(t.Uris, &trunks.TrunkURI{
				Host:      u.host,
				Port:      u.port,
				Transport: u.transport,
				User:      stringOf(u.user),
				Weight:    int32Of(u.weight, 0),
				Priority:  int32Of(u.priority, 0),
				Enabled:   u.enabled,
			})
		}
		out = append(out, t)
	}
	return out, nil
}

func (l *pgLoader) trunksByRef(refs []string) (map[string]*trunks.Trunk, error) {
	rows, err := byRefs(l, trunkColumns, "trunks", "ref", refs, scanTrunk, func(r *trunkRow) string { return r.ref })
	if err != nil {
		return nil, err
	}
	flat := make([]*trunkRow, 0, len(rows))
	for _, list := range rows {
		flat = append(flat, list[0])
	}
	list, err := l.trunks(flat, false)
	if err != nil {
		return nil, err
	}
	out := make(map[string]*trunks.Trunk, len(list))
	for _, t := range list {
		out[t.GetRef()] = t
	}
	return out, nil
}

// numbers maps Number rows, with the Trunk NumberManager included when
// withTrunk is set (a Domain's egress policy numbers have none).
func (l *pgLoader) numbers(rows []*numberRow, top, withTrunk bool) ([]*numbers.Number, error) {
	var trunkMap map[string]*trunks.Trunk
	if withTrunk {
		var err error
		trunkMap, err = l.trunksByRef(refsOf(rows, func(r *numberRow) *string { return r.trunkRef }))
		if err != nil {
			return nil, err
		}
	}
	out := make([]*numbers.Number, 0, len(rows))
	for _, r := range rows {
		extended, err := extendedOf(r.extended, top)
		if err != nil {
			return nil, fmt.Errorf("number %s: %w", r.ref, err)
		}
		headers, err := extraHeadersOf(r.extraHeaders)
		if err != nil {
			return nil, fmt.Errorf("number %s: %w", r.ref, err)
		}
		n := &numbers.Number{
			ApiVersion:            r.apiVersion,
			Ref:                   r.ref,
			Name:                  r.name,
			TelUrl:                r.telURL,
			AorLink:               stringOf(r.aorLink),
			City:                  r.city,
			Country:               r.country,
			CountryIsoCode:        r.countryIsoCode,
			SessionAffinityHeader: stringOf(r.sessionAffinityHeader),
			ExtraHeaders:          headers,
			CreatedAt:             seconds(r.createdAt),
			UpdatedAt:             seconds(r.updatedAt),
			Extended:              extended,
		}
		if withTrunk && r.trunkRef != nil {
			n.Trunk = trunkMap[*r.trunkRef]
		}
		out = append(out, n)
	}
	return out, nil
}

func (l *pgLoader) numbersByRef(refs []string, withTrunk bool) (map[string]*numbers.Number, error) {
	rows, err := byRefs(l, numberColumns, "numbers", "ref", refs, scanNumber, func(r *numberRow) string { return r.ref })
	if err != nil {
		return nil, err
	}
	flat := make([]*numberRow, 0, len(rows))
	for _, list := range rows {
		flat = append(flat, list[0])
	}
	list, err := l.numbers(flat, false, withTrunk)
	if err != nil {
		return nil, err
	}
	out := make(map[string]*numbers.Number, len(list))
	for _, n := range list {
		out[n.GetRef()] = n
	}
	return out, nil
}

// domains maps Domain rows with the ACL and the egress policies, each with
// its Number. An Agent's Domain carries the Numbers' Trunks too, since
// AgentManager included them and Connect routes agent-to-PSTN calls through
// them; a Domain read on its own does not, as DomainManager included none.
func (l *pgLoader) domains(rows []*domainRow, top, numbersWithTrunk bool) ([]*domains.Domain, error) {
	acls, err := l.aclsByRef(refsOf(rows, func(r *domainRow) *string { return r.aclRef }), false)
	if err != nil {
		return nil, err
	}
	domainRefs := make([]string, 0, len(rows))
	for _, r := range rows {
		domainRefs = append(domainRefs, r.ref)
	}
	policies, err := byRefs(l, egressPolicyColumns, "egress_policies", "domain_ref", domainRefs, scanEgressPolicy, func(p *egressPolicyRow) string { return p.domainRef })
	if err != nil {
		return nil, err
	}
	var numberRefs []string
	for _, list := range policies {
		for _, p := range list {
			numberRefs = append(numberRefs, p.numberRef)
		}
	}
	numberMap, err := l.numbersByRef(numberRefs, numbersWithTrunk)
	if err != nil {
		return nil, err
	}

	out := make([]*domains.Domain, 0, len(rows))
	for _, r := range rows {
		extended, err := extendedOf(r.extended, top)
		if err != nil {
			return nil, fmt.Errorf("domain %s: %w", r.ref, err)
		}
		d := &domains.Domain{
			ApiVersion: r.apiVersion,
			Ref:        r.ref,
			Name:       r.name,
			DomainUri:  r.domainURI,
			CreatedAt:  seconds(r.createdAt),
			UpdatedAt:  seconds(r.updatedAt),
			Extended:   extended,
			Trace:      &trace.Trace{Enabled: r.traceEnabled},
		}
		if r.aclRef != nil {
			d.AccessControlList = acls[*r.aclRef]
		}
		for _, p := range policies[r.ref] {
			d.EgressPolicies = append(d.EgressPolicies, &domains.EgressPolicy{
				Rule:      p.rule,
				NumberRef: p.numberRef,
				Number:    numberMap[p.numberRef],
			})
		}
		out = append(out, d)
	}
	return out, nil
}

func (l *pgLoader) domainsByRef(refs []string) (map[string]*domains.Domain, error) {
	rows, err := byRefs(l, domainColumns, "domains", "ref", refs, scanDomain, func(r *domainRow) string { return r.ref })
	if err != nil {
		return nil, err
	}
	flat := make([]*domainRow, 0, len(rows))
	for _, list := range rows {
		flat = append(flat, list[0])
	}
	list, err := l.domains(flat, false, true)
	if err != nil {
		return nil, err
	}
	out := make(map[string]*domains.Domain, len(list))
	for _, d := range list {
		out[d.GetRef()] = d
	}
	return out, nil
}

// agents maps Agent rows with the Domain and the Credentials.
func (l *pgLoader) agents(rows []*agentRow) ([]proto.Message, error) {
	domainMap, err := l.domainsByRef(refsOf(rows, func(r *agentRow) *string { return r.domainRef }))
	if err != nil {
		return nil, err
	}
	creds, err := l.credentialsByRef(refsOf(rows, func(r *agentRow) *string { return r.credentialsRef }))
	if err != nil {
		return nil, err
	}
	out := make([]proto.Message, 0, len(rows))
	for _, r := range rows {
		extended, err := extendedOf(r.extended, true)
		if err != nil {
			return nil, fmt.Errorf("agent %s: %w", r.ref, err)
		}
		a := &agents.Agent{
			ApiVersion:  r.apiVersion,
			Ref:         r.ref,
			Name:        r.name,
			Username:    r.username,
			Privacy:     privacyOfColumn(r.privacy),
			Enabled:     r.enabled,
			CreatedAt:   seconds(r.createdAt),
			UpdatedAt:   seconds(r.updatedAt),
			MaxContacts: r.maxContacts,
			Expires:     r.expires,
			Extended:    extended,
			Trace:       &trace.Trace{Enabled: r.traceEnabled},
		}
		if r.domainRef != nil {
			a.Domain = domainMap[*r.domainRef]
		}
		if r.credentialsRef != nil {
			a.Credentials = creds[*r.credentialsRef]
		}
		out = append(out, a)
	}
	return out, nil
}

// peers maps Peer rows with the ACL and the Credentials.
func (l *pgLoader) peers(rows []*peerRow) ([]proto.Message, error) {
	acls, err := l.aclsByRef(refsOf(rows, func(r *peerRow) *string { return r.aclRef }), false)
	if err != nil {
		return nil, err
	}
	creds, err := l.credentialsByRef(refsOf(rows, func(r *peerRow) *string { return r.credentialsRef }))
	if err != nil {
		return nil, err
	}
	out := make([]proto.Message, 0, len(rows))
	for _, r := range rows {
		extended, err := extendedOf(r.extended, true)
		if err != nil {
			return nil, fmt.Errorf("peer %s: %w", r.ref, err)
		}
		p := &peers.Peer{
			ApiVersion:          r.apiVersion,
			Ref:                 r.ref,
			Name:                r.name,
			Username:            r.username,
			Aor:                 r.aor,
			ContactAddr:         stringOf(r.contactAddr),
			BalancingAlgorithm:  balancingAlgorithmOfColumn(r.balancingAlgorithm),
			WithSessionAffinity: r.withSessionAffinity,
			Enabled:             r.enabled,
			CreatedAt:           seconds(r.createdAt),
			UpdatedAt:           seconds(r.updatedAt),
			MaxContacts:         r.maxContacts,
			Expires:             r.expires,
			Extended:            extended,
			Trace:               &trace.Trace{Enabled: r.traceEnabled},
		}
		if r.aclRef != nil {
			p.AccessControlList = acls[*r.aclRef]
		}
		if r.credentialsRef != nil {
			p.Credentials = creds[*r.credentialsRef]
		}
		out = append(out, p)
	}
	return out, nil
}

// seconds is a timestamp as the wire carries it: Unix seconds in an int32,
// the whole part of pgdata's getTime() / 1000.
func seconds(t time.Time) int32 { return int32(t.Unix()) }

func stringOf(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// privacyOfColumn maps the stored Privacy ('NONE' or 'ID') to the enum.
func privacyOfColumn(value string) agents.Privacy {
	if value == "ID" {
		return agents.Privacy_PRIVATE
	}
	return agents.Privacy_NONE
}

// balancingAlgorithmOfColumn maps the stored algorithm, or NULL, to the enum.
func balancingAlgorithmOfColumn(value *string) peers.LoadBalancingAlgorithm {
	if value == nil {
		return peers.LoadBalancingAlgorithm_UNSPECIFIED
	}
	if v, ok := peers.LoadBalancingAlgorithm_value[*value]; ok {
		return peers.LoadBalancingAlgorithm(v)
	}
	return peers.LoadBalancingAlgorithm_UNSPECIFIED
}

// extendedOf turns the extended JSONB column into the Struct the wire
// carries. NULL is no Struct. At the top level the JSON object becomes the
// Struct (pgdata ran pb-util's struct.encode on it). A nested resource's
// extended went to the serializer as a plain object, which protobufjs read
// as a Struct with no fields: an empty Struct, present on the wire.
func extendedOf(raw []byte, top bool) (*structpb.Struct, error) {
	if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, nil
	}
	if !top {
		return &structpb.Struct{}, nil
	}
	var fields map[string]any
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, fmt.Errorf("extended is not a JSON object: %w", err)
	}
	s, err := structpb.NewStruct(fields)
	if err != nil {
		return nil, fmt.Errorf("extended: %w", err)
	}
	return s, nil
}

// extraHeadersOf decodes the extra_headers JSONB column: a list of
// {name, value}, or NULL for none.
func extraHeadersOf(raw []byte) ([]*numbers.ExtraHeader, error) {
	if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, nil
	}
	var list []struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("extra_headers is not a JSON list of headers: %w", err)
	}
	out := make([]*numbers.ExtraHeader, 0, len(list))
	for _, h := range list {
		out = append(out, &numbers.ExtraHeader{Name: h.Name, Value: h.Value})
	}
	return out, nil
}
