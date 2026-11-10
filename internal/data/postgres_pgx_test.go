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
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/fonoster/routr/internal/common/cloak"
	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trace"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
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

	store, err := OpenPostgres(ctx, url, PostgresOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	t.Run("every write of every kind", func(t *testing.T) { testWrites(t, ctx, store, fx) })
	t.Run("a Create with what it can leave out", func(t *testing.T) { testCreateDefaults(t, ctx, store, fx) })
	t.Run("an Update of every column", func(t *testing.T) { testUpdateColumns(t, ctx, store, fx) })
	t.Run("extended on every kind", func(t *testing.T) { testExtendedWrites(t, ctx, store, fx) })
	t.Run("every unique constraint", func(t *testing.T) { testUniqueConstraints(t, ctx, store, fx) })
	t.Run("the schema's enums and lengths", func(t *testing.T) { testEnumsAndLengths(t, ctx, store, fx) })
	t.Run("an egress replace", func(t *testing.T) { testEgressReplace(t, ctx, store, fx) })
	t.Run("a delete a Trunk refuses", func(t *testing.T) { testRefusedDelete(t, ctx, store, fx) })
	t.Run("a real cipher and the startup guard", func(t *testing.T) { testCipher(t, ctx, pool, url, fx) })

	t.Run("Routr 2's URL with Prisma's schema parameter", func(t *testing.T) { testPrismaSchema(t, ctx, url, fx) })

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

// testWrites proves every write of every kind against the schema: the column
// names, the parameter types, the constraint errors, the rollback of a failed
// multi-row update. It removes what it creates.
func testWrites(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	w := store.(Writer)
	created, create := creator(t, ctx, w)
	name := func(s string) *string { return &s }

	aclMsg := create(KindACL, &acl.CreateACLRequest{Name: "W", Allow: []string{"10.0.0.0/8"}, Deny: []string{"0.0.0.0/0"}}).(*acl.AccessControlList)
	if aclMsg.GetApiVersion() != "v2" || aclMsg.GetCreatedAt() == 0 || len(aclMsg.GetAllow()) != 1 {
		t.Errorf("created ACL = %v", aclMsg)
	}
	cred := create(KindCredentials, &credentials.CreateCredentialsRequest{Name: "W", Username: "w", Password: "secret"}).(*credentials.Credentials)
	if cred.GetPassword() != "secret" {
		t.Errorf("created Credentials = %v", cred)
	}
	trunk := create(KindTrunk, &trunks.CreateTrunkRequest{
		Name: "W", InboundUri: fx.ref("w.acme.com"), AccessControlListRef: aclMsg.GetRef(), OutboundCredentialsRef: cred.GetRef(),
		Uris: []*trunks.TrunkURI{{Host: "a.acme.com", Port: 5060, Transport: "UDP", Weight: 1, Priority: 1, Enabled: ptr(true)}},
	}).(*trunks.Trunk)
	if len(trunk.GetUris()) != 1 || trunk.GetOutboundCredentials().GetRef() != cred.GetRef() {
		t.Errorf("created Trunk = %v", trunk)
	}
	number := create(KindNumber, &numbers.CreateNumberRequest{
		Name: "W", TelUrl: fx.telURL + "9", City: "C", Country: "D", CountryIsoCode: "US", TrunkRef: trunk.GetRef(),
		ExtraHeaders: []*numbers.ExtraHeader{{Name: "X-A", Value: "b"}},
	}).(*numbers.Number)
	if len(number.GetExtraHeaders()) != 1 || number.GetTrunk().GetRef() != trunk.GetRef() {
		t.Errorf("created Number = %v", number)
	}
	domain := create(KindDomain, &domains.CreateDomainRequest{
		Name: "W", DomainUri: fx.ref("w.local"),
		EgressPolicies: []*domains.EgressPolicy{{Rule: ".*", NumberRef: number.GetRef()}},
	}).(*domains.Domain)
	if len(domain.GetEgressPolicies()) != 1 {
		t.Errorf("created Domain = %v", domain)
	}
	agent := create(KindAgent, &agents.CreateAgentRequest{
		Name: "W", Username: fx.ref("w"), Privacy: agents.Privacy_PRIVATE.Enum(), Enabled: ptr(true), DomainRef: domain.GetRef(), CredentialsRef: cred.GetRef(),
	}).(*agents.Agent)
	if agent.GetPrivacy() != agents.Privacy_PRIVATE || agent.GetMaxContacts() != -1 || agent.GetDomain().GetRef() != domain.GetRef() {
		t.Errorf("created Agent = %v", agent)
	}
	peer := create(KindPeer, &peers.CreatePeerRequest{
		Name: "W", Username: fx.ref("wp"), Aor: "sip:w@sip.local", BalancingAlgorithm: peers.LoadBalancingAlgorithm_ROUND_ROBIN,
	}).(*peers.Peer)
	if peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_ROUND_ROBIN {
		t.Errorf("created Peer = %v", peer)
	}

	// The constraint errors, with what Prisma put in pgdata's messages
	_, err := w.Create(ctx, &agents.CreateAgentRequest{Name: "W", Username: fx.ref("w")})
	var exists *AlreadyExistsError
	if !errors.As(err, &exists) || exists.Message != "Resource already exist for field: username" {
		t.Errorf("duplicate Agent = %v", err)
	}
	_, err = w.Create(ctx, &agents.CreateAgentRequest{Name: "W", Username: fx.ref("w2"), DomainRef: "no-such-ref"})
	var bad *BadRequestError
	if !errors.As(err, &bad) || bad.Message != "Dependent resource doesn't exist for: agents_domain_ref_fkey" {
		t.Errorf("Agent with no Domain = %v", err)
	}

	// Update: partial, replaces the list, clears a ref
	updatedTrunk, err := w.Update(ctx, &trunks.UpdateTrunkRequest{
		Ref: trunk.GetRef(), Name: name("W2"), AccessControlListRef: name(""),
		Uris: []*trunks.TrunkURI{
			{Host: "b.acme.com", Port: 5061, Transport: "TCP", Weight: 1, Priority: 1, Enabled: ptr(true)},
			{Host: "c.acme.com", Port: 5062, Transport: "TLS", Weight: 1, Priority: 1, Enabled: ptr(true)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := updatedTrunk.(*trunks.Trunk); got.GetName() != "W2" || len(got.GetUris()) != 2 || got.GetAccessControlList() != nil || got.GetOutboundCredentials() == nil {
		t.Errorf("updated Trunk = %v", got)
	}
	if _, err := w.Update(ctx, &acl.UpdateACLRequest{Ref: "no-such-ref", Name: name("x")}); !errors.As(err, new(*NotFoundError)) {
		t.Errorf("Update of no row = %v, want NotFoundError", err)
	}

	// A failed multi-row update leaves the old rows in place
	_, err = w.Update(ctx, &domains.UpdateDomainRequest{
		Ref: domain.GetRef(), Name: name("gone"), EgressPolicies: []*domains.EgressPolicy{{Rule: "x", NumberRef: "no-such-ref"}},
	})
	if !errors.As(err, &bad) {
		t.Errorf("Update with no Number = %v, want a BadRequestError", err)
	}
	stored, err := store.Get(ctx, KindDomain, domain.GetRef())
	if err != nil {
		t.Fatal(err)
	}
	if got := stored.(*domains.Domain); got.GetName() != "W" || len(got.GetEgressPolicies()) != 1 || got.GetEgressPolicies()[0].GetRule() != ".*" {
		t.Errorf("Domain after a failed update = %v", got)
	}

	// Delete: a missing ref is no error, and the references go with the row
	if err := w.Delete(ctx, KindCredentials, "no-such-ref"); err != nil {
		t.Errorf("Delete of no row = %v", err)
	}
	if _, err := w.Update(ctx, &trunks.UpdateTrunkRequest{Ref: trunk.GetRef(), OutboundCredentialsRef: name("")}); err != nil {
		t.Fatal(err)
	}
	if err := w.Delete(ctx, KindCredentials, cred.GetRef()); err != nil {
		t.Fatal(err)
	}
	created[KindCredentials] = nil
	reread, err := store.Get(ctx, KindAgent, agent.GetRef())
	if err != nil {
		t.Fatal(err)
	}
	if reread.(*agents.Agent).GetCredentials() != nil {
		t.Errorf("Agent still has the deleted Credentials: %v", reread)
	}
}

// creator returns what a test creates through and the Create that records it;
// the test's end deletes it all, in dependency order.
func creator(t *testing.T, ctx context.Context, w Writer) (map[Kind][]string, func(Kind, proto.Message) proto.Message) {
	t.Helper()
	created := map[Kind][]string{}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		for _, kind := range []Kind{KindAgent, KindPeer, KindNumber, KindTrunk, KindDomain, KindCredentials, KindACL} {
			for _, ref := range created[kind] {
				if err := w.Delete(ctx, kind, ref); err != nil {
					t.Errorf("Delete(%s, %s): %v", kind, ref, err)
				}
			}
		}
	})
	return created, func(kind Kind, req proto.Message) proto.Message {
		t.Helper()
		msg, err := w.Create(ctx, req)
		if err != nil {
			t.Fatalf("Create(%s): %v", kind, err)
		}
		created[kind] = append(created[kind], refOf(msg))
		return msg
	}
}

// testCreateDefaults proves what a Create leaves out against the columns:
// privacy and enabled, a Trunk URI's enabled, maxContacts.
func testCreateDefaults(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	_, create := creator(t, ctx, store.(Writer))

	agent := create(KindAgent, &agents.CreateAgentRequest{Name: "D", Username: fx.ref("da")}).(*agents.Agent)
	if agent.GetPrivacy() != agents.Privacy_NONE || !agent.GetEnabled() || agent.GetMaxContacts() != -1 {
		t.Errorf("Agent with nothing optional = %v", agent)
	}
	limited := create(KindAgent, &agents.CreateAgentRequest{Name: "D", Username: fx.ref("db"), MaxContacts: ptr(int32(0))}).(*agents.Agent)
	if limited.GetMaxContacts() != 0 {
		t.Errorf("Agent with a maxContacts of 0 = %v", limited)
	}
	peer := create(KindPeer, &peers.CreatePeerRequest{Name: "D", Username: fx.ref("dp"), Aor: "sip:d@sip.local"}).(*peers.Peer)
	if !peer.GetEnabled() || peer.GetMaxContacts() != -1 || peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_UNSPECIFIED {
		t.Errorf("Peer with nothing optional = %v", peer)
	}
	limitedPeer := create(KindPeer, &peers.CreatePeerRequest{Name: "D", Username: fx.ref("dq"), Aor: "sip:d@sip.local", MaxContacts: ptr(int32(0))}).(*peers.Peer)
	if limitedPeer.GetMaxContacts() != 0 {
		t.Errorf("Peer with a maxContacts of 0 = %v", limitedPeer)
	}
	trunk := create(KindTrunk, &trunks.CreateTrunkRequest{
		Name: "D", InboundUri: fx.ref("d.acme.com"),
		Uris: []*trunks.TrunkURI{{Host: "d.acme.com", Port: 5060, Transport: "TCP", User: "pbx-9", Weight: 2, Priority: 3}},
	}).(*trunks.Trunk)
	if len(trunk.GetUris()) != 1 {
		t.Fatalf("Trunk URIs = %v", trunk.GetUris())
	}
	if uri := trunk.GetUris()[0]; !uri.GetEnabled() || uri.GetUser() != "pbx-9" || uri.GetTransport() != "TCP" || uri.GetWeight() != 2 || uri.GetPriority() != 3 {
		t.Errorf("Trunk URI with no enabled and a user = %v", uri)
	}
}

// testUpdateColumns sets every column an Update can reach on an Agent, a Peer,
// Credentials and a Number, then reads each back from the database.
func testUpdateColumns(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	w := store.(Writer)
	_, create := creator(t, ctx, w)
	extended := func() *structpb.Struct {
		t.Helper()
		value, err := structpb.NewStruct(map[string]any{"updated": "yes"})
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	update := func(req proto.Message) {
		t.Helper()
		if _, err := w.Update(ctx, req); err != nil {
			t.Fatalf("Update(%T): %v", req, err)
		}
	}
	get := func(kind Kind, ref string) proto.Message {
		t.Helper()
		msg, err := store.Get(ctx, kind, ref)
		if err != nil {
			t.Fatalf("Get(%s, %s): %v", kind, ref, err)
		}
		return msg
	}

	list := create(KindACL, &acl.CreateACLRequest{Name: "U", Allow: []string{"10.0.0.0/8"}, Deny: []string{"0.0.0.0/0"}}).(*acl.AccessControlList)
	cred := create(KindCredentials, &credentials.CreateCredentialsRequest{Name: "U", Username: "u", Password: "secret"}).(*credentials.Credentials)
	domain := create(KindDomain, &domains.CreateDomainRequest{Name: "U", DomainUri: fx.ref("u.local")}).(*domains.Domain)
	trunk := create(KindTrunk, &trunks.CreateTrunkRequest{Name: "U", InboundUri: fx.ref("u.acme.com")}).(*trunks.Trunk)

	// Agent
	ref := create(KindAgent, &agents.CreateAgentRequest{Name: "U", Username: fx.ref("ua")}).(*agents.Agent).GetRef()
	update(&agents.UpdateAgentRequest{
		Ref: ref, Name: ptr("U2"), Privacy: agents.Privacy_PRIVATE.Enum(), Enabled: ptr(false), DomainRef: ptr(domain.GetRef()), CredentialsRef: ptr(cred.GetRef()),
		MaxContacts: ptr(int32(0)), Expires: ptr(int32(600)), Trace: &trace.Trace{Enabled: true}, Extended: extended(),
	})
	agent := get(KindAgent, ref).(*agents.Agent)
	if agent.GetName() != "U2" || agent.GetPrivacy() != agents.Privacy_PRIVATE || agent.GetEnabled() || agent.GetMaxContacts() != 0 || agent.GetExpires() != 600 {
		t.Errorf("updated Agent = %v", agent)
	}
	if agent.GetDomain().GetRef() != domain.GetRef() || agent.GetCredentials().GetRef() != cred.GetRef() || !agent.GetTrace().GetEnabled() || agent.GetExtended().AsMap()["updated"] != "yes" {
		t.Errorf("updated Agent's references = %v", agent)
	}
	update(&agents.UpdateAgentRequest{Ref: ref, DomainRef: ptr(""), CredentialsRef: ptr(""), Trace: &trace.Trace{}})
	agent = get(KindAgent, ref).(*agents.Agent)
	if agent.GetDomain() != nil || agent.GetCredentials() != nil || agent.GetTrace().GetEnabled() || agent.GetName() != "U2" {
		t.Errorf("Agent with its references cleared = %v", agent)
	}

	// Peer
	ref = create(KindPeer, &peers.CreatePeerRequest{Name: "U", Username: fx.ref("up"), Aor: "sip:u@sip.local"}).(*peers.Peer).GetRef()
	update(&peers.UpdatePeerRequest{
		Ref: ref, Name: ptr("U2"), Aor: ptr("backend:u"), ContactAddr: ptr("10.0.0.2:5060"), BalancingAlgorithm: peers.LoadBalancingAlgorithm_LEAST_SESSIONS.Enum(),
		WithSessionAffinity: ptr(true), AccessControlListRef: ptr(list.GetRef()), CredentialsRef: ptr(cred.GetRef()), Enabled: ptr(false),
		MaxContacts: ptr(int32(3)), Expires: ptr(int32(600)), Trace: &trace.Trace{Enabled: true}, Extended: extended(),
	})
	peer := get(KindPeer, ref).(*peers.Peer)
	if peer.GetName() != "U2" || peer.GetAor() != "backend:u" || peer.GetContactAddr() != "10.0.0.2:5060" || peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_LEAST_SESSIONS {
		t.Errorf("updated Peer = %v", peer)
	}
	if !peer.GetWithSessionAffinity() || peer.GetEnabled() || peer.GetMaxContacts() != 3 || peer.GetExpires() != 600 || !peer.GetTrace().GetEnabled() || peer.GetExtended().AsMap()["updated"] != "yes" {
		t.Errorf("updated Peer's scalars = %v", peer)
	}
	if peer.GetAccessControlList().GetRef() != list.GetRef() || peer.GetCredentials().GetRef() != cred.GetRef() {
		t.Errorf("updated Peer's references = %v", peer)
	}
	update(&peers.UpdatePeerRequest{Ref: ref, AccessControlListRef: ptr(""), CredentialsRef: ptr("")})

	// Credentials
	ref = create(KindCredentials, &credentials.CreateCredentialsRequest{Name: "U", Username: "u", Password: "old"}).(*credentials.Credentials).GetRef()
	update(&credentials.UpdateCredentialsRequest{Ref: ref, Name: ptr("U2"), Username: ptr("u2"), Password: ptr("new"), Extended: extended()})
	stored := get(KindCredentials, ref).(*credentials.Credentials)
	if stored.GetName() != "U2" || stored.GetUsername() != "u2" || stored.GetPassword() != "new" || stored.GetExtended().AsMap()["updated"] != "yes" {
		t.Errorf("updated Credentials = %v", stored)
	}

	// Number
	ref = create(KindNumber, &numbers.CreateNumberRequest{
		Name: "U", TelUrl: fx.telURL + "8", City: "C", Country: "D", CountryIsoCode: "US",
	}).(*numbers.Number).GetRef()
	update(&numbers.UpdateNumberRequest{
		Ref: ref, Name: ptr("U2"), AorLink: ptr("sip:u@sip.local"), SessionAffinityHeader: ptr("X-Room"), TrunkRef: ptr(trunk.GetRef()),
		ExtraHeaders: []*numbers.ExtraHeader{{Name: "X-U", Value: "v"}}, Extended: extended(),
	})
	number := get(KindNumber, ref).(*numbers.Number)
	if number.GetName() != "U2" || number.GetAorLink() != "sip:u@sip.local" || number.GetSessionAffinityHeader() != "X-Room" || number.GetTrunk().GetRef() != trunk.GetRef() {
		t.Errorf("updated Number = %v", number)
	}
	if len(number.GetExtraHeaders()) != 1 || number.GetExtraHeaders()[0].GetName() != "X-U" || number.GetExtended().AsMap()["updated"] != "yes" {
		t.Errorf("updated Number's headers and extended = %v", number)
	}
	update(&numbers.UpdateNumberRequest{Ref: ref, TrunkRef: ptr("")})
	if got := get(KindNumber, ref).(*numbers.Number); got.GetTrunk() != nil || got.GetName() != "U2" {
		t.Errorf("Number with its Trunk cleared = %v", got)
	}
}

// testExtendedWrites writes extended on the Create of every kind and on the
// Update of those testUpdateColumns does not reach, and an empty object.
func testExtendedWrites(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	w := store.(Writer)
	_, create := creator(t, ctx, w)
	extended, err := structpb.NewStruct(map[string]any{"text": "v", "number": 2, "nested": map[string]any{"on": true}})
	if err != nil {
		t.Fatal(err)
	}
	check := func(kind Kind, ref string) {
		t.Helper()
		msg, err := store.Get(ctx, kind, ref)
		if err != nil {
			t.Fatalf("Get(%s, %s): %v", kind, ref, err)
		}
		field := msg.ProtoReflect().Descriptor().Fields().ByName("extended")
		got := msg.ProtoReflect().Get(field).Message().Interface().(*structpb.Struct).AsMap()
		nested, _ := got["nested"].(map[string]any)
		if got["text"] != "v" || got["number"] != float64(2) || nested["on"] != true {
			t.Errorf("%s extended = %v", kind, got)
		}
	}
	list := create(KindACL, &acl.CreateACLRequest{Name: "E", Allow: []string{"10.0.0.0/8"}, Deny: []string{"0.0.0.0/0"}, Extended: extended})
	check(KindACL, refOf(list))
	check(KindCredentials, refOf(create(KindCredentials, &credentials.CreateCredentialsRequest{Name: "E", Username: "e", Password: "p", Extended: extended})))
	domain := create(KindDomain, &domains.CreateDomainRequest{Name: "E", DomainUri: fx.ref("e.local"), Extended: extended})
	check(KindDomain, refOf(domain))
	trunk := create(KindTrunk, &trunks.CreateTrunkRequest{Name: "E", InboundUri: fx.ref("e.acme.com"), Extended: extended})
	check(KindTrunk, refOf(trunk))
	check(KindNumber, refOf(create(KindNumber, &numbers.CreateNumberRequest{Name: "E", TelUrl: fx.telURL + "7", City: "C", Country: "D", CountryIsoCode: "US", Extended: extended})))
	check(KindAgent, refOf(create(KindAgent, &agents.CreateAgentRequest{Name: "E", Username: fx.ref("ea"), Extended: extended})))
	check(KindPeer, refOf(create(KindPeer, &peers.CreatePeerRequest{Name: "E", Username: fx.ref("ep"), Aor: "sip:e@sip.local", Extended: extended})))

	// An Update replaces it, and an empty Struct is an empty object
	bare := create(KindACL, &acl.CreateACLRequest{Name: "E", Allow: []string{"10.0.0.0/8"}, Deny: []string{"0.0.0.0/0"}})
	if _, err := w.Update(ctx, &acl.UpdateACLRequest{Ref: refOf(bare), Extended: extended}); err != nil {
		t.Fatal(err)
	}
	check(KindACL, refOf(bare))
	if _, err := w.Update(ctx, &domains.UpdateDomainRequest{Ref: refOf(domain), Extended: &structpb.Struct{}}); err != nil {
		t.Fatal(err)
	}
	msg, err := store.Get(ctx, KindDomain, refOf(domain))
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.(*domains.Domain).GetExtended().AsMap(); len(got) != 0 {
		t.Errorf("Domain extended after an empty Struct = %v", got)
	}
	if _, err := w.Update(ctx, &trunks.UpdateTrunkRequest{Ref: refOf(trunk), Extended: extended}); err != nil {
		t.Fatal(err)
	}
	check(KindTrunk, refOf(trunk))
}

// testUniqueConstraints runs into each unique column on a Create, with pgdata's
// message, and into the one an Update can reach, which pgdata did not map.
func testUniqueConstraints(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	w := store.(Writer)
	_, create := creator(t, ctx, w)
	create(KindDomain, &domains.CreateDomainRequest{Name: "Q", DomainUri: fx.ref("q.local")})
	first := create(KindTrunk, &trunks.CreateTrunkRequest{Name: "Q", InboundUri: fx.ref("q1.acme.com")}).(*trunks.Trunk)
	second := create(KindTrunk, &trunks.CreateTrunkRequest{Name: "Q", InboundUri: fx.ref("q2.acme.com")}).(*trunks.Trunk)
	create(KindNumber, &numbers.CreateNumberRequest{Name: "Q", TelUrl: fx.telURL + "6", City: "C", Country: "D", CountryIsoCode: "US"})
	create(KindPeer, &peers.CreatePeerRequest{Name: "Q", Username: fx.ref("qp"), Aor: "sip:q@sip.local"})
	create(KindAgent, &agents.CreateAgentRequest{Name: "Q", Username: fx.ref("qa")})

	for _, tt := range []struct {
		name  string
		req   proto.Message
		field string
	}{
		{"domain_uri", &domains.CreateDomainRequest{Name: "Q", DomainUri: fx.ref("q.local")}, "domain_uri"},
		{"inbound_uri", &trunks.CreateTrunkRequest{Name: "Q", InboundUri: fx.ref("q1.acme.com")}, "inbound_uri"},
		{"tel_url", &numbers.CreateNumberRequest{Name: "Q", TelUrl: fx.telURL + "6", City: "C", Country: "D", CountryIsoCode: "US"}, "tel_url"},
		{"peers.username", &peers.CreatePeerRequest{Name: "Q", Username: fx.ref("qp"), Aor: "sip:q@sip.local"}, "username"},
		{"agents.username", &agents.CreateAgentRequest{Name: "Q", Username: fx.ref("qa")}, "username"},
	} {
		_, err := w.Create(ctx, tt.req)
		var exists *AlreadyExistsError
		if !errors.As(err, &exists) || exists.Message != "Resource already exist for field: "+tt.field {
			t.Errorf("duplicate %s = %v", tt.name, err)
		}
	}

	_, err := w.Update(ctx, &trunks.UpdateTrunkRequest{Ref: second.GetRef(), Name: ptr("gone"), InboundUri: ptr(first.GetInboundUri())})
	var exists *AlreadyExistsError
	if !errors.As(err, &exists) || exists.Message != "Resource already exist for field: inbound_uri" {
		t.Errorf("duplicate on Update = %v, want an AlreadyExistsError naming inbound_uri", err)
	}
	msg, err := store.Get(ctx, KindTrunk, second.GetRef())
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.(*trunks.Trunk); got.GetName() != "Q" || got.GetInboundUri() != fx.ref("q2.acme.com") {
		t.Errorf("Trunk after a duplicate on Update = %v", got)
	}
}

// testEnumsAndLengths proves against the schema what its enums and its column
// lengths decide: a transport in any case is stored as the enum's label, and a
// value a column refuses is a bad request with PostgreSQL's message, which
// leaves nothing written.
func testEnumsAndLengths(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	w := store.(Writer)
	_, create := creator(t, ctx, w)
	uri := func(transport string) []*trunks.TrunkURI {
		return []*trunks.TrunkURI{{Host: "sip.provider.net", Port: 5060, Transport: transport, Weight: 1}}
	}
	trunk := create(KindTrunk, &trunks.CreateTrunkRequest{Name: "E", InboundUri: fx.ref("e1.acme.com"), Uris: uri("udp")}).(*trunks.Trunk)
	if len(trunk.GetUris()) != 1 || trunk.GetUris()[0].GetTransport() != "UDP" {
		t.Errorf("a Trunk created with udp = %v, want UDP", trunk.GetUris())
	}
	msg, err := w.Update(ctx, &trunks.UpdateTrunkRequest{Ref: trunk.GetRef(), Uris: uri("tcp")})
	if err != nil {
		t.Fatal(err)
	}
	if uris := msg.(*trunks.Trunk).GetUris(); len(uris) != 1 || uris[0].GetTransport() != "TCP" {
		t.Errorf("a Trunk updated with tcp = %v, want TCP", uris)
	}

	long := strings.Repeat("a", 61)
	for name, write := range map[string]func() error{
		"an Agent's username of 61": func() error {
			_, err := w.Create(ctx, &agents.CreateAgentRequest{Name: "E", Username: long})
			return err
		},
		"a Trunk URI's user of 61": func() error {
			_, err := w.Update(ctx, &trunks.UpdateTrunkRequest{Ref: trunk.GetRef(), Uris: []*trunks.TrunkURI{{Host: "sip.provider.net", Port: 5060, Transport: "udp", User: long, Weight: 1}}})
			return err
		},
	} {
		err := write()
		var bad *BadRequestError
		if !errors.As(err, &bad) || bad.Message != "the database refused a value: value too long for type character varying(60)" {
			t.Errorf("%s = %v, want a BadRequestError with PostgreSQL's message", name, err)
		}
	}
	found, err := store.FindBy(ctx, KindAgent, "username", long)
	if err != nil || len(found) != 0 {
		t.Errorf("Agents after the refused Create = %v, %v", found, err)
	}
	msg, err = store.Get(ctx, KindTrunk, trunk.GetRef())
	if err != nil {
		t.Fatal(err)
	}
	if uris := msg.(*trunks.Trunk).GetUris(); len(uris) != 1 || uris[0].GetTransport() != "TCP" {
		t.Errorf("the Trunk's URIs after the refused Update = %v, want the TCP one", uris)
	}
}

// testEgressReplace replaces a Domain's egress policies: the old ones go, and
// an Update without any keeps them.
func testEgressReplace(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	w := store.(Writer)
	_, create := creator(t, ctx, w)
	number := create(KindNumber, &numbers.CreateNumberRequest{Name: "R", TelUrl: fx.telURL + "5", City: "C", Country: "D", CountryIsoCode: "US"}).(*numbers.Number)
	domain := create(KindDomain, &domains.CreateDomainRequest{
		Name: "R", DomainUri: fx.ref("r.local"),
		EgressPolicies: []*domains.EgressPolicy{{Rule: ".*", NumberRef: number.GetRef()}},
	}).(*domains.Domain)

	rules := func(d proto.Message) map[string]string {
		out := map[string]string{}
		for _, policy := range d.(*domains.Domain).GetEgressPolicies() {
			out[policy.GetRule()] = policy.GetNumberRef()
		}
		return out
	}
	updated, err := w.Update(ctx, &domains.UpdateDomainRequest{
		Ref: domain.GetRef(),
		EgressPolicies: []*domains.EgressPolicy{
			{Rule: `^\+1`, NumberRef: number.GetRef()},
			{Rule: `^\+44`, NumberRef: number.GetRef()},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	got := rules(updated)
	if len(got) != 2 || got[`^\+1`] != number.GetRef() || got[`^\+44`] != number.GetRef() {
		t.Errorf("policies after the replace = %v", got)
	}
	kept, err := w.Update(ctx, &domains.UpdateDomainRequest{Ref: domain.GetRef(), Name: ptr("R2")})
	if err != nil {
		t.Fatal(err)
	}
	if got := rules(kept); len(got) != 2 {
		t.Errorf("policies after an Update without any = %v", got)
	}
}

// testRefusedDelete deletes Credentials and an ACL a Trunk references, through
// each of its three columns: refused and left in place, until the Trunk lets go.
func testRefusedDelete(t *testing.T, ctx context.Context, store Store, fx fixtures) {
	w := store.(Writer)
	created, create := creator(t, ctx, w)
	list := create(KindACL, &acl.CreateACLRequest{Name: "X", Allow: []string{"10.0.0.0/8"}, Deny: []string{"0.0.0.0/0"}}).(*acl.AccessControlList)
	inbound := create(KindCredentials, &credentials.CreateCredentialsRequest{Name: "X", Username: "in", Password: "p"}).(*credentials.Credentials)
	outbound := create(KindCredentials, &credentials.CreateCredentialsRequest{Name: "X", Username: "out", Password: "p"}).(*credentials.Credentials)
	trunk := create(KindTrunk, &trunks.CreateTrunkRequest{
		Name: "X", InboundUri: fx.ref("x.acme.com"),
		AccessControlListRef: list.GetRef(), InboundCredentialsRef: inbound.GetRef(), OutboundCredentialsRef: outbound.GetRef(),
	}).(*trunks.Trunk)

	refuse := func(kind Kind, ref, want string) {
		t.Helper()
		err := w.Delete(ctx, kind, ref)
		var bad *BadRequestError
		if !errors.As(err, &bad) || bad.Message != want {
			t.Errorf("Delete(%s) = %v, want %q", kind, err, want)
		}
		if _, err := store.Get(ctx, kind, ref); err != nil {
			t.Errorf("Get(%s) after a refused delete: %v", kind, err)
		}
	}
	inUse := func(label, ref string) string {
		return "the " + label + " " + ref + " is in use by Trunk " + trunk.GetRef() + ": remove it from the Trunk first"
	}
	refuse(KindACL, list.GetRef(), inUse("AccessControlList", list.GetRef()))
	refuse(KindCredentials, inbound.GetRef(), inUse("Credentials", inbound.GetRef()))
	refuse(KindCredentials, outbound.GetRef(), inUse("Credentials", outbound.GetRef()))
	msg, err := store.Get(ctx, KindTrunk, trunk.GetRef())
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.(*trunks.Trunk); got.GetAccessControlList() == nil || got.GetInboundCredentials() == nil || got.GetOutboundCredentials() == nil {
		t.Errorf("Trunk after the refused deletes = %v", got)
	}

	// With the references gone the deletes go through
	if _, err := w.Update(ctx, &trunks.UpdateTrunkRequest{
		Ref: trunk.GetRef(), AccessControlListRef: ptr(""), InboundCredentialsRef: ptr(""), OutboundCredentialsRef: ptr(""),
	}); err != nil {
		t.Fatal(err)
	}
	for _, target := range []struct {
		kind Kind
		ref  string
	}{{KindACL, list.GetRef()}, {KindCredentials, inbound.GetRef()}, {KindCredentials, outbound.GetRef()}} {
		if err := w.Delete(ctx, target.kind, target.ref); err != nil {
			t.Errorf("Delete(%s) with no Trunk on it: %v", target.kind, err)
		}
		if _, err := store.Get(ctx, target.kind, target.ref); !errors.As(err, new(*NotFoundError)) {
			t.Errorf("Get(%s) after the delete = %v, want NotFoundError", target.kind, err)
		}
	}
	created[KindACL], created[KindCredentials] = nil, nil
}

// testCipher runs real cloak keys through the database: what is stored, that it
// fits the column, a key that can't open it, and the startup guard on it.
func testCipher(t *testing.T, ctx context.Context, pool *pgxpool.Pool, url string, fx fixtures) {
	spec := func(key string) config.DataSpec {
		return config.DataSpec{Backend: BackendPostgres, URL: url, EncryptionKey: key}
	}
	open := func(key string) Store {
		t.Helper()
		store, err := OpenStore(ctx, spec(key))
		if err != nil {
			t.Fatalf("OpenStore: %v", err)
		}
		t.Cleanup(func() { _ = store.Close() })
		return store
	}
	generate := func() string {
		t.Helper()
		key, err := cloak.GenerateKey()
		if err != nil {
			t.Fatal(err)
		}
		return key
	}
	column := func(ref string) string {
		t.Helper()
		var password string
		if err := pool.QueryRow(ctx, `SELECT password FROM "credentials" WHERE ref = $1`, ref).Scan(&password); err != nil {
			t.Fatal(err)
		}
		return password
	}
	password := func(msg proto.Message) string { return msg.(*credentials.Credentials).GetPassword() }

	keyed := open(generate())
	w := keyed.(Writer)
	created, create := creator(t, ctx, w)

	// A long password still fits VARCHAR(255) once cloaked
	long := strings.Repeat("p", 128)
	cred := create(KindCredentials, &credentials.CreateCredentialsRequest{Name: "K", Username: "k", Password: long})
	if password(cred) != long {
		t.Errorf("created password = %q", password(cred))
	}
	cloaked := column(refOf(cred))
	if !strings.HasPrefix(cloaked, "v1.aesgcm256.") || strings.Contains(cloaked, long) || len(cloaked) > 255 {
		t.Errorf("stored password = %q (%d long)", cloaked, len(cloaked))
	}

	// Decrypted on a read, a nested read and an Update's read back
	msg, err := keyed.Get(ctx, KindCredentials, refOf(cred))
	if err != nil || password(msg) != long {
		t.Errorf("Get = %v, %v", msg, err)
	}
	agent := create(KindAgent, &agents.CreateAgentRequest{Name: "K", Username: fx.ref("ka"), CredentialsRef: refOf(cred)}).(*agents.Agent)
	if agent.GetCredentials().GetPassword() != long {
		t.Errorf("nested password = %q", agent.GetCredentials().GetPassword())
	}
	msg, err = w.Update(ctx, &credentials.UpdateCredentialsRequest{Ref: refOf(cred), Password: ptr("changed")})
	if err != nil || password(msg) != "changed" {
		t.Errorf("Update = %v, %v", msg, err)
	}
	changed := column(refOf(cred))
	if !strings.HasPrefix(changed, "v1.aesgcm256.") || changed == cloaked {
		t.Errorf("stored password after the Update = %q", changed)
	}

	// A password written before the key was set is served as it is
	msg, err = keyed.Get(ctx, KindCredentials, fx.ref("c1"))
	if err != nil || password(msg) != "1234" {
		t.Errorf("Get of a plain password = %v, %v", msg, err)
	}

	// Another key can't open it: served as stored, on a read and on a write
	other := open(generate())
	msg, err = other.Get(ctx, KindCredentials, refOf(cred))
	if err != nil || password(msg) != changed {
		t.Errorf("Get with another key = %v, %v", msg, err)
	}
	msg, err = other.(Writer).Update(ctx, &credentials.UpdateCredentialsRequest{Ref: refOf(cred), Name: ptr("K2")})
	if err != nil || password(msg) != changed || msg.(*credentials.Credentials).GetName() != "K2" {
		t.Errorf("Update with another key = %v, %v", msg, err)
	}
	if column(refOf(cred)) != changed {
		t.Error("an Update of the name changed the stored password")
	}

	// The guard: no key with a cloaked password in the table
	_, err = OpenStore(ctx, spec(""))
	if err == nil || !strings.Contains(err.Error(), "spec.data.encryptionKey") || strings.Contains(err.Error(), changed) {
		t.Errorf("OpenStore with no key over a cloaked password = %v", err)
	}

	// and without one: it opens and warns
	if err := w.Delete(ctx, KindAgent, agent.GetRef()); err != nil {
		t.Fatal(err)
	}
	if err := w.Delete(ctx, KindCredentials, refOf(cred)); err != nil {
		t.Fatal(err)
	}
	created[KindAgent], created[KindCredentials] = nil, nil
	var logged bytes.Buffer
	store, err := OpenStoreWithLogger(ctx, spec(""), slog.New(slog.NewTextHandler(&logged, nil)))
	if err != nil {
		t.Fatalf("OpenStore with no key over plain passwords: %v", err)
	}
	defer store.Close()
	if got := logged.String(); !strings.Contains(got, "level=WARN") || !strings.Contains(got, "plain text") {
		t.Errorf("log = %q", got)
	}
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

// testPrismaSchema opens the database with the URL Routr 2 wrote: ?schema=public
// finds the tables, and another schema is what the queries really search.
func testPrismaSchema(t *testing.T, ctx context.Context, url string, fx fixtures) {
	withSchema := func(schema string) string {
		sep := "?"
		if strings.Contains(url, "?") {
			sep = "&"
		}
		return url + sep + "schema=" + schema
	}
	store, err := OpenPostgres(ctx, withSchema("public"), PostgresOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	if _, err := store.Get(ctx, KindAgent, fx.ref("ag1")); err != nil {
		t.Errorf("?schema=public finds the tables: %v", err)
	}

	empty, err := OpenPostgres(ctx, withSchema("routr_no_such_schema"), PostgresOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer empty.Close()
	if _, err := empty.Get(ctx, KindAgent, fx.ref("ag1")); err == nil {
		t.Error("the schema decides where the tables are looked for")
	}
}
