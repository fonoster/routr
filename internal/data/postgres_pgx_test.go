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
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
)

// TestPostgresAgainstADatabase runs against a real Routr 2 database,
// migrated with mods/pgdata's migrations on main (the Go CI job applies
// them): it inserts one of everything with plain SQL, reads it back as the
// DTOs Connect and the SDK see, and runs every query shape, so the column
// names, the parameter types and the cursor query are proven against the
// schema, not the fake. It needs TEST_DATABASE_URL and leaves the database
// as it found it.
func TestPostgresAgainstADatabase(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	// Registered before the fixtures' cleanup, so it runs after it
	t.Cleanup(pool.Close)
	fx := insertFixtures(t, ctx, pool)

	store, err := OpenPostgres(ctx, url, Identity{})
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	t.Run("an Agent with its Domain, Credentials and egress Trunk", func(t *testing.T) {
		msg, err := store.Get(ctx, KindAgent, fx.ref("ag1"))
		if err != nil {
			t.Fatal(err)
		}
		agent := msg.(*agents.Agent)
		if agent.GetApiVersion() != "v2" || agent.GetUsername() != fx.ref("1001") || agent.GetName() != "John Doe" {
			t.Errorf("agent = %v", agent)
		}
		if agent.GetPrivacy() != agents.Privacy_PRIVATE || !agent.GetEnabled() || agent.GetMaxContacts() != -1 || agent.GetExpires() != 3600 {
			t.Errorf("agent scalars = %v", agent)
		}
		if !agent.GetTrace().GetEnabled() || agent.GetCreatedAt() == 0 || agent.GetUpdatedAt() == 0 {
			t.Errorf("agent trace/timestamps = %v", agent)
		}
		if got := agent.GetExtended().AsMap(); got["tier"] != "gold" {
			t.Errorf("extended = %v", got)
		}
		if agent.GetCredentials().GetUsername() != "1001" || agent.GetCredentials().GetPassword() != "1234" {
			t.Errorf("credentials = %v", agent.GetCredentials())
		}
		domain := agent.GetDomain()
		if domain.GetRef() != fx.ref("d1") || domain.GetDomainUri() != fx.ref("sip.local") || domain.GetName() != "Local" {
			t.Fatalf("domain = %v", domain)
		}
		acl := domain.GetAccessControlList()
		if acl.GetName() != "Europe ACL" || len(acl.GetAllow()) != 2 || acl.GetAllow()[0] != "192.168.1.3/31" || acl.GetDeny()[0] != "0.0.0.0/1" {
			t.Errorf("acl = %v", acl)
		}
		if len(domain.GetEgressPolicies()) != 1 {
			t.Fatalf("egress policies = %v", domain.GetEgressPolicies())
		}
		policy := domain.GetEgressPolicies()[0]
		if policy.GetRule() != ".*" || policy.GetNumberRef() != fx.ref("n1") || policy.GetNumber().GetTelUrl() != fx.telURL {
			t.Errorf("policy = %v", policy)
		}
		number := policy.GetNumber()
		if number.GetCity() != "Columbus, GA" || number.GetCountryIsoCode() != "US" || number.GetAorLink() != "sip:conference@sip.local" {
			t.Errorf("number = %v", number)
		}
		if len(number.GetExtraHeaders()) != 1 || number.GetExtraHeaders()[0].GetName() != "X-Room-Id" {
			t.Errorf("extra headers = %v", number.GetExtraHeaders())
		}
		trunk := number.GetTrunk()
		if trunk.GetRef() != fx.ref("t1") || !trunk.GetSendRegister() || !trunk.GetNormalizeToE164() || trunk.GetRewriteFromWithNumber() || trunk.GetInboundUri() != fx.ref("trunk01.acme.com") {
			t.Fatalf("trunk = %v", trunk)
		}
		if trunk.GetOutboundCredentials().GetUsername() != "pbx-1" || trunk.GetOutboundCredentials().GetPassword() != "secret" || trunk.GetInboundCredentials().GetRef() != fx.ref("c2") {
			t.Errorf("trunk credentials = %v", trunk)
		}
		if trunk.GetAccessControlList().GetRef() != fx.ref("acl") {
			t.Errorf("trunk acl = %v", trunk.GetAccessControlList())
		}
		if len(trunk.GetUris()) != 1 {
			t.Fatalf("trunk uris = %v", trunk.GetUris())
		}
		uri := trunk.GetUris()[0]
		if uri.GetHost() != "sip.provider.net" || uri.GetPort() != 7060 || uri.GetTransport() != "UDP" || uri.GetUser() != "pbx-1" || uri.GetWeight() != 10 || uri.GetPriority() != 10 || !uri.GetEnabled() {
			t.Errorf("trunk uri = %v", uri)
		}
	})

	t.Run("a Peer with its Credentials and ACL", func(t *testing.T) {
		msg, err := store.Get(ctx, KindPeer, fx.ref("p1"))
		if err != nil {
			t.Fatal(err)
		}
		peer := msg.(*peers.Peer)
		if peer.GetUsername() != fx.ref("asterisk") || peer.GetAor() != "sip:conference@sip.local" || peer.GetContactAddr() != "10.0.0.1:5060" {
			t.Errorf("peer = %v", peer)
		}
		if peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_LEAST_SESSIONS || !peer.GetWithSessionAffinity() || peer.GetExpires() != 600 {
			t.Errorf("peer load balancing = %v", peer)
		}
		if peer.GetCredentials().GetUsername() != "pbx-1" || peer.GetAccessControlList().GetName() != "Europe ACL" {
			t.Errorf("peer includes = %v", peer)
		}
	})

	t.Run("FindBy on text, boolean and enum columns", func(t *testing.T) {
		items, err := store.FindBy(ctx, KindAgent, "username", fx.ref("1001"))
		if err != nil || len(items) != 1 || refOf(items[0]) != fx.ref("ag1") {
			t.Errorf("FindBy(username) = %v, %v", items, err)
		}
		items, err = store.FindBy(ctx, KindDomain, "domainUri", fx.ref("sip.local"))
		if err != nil || len(items) != 1 || refOf(items[0]) != fx.ref("d1") {
			t.Errorf("FindBy(domainUri) = %v, %v", items, err)
		}
		items, err = store.FindBy(ctx, KindTrunk, "inboundUri", fx.ref("trunk01.acme.com"))
		if err != nil || len(items) != 1 || refOf(items[0]) != fx.ref("t1") {
			t.Errorf("FindBy(inboundUri) = %v, %v", items, err)
		}
		items, err = store.FindBy(ctx, KindAgent, "privacy", "PRIVATE")
		if err != nil || !hasRef(items, fx.ref("ag1")) {
			t.Errorf("FindBy(privacy) = %v, %v", items, err)
		}
		items, err = store.FindBy(ctx, KindAgent, "traceEnabled", "true")
		if err != nil || !hasRef(items, fx.ref("ag1")) {
			t.Errorf("FindBy(traceEnabled) = %v, %v", items, err)
		}
	})

	t.Run("List pages newest first through the cursor", func(t *testing.T) {
		first, err := store.List(ctx, KindCredentials, Page{Size: 1})
		if err != nil || len(first) != 1 {
			t.Fatalf("List = %v, %v", first, err)
		}
		second, err := store.List(ctx, KindCredentials, Page{Size: 1, Token: refOf(first[0])})
		if err != nil || len(second) != 1 || refOf(second[0]) == refOf(first[0]) {
			t.Fatalf("List after %s = %v, %v", refOf(first[0]), second, err)
		}
	})

	t.Run("every query shape of every kind", func(t *testing.T) {
		for _, kind := range Kinds {
			page, err := store.List(ctx, kind, Page{Size: 5})
			if err != nil {
				t.Fatalf("List(%s): %v", kind, err)
			}
			if len(page) == 0 {
				t.Errorf("List(%s) is empty, want the fixtures", kind)
				continue
			}
			last := refOf(page[len(page)-1])
			if _, err := store.List(ctx, kind, Page{Size: 5, Token: last}); err != nil {
				t.Errorf("List(%s) after %s: %v", kind, last, err)
			}
			if _, err := store.Get(ctx, kind, refOf(page[0])); err != nil {
				t.Errorf("Get(%s, %s): %v", kind, refOf(page[0]), err)
			}
			_, err = store.Get(ctx, kind, "no-such-ref")
			var notFound *NotFoundError
			if !errors.As(err, &notFound) {
				t.Errorf("Get(%s, no-such-ref) = %v, want NotFoundError", kind, err)
			}
			for field, col := range tables[kind].fields {
				// api_version and balancing_algorithm are enums: an unknown
				// value is a database error, not an empty answer
				value := "no-such-value"
				switch {
				case col.kind == boolColumn:
					value = "false"
				case col.kind == privacyColumn:
					value = "NONE"
				case field == "apiVersion":
					value = "v2beta1"
				case field == "balancingAlgorithm":
					value = "ROUND_ROBIN"
				}
				if _, err := store.FindBy(ctx, kind, field, value); err != nil {
					t.Errorf("FindBy(%s, %s): %v", kind, field, err)
				}
			}
		}
	})
}

// fixtures is one of everything, under a prefix unique to the run so
// concurrent or repeated runs on one database do not collide on the unique
// columns (username, domain_uri, inbound_uri, tel_url).
type fixtures struct {
	prefix string
	telURL string
}

func (f fixtures) ref(name string) string { return f.prefix + name }

// insertFixtures inserts the fixtures with plain SQL, in dependency order,
// and removes them when the test ends.
func insertFixtures(t *testing.T, ctx context.Context, pool *pgxpool.Pool) fixtures {
	t.Helper()
	now := time.Now().UnixNano()
	fx := fixtures{prefix: fmt.Sprintf("it%d-", now), telURL: fmt.Sprintf("tel:+1%010d", now%1_000_000_000_0)}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		// egress_policies and trunk_uris cascade from their owners
		for _, table := range []string{"agents", "peers", "numbers", "trunks", "domains", "credentials", "access_control_lists"} {
			if _, err := pool.Exec(ctx, `DELETE FROM `+quote(table)+` WHERE ref LIKE $1`, fx.prefix+"%"); err != nil {
				t.Errorf("cleanup %s: %v", table, err)
			}
		}
	})
	statements := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO "access_control_lists" (api_version, ref, name, allow, deny, updated_at, extended) VALUES ('v2', $1, 'Europe ACL', $2, $3, now(), '{"region": "eu"}')`,
			[]any{fx.ref("acl"), []string{"192.168.1.3/31", "127.0.0.1/8"}, []string{"0.0.0.0/1"}}},
		{`INSERT INTO "credentials" (api_version, ref, name, username, password, updated_at, extended) VALUES ('v2', $1, 'Agent Credentials', '1001', '1234', now(), '{"c": 1}')`,
			[]any{fx.ref("c1")}},
		{`INSERT INTO "credentials" (api_version, ref, name, username, password, updated_at) VALUES ('v2', $1, 'Trunk Credentials', 'pbx-1', 'secret', now())`,
			[]any{fx.ref("c2")}},
		{`INSERT INTO "domains" (api_version, ref, acl_ref, name, domain_uri, updated_at, extended, trace_enabled) VALUES ('v2', $1, $2, 'Local', $3, now(), '{"k": "v"}', false)`,
			[]any{fx.ref("d1"), fx.ref("acl"), fx.ref("sip.local")}},
		{`INSERT INTO "trunks" (api_version, ref, acl_ref, inbound_credentials_ref, outbound_credentials_ref, name, send_register, inbound_uri, updated_at, normalize_to_e164, rewrite_from_with_number, from_domain, trace_enabled) VALUES ('v2', $1, $2, $3, $3, 'Trunk', true, $4, now(), true, false, NULL, false)`,
			[]any{fx.ref("t1"), fx.ref("acl"), fx.ref("c2"), fx.ref("trunk01.acme.com")}},
		{`INSERT INTO "trunk_uris" (ref, trunk_ref, host, port, transport, "user", weight, priority, enabled) VALUES ($1, $2, 'sip.provider.net', 7060, 'UDP', 'pbx-1', 10, 10, true)`,
			[]any{fx.ref("u1"), fx.ref("t1")}},
		{`INSERT INTO "numbers" (api_version, ref, trunk_ref, tel_url, name, aor_link, city, country, country_iso_code, session_affinity_header, extra_headers, updated_at, extended) VALUES ('v2', $1, $2, $3, '(706)604-1487', 'sip:conference@sip.local', 'Columbus, GA', 'USA', 'US', 'X-Room-Id', '[{"name": "X-Room-Id", "value": "jsa"}]', now(), '{"e": true}')`,
			[]any{fx.ref("n1"), fx.ref("t1"), fx.telURL}},
		{`INSERT INTO "egress_policies" (ref, domain_ref, number_ref, rule) VALUES ($1, $2, $3, '.*')`,
			[]any{fx.ref("ep1"), fx.ref("d1"), fx.ref("n1")}},
		{`INSERT INTO "agents" (api_version, ref, domain_ref, credentials_ref, name, username, privacy, enabled, updated_at, extended, expires, max_contacts, trace_enabled) VALUES ('v2', $1, $2, $3, 'John Doe', $4, 'ID', true, now(), '{"tier": "gold", "n": 2}', 3600, -1, true)`,
			[]any{fx.ref("ag1"), fx.ref("d1"), fx.ref("c1"), fx.ref("1001")}},
		{`INSERT INTO "peers" (api_version, ref, credentials_ref, acl_ref, name, username, aor, contact_addr, balancing_algorithm, with_session_affinity, enabled, updated_at, expires, max_contacts, trace_enabled) VALUES ('v2', $1, $2, $3, 'Asterisk', $4, 'sip:conference@sip.local', '10.0.0.1:5060', 'LEAST_SESSIONS', true, true, now(), 600, -1, false)`,
			[]any{fx.ref("p1"), fx.ref("c2"), fx.ref("acl"), fx.ref("asterisk")}},
	}
	for _, st := range statements {
		if _, err := pool.Exec(ctx, st.sql, st.args...); err != nil {
			t.Fatalf("%s: %v", st.sql, err)
		}
	}
	return fx
}

func hasRef(items []proto.Message, ref string) bool {
	for _, item := range items {
		if refOf(item) == ref {
			return true
		}
	}
	return false
}
