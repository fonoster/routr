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
	"path/filepath"
	"strings"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// sampleResources is the set the compose stack serves through simpledata.
const sampleResources = "../../config/resources"

func loadSample(t *testing.T) Store {
	t.Helper()
	s, err := NewFiles(sampleResources)
	if err != nil {
		t.Fatalf("NewFiles(%s): %v", sampleResources, err)
	}
	return s
}

// writeResources writes one resources file into a fresh directory.
func writeResources(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "resources.yaml"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestNewFilesLoadsTheSampleResources(t *testing.T) {
	s := loadSample(t)
	ctx := context.Background()

	msg, err := s.Get(ctx, KindAgent, "agent-01")
	if err != nil {
		t.Fatalf("Get agent-01: %v", err)
	}
	agent := msg.(*agents.Agent)
	if agent.GetUsername() != "1001" || agent.GetPrivacy() != agents.Privacy_PRIVATE {
		t.Errorf("agent-01 = %v", agent)
	}
	if agent.GetMaxContacts() != -1 {
		t.Errorf("maxContacts = %d, want -1 (unlimited) when absent", agent.GetMaxContacts())
	}
	if agent.GetCredentials().GetPassword() != "1234" {
		t.Errorf("credentials not embedded: %v", agent.GetCredentials())
	}
	if agent.GetCreatedAt() == 0 || agent.GetCreatedAt() != agent.GetUpdatedAt() {
		t.Errorf("timestamps = %d/%d, want the load time", agent.GetCreatedAt(), agent.GetUpdatedAt())
	}
	domain := agent.GetDomain()
	// The sample Domain has no ACL: config/resources serves the dev stack and SEET from any address
	if domain.GetDomainUri() != "sip.local" || domain.GetAccessControlList() != nil {
		t.Fatalf("domain not embedded: %v", domain)
	}
	// Connect routes agent-to-PSTN calls through the trunk of the egress
	// policy's number, so the whole chain must be there
	if len(domain.GetEgressPolicies()) != 3 {
		t.Fatalf("egress policies = %v", domain.GetEgressPolicies())
	}
	tls := domain.GetEgressPolicies()[0]
	if tls.GetRule() != "^12225554000$" || tls.GetNumberRef() != "number-07" {
		t.Errorf("policy = %v", tls)
	}
	trunk := tls.GetNumber().GetTrunk()
	if trunk.GetRef() != "trunk-04" || len(trunk.GetUris()) != 1 || trunk.GetUris()[0].GetTransport() != "TLS" {
		t.Errorf("trunk of the egress number = %v", trunk)
	}
	if trunk.GetOutboundCredentials().GetUsername() != "pbx-1" {
		t.Errorf("outbound credentials = %v", trunk.GetOutboundCredentials())
	}

	msg, err = s.Get(ctx, KindAgent, "agent-02")
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.(*agents.Agent).GetPrivacy(); got != agents.Privacy_NONE {
		t.Errorf("agent-02 privacy = %v, want NONE", got)
	}
}

func TestFilesMapsEveryKind(t *testing.T) {
	s := loadSample(t)
	ctx := context.Background()

	msg, err := s.Get(ctx, KindTrunk, "trunk-02")
	if err != nil {
		t.Fatal(err)
	}
	trunk := msg.(*trunks.Trunk)
	if !trunk.GetNormalizeToE164() || !trunk.GetRewriteFromWithNumber() {
		t.Errorf("trunk-02 identity flags = %v", trunk)
	}
	if trunk.GetInboundUri() != "trunk02.acme.com" || trunk.GetInboundCredentials().GetRef() != "credentials-04" {
		t.Errorf("trunk-02 inbound = %v", trunk)
	}
	if trunk.GetAccessControlList().GetRef() != "acl-01" || len(trunk.GetAccessControlList().GetAllow()) != 3 {
		t.Errorf("trunk-02 acl = %v", trunk.GetAccessControlList())
	}
	uri := trunk.GetUris()[0]
	if uri.GetHost() != "sip.provider.net" || uri.GetPort() != 7060 || uri.GetTransport() != "UDP" || uri.GetWeight() != 10 || !uri.GetEnabled() {
		t.Errorf("trunk-02 uri = %v", uri)
	}
	msg, err = s.Get(ctx, KindTrunk, "trunk-01")
	if err != nil {
		t.Fatal(err)
	}
	if !msg.(*trunks.Trunk).GetSendRegister() {
		t.Error("trunk-01 sendRegister should be true")
	}

	msg, err = s.Get(ctx, KindNumber, "number-01")
	if err != nil {
		t.Fatal(err)
	}
	number := msg.(*numbers.Number)
	if number.GetTelUrl() != "tel:+17066041487" || number.GetCity() != "Columbus, GA" || number.GetCountryIsoCode() != "US" {
		t.Errorf("number-01 = %v", number)
	}
	if number.GetSessionAffinityHeader() != "X-Room-Id" || len(number.GetExtraHeaders()) != 1 || number.GetExtraHeaders()[0].GetValue() != "jsa-shqm-iyo" {
		t.Errorf("number-01 headers = %v", number)
	}
	if number.GetTrunk().GetRef() != "trunk-01" {
		t.Errorf("number-01 trunk = %v", number.GetTrunk())
	}

	msg, err = s.Get(ctx, KindPeer, "peer-01")
	if err != nil {
		t.Fatal(err)
	}
	peer := msg.(*peers.Peer)
	if peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_LEAST_SESSIONS || !peer.GetWithSessionAffinity() {
		t.Errorf("peer-01 load balancing = %v", peer)
	}
	if peer.GetCredentials().GetUsername() != "asterisk" || peer.GetMaxContacts() != -1 {
		t.Errorf("peer-01 = %v", peer)
	}
	msg, err = s.Get(ctx, KindPeer, "peer-02")
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.(*peers.Peer).GetBalancingAlgorithm(); got != peers.LoadBalancingAlgorithm_ROUND_ROBIN {
		t.Errorf("peer-02 algorithm = %v", got)
	}

	msg, err = s.Get(ctx, KindDomain, "domain-01")
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.(*domains.Domain); got.GetEgressPolicies()[2].GetNumber().GetRef() != "number-01" {
		t.Errorf("domain-01 = %v", got)
	}
	if _, err := s.Get(ctx, KindACL, "acl-01"); err != nil {
		t.Error(err)
	}
	if _, err := s.Get(ctx, KindCredentials, "credentials-05"); err != nil {
		t.Error(err)
	}
}

func TestFilesGetReturnsACopy(t *testing.T) {
	s := loadSample(t)
	first, _ := s.Get(context.Background(), KindAgent, "agent-01")
	first.(*agents.Agent).Name = "changed"
	second, _ := s.Get(context.Background(), KindAgent, "agent-01")
	if second.(*agents.Agent).GetName() != "John Doe" {
		t.Error("Get handed out the stored message, not a copy")
	}
}

func TestFilesGetNotFound(t *testing.T) {
	s := loadSample(t)
	_, err := s.Get(context.Background(), KindCredentials, "credentials-01xxxx")
	var notFound *NotFoundError
	if !errors.As(err, &notFound) || notFound.Ref != "credentials-01xxxx" {
		t.Errorf("err = %v, want NotFoundError", err)
	}
	if _, err := s.Get(context.Background(), Kind("bogus"), "x"); err == nil {
		t.Error("unknown kind should fail")
	}
}

func TestFilesFindBy(t *testing.T) {
	s := loadSample(t)
	ctx := context.Background()
	tests := []struct {
		kind  Kind
		field string
		value string
		refs  []string
	}{
		{KindAgent, "username", "1001", []string{"agent-01"}},
		{KindAgent, "ref", "agent-02", []string{"agent-02"}},
		{KindAgent, "domainRef", "domain-01", []string{"agent-01", "agent-02"}},
		{KindPeer, "aor", "sip:conference@sip.local", []string{"peer-01"}},
		{KindPeer, "username", "freeswitch", []string{"peer-02"}},
		{KindDomain, "domainUri", "sip.local", []string{"domain-01"}},
		{KindNumber, "telUrl", "tel:+18295863314", []string{"number-03"}},
		{KindNumber, "trunkRef", "trunk-02", []string{"number-03", "number-06"}},
		{KindTrunk, "inboundUri", "trunk03.acme.com", []string{"trunk-03"}},
		// The registry asks with a boolean, which arrives as its string
		{KindTrunk, "sendRegister", "true", []string{"trunk-01", "trunk-05"}},
		{KindTrunk, "sendRegister", "false", []string{"trunk-02", "trunk-03", "trunk-04"}},
		{KindAgent, "username", "9999", nil},
		{KindAgent, "noSuchField", "1001", nil},
		{KindAgent, "domain", "[object Object]", nil},
	}
	for _, tt := range tests {
		items, err := s.FindBy(ctx, tt.kind, tt.field, tt.value)
		if err != nil {
			t.Fatalf("FindBy(%s, %s=%s): %v", tt.kind, tt.field, tt.value, err)
		}
		var refs []string
		for _, item := range items {
			refs = append(refs, refOf(item))
		}
		if strings.Join(refs, ",") != strings.Join(tt.refs, ",") {
			t.Errorf("FindBy(%s, %s=%s) = %v, want %v", tt.kind, tt.field, tt.value, refs, tt.refs)
		}
	}
}

func TestFilesList(t *testing.T) {
	s := loadSample(t)
	ctx := context.Background()

	all, err := s.List(ctx, KindNumber, Page{Size: 100})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 7 || refOf(all[0]) != "number-01" || refOf(all[6]) != "number-07" {
		t.Fatalf("List = %d items, want all 7 in file order", len(all))
	}
	whole, err := s.List(ctx, KindNumber, Page{})
	if err != nil || len(whole) != 7 {
		t.Fatalf("List of size 0 = %v, %v; want all 7", whole, err)
	}
	rest, err := s.List(ctx, KindNumber, Page{Token: "number-05"})
	if err != nil || len(rest) != 2 || refOf(rest[0]) != "number-06" {
		t.Fatalf("List of size 0 after a token = %v, %v; want the last two", rest, err)
	}
	last, err := s.List(ctx, KindNumber, Page{Size: -2})
	if err != nil || len(last) != 2 || refOf(last[0]) != "number-06" || refOf(last[1]) != "number-07" {
		t.Fatalf("List of size -2 = %v, %v; want the last two", last, err)
	}
	before, err := s.List(ctx, KindNumber, Page{Size: -2, Token: "number-02"})
	if err != nil || len(before) != 1 || refOf(before[0]) != "number-01" {
		t.Fatalf("List of size -2 before number-02 = %v, %v; want number-01", before, err)
	}

	page, err := s.List(ctx, KindNumber, Page{Size: 3})
	if err != nil {
		t.Fatal(err)
	}
	if len(page) != 3 || refOf(page[2]) != "number-03" {
		t.Fatalf("first page = %d items ending at %s", len(page), refOf(page[len(page)-1]))
	}
	page, err = s.List(ctx, KindNumber, Page{Size: 3, Token: "number-03"})
	if err != nil {
		t.Fatal(err)
	}
	if len(page) != 3 || refOf(page[0]) != "number-04" || refOf(page[2]) != "number-06" {
		t.Fatalf("second page = %v", page)
	}
	page, err = s.List(ctx, KindNumber, Page{Size: 3, Token: "number-06"})
	if err != nil {
		t.Fatal(err)
	}
	if len(page) != 1 || refOf(page[0]) != "number-07" {
		t.Fatalf("last page = %v", page)
	}
	page, err = s.List(ctx, KindNumber, Page{Size: 3, Token: "number-07"})
	if err != nil || len(page) != 0 {
		t.Fatalf("page after the last = %v, %v; want empty", page, err)
	}
	page, err = s.List(ctx, KindNumber, Page{Size: 3, Token: "no-such-ref"})
	if err != nil || len(page) != 0 {
		t.Fatalf("page after an unknown cursor = %v, %v; want empty", page, err)
	}
}

func TestFilesRejectsBadDirectories(t *testing.T) {
	if _, err := NewFiles(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Error("a missing directory should fail")
	}
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := NewFiles(dir); err == nil || !strings.Contains(err.Error(), "does not exist") {
		t.Errorf("a directory entry should fail as simpledata's readConfigFile did, got %v", err)
	}
	dir = writeResources(t, "{ not yaml: [")
	if _, err := NewFiles(dir); err == nil || !strings.Contains(err.Error(), "not a valid JSON or YAML") {
		t.Errorf("unparsable file: %v", err)
	}
	dir = writeResources(t, "apiVersion: v2beta1\nkind: Agent\n")
	if _, err := NewFiles(dir); err == nil || !strings.Contains(err.Error(), "list of resources") {
		t.Errorf("a file that is not a list: %v", err)
	}
}

func TestFilesAcceptsEmptyFilesAndJSON(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "empty.yaml"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	jsonFile := `[{"apiVersion": "v2", "kind": "Credentials", "ref": "c1",
	  "metadata": {"name": "c"}, "spec": {"credentials": {"username": "user1", "password": "p"}}}]`
	if err := os.WriteFile(filepath.Join(dir, "creds.json"), []byte(jsonFile), 0o644); err != nil {
		t.Fatal(err)
	}
	s, err := NewFiles(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get(context.Background(), KindCredentials, "c1"); err != nil {
		t.Error(err)
	}
}

func TestFilesRejectsBadReferences(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    string
	}{
		{
			"spaces in a ref",
			"- apiVersion: v2beta1\n  kind: Agent\n  ref: agent 01\n  metadata: {name: a}\n  spec: {username: user1}\n",
			`resource type agent has spaces in the reference: "agent 01"`,
		},
		{
			"duplicated refs",
			"- apiVersion: v2beta1\n  kind: Credentials\n  ref: c1\n  metadata: {name: a}\n  spec: {credentials: {username: user1, password: p}}\n" +
				"- apiVersion: v2beta1\n  kind: Credentials\n  ref: c1\n  metadata: {name: b}\n  spec: {credentials: {username: user2, password: p}}\n",
			"found duplicated references: c1",
		},
		{
			"a ref that names nothing",
			"- apiVersion: v2beta1\n  kind: Agent\n  ref: a1\n  metadata: {name: a}\n  spec: {username: user1, domainRef: nope}\n",
			"the resource with ref nope does not exist in the configuration file",
		},
		{
			"a ref of the wrong kind",
			"- apiVersion: v2beta1\n  kind: Agent\n  ref: a1\n  metadata: {name: a}\n  spec: {username: user1, domainRef: c1}\n" +
				"- apiVersion: v2beta1\n  kind: Credentials\n  ref: c1\n  metadata: {name: b}\n  spec: {credentials: {username: user2, password: p}}\n",
			"the resource with ref c1 is a credentials, not a domain",
		},
		{
			"an unknown kind",
			"- apiVersion: v2beta1\n  kind: Gateway\n  ref: g1\n  metadata: {name: a}\n  spec: {}\n",
			"found a bad resource: must be equal to one of the allowed values at `/kind`",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewFiles(writeResources(t, tt.content))
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("err = %v, want %q", err, tt.want)
			}
		})
	}
}

func TestFilesDefaults(t *testing.T) {
	content := "- apiVersion: v2beta1\n  kind: agent\n  ref: a1\n  metadata: {name: a}\n  spec: {username: user1, maxContacts: 0, expires: 60, enabled: true, trace: {enabled: true}}\n" +
		"- apiVersion: v2beta1\n  kind: Peer\n  ref: p1\n  metadata: {name: p}\n  spec: {username: peer1, aor: sip:p@sip.local}\n" +
		"- apiVersion: v2beta1\n  kind: Trunk\n  ref: t1\n  metadata: {name: t}\n  spec: {}\n" +
		"- apiVersion: v2beta1\n  kind: AccessControlList\n  ref: acl1\n  metadata: {name: acl}\n  spec: {}\n"
	s, err := NewFiles(writeResources(t, content))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	msg, _ := s.Get(ctx, KindAgent, "a1")
	agent := msg.(*agents.Agent)
	// A zero maxContacts is a hard limit, not unlimited
	if agent.GetMaxContacts() != 0 || agent.GetExpires() != 60 || !agent.GetEnabled() || !agent.GetTrace().GetEnabled() {
		t.Errorf("agent = %v", agent)
	}
	if agent.GetPrivacy() != agents.Privacy_NONE || agent.GetDomain() != nil || agent.GetCredentials() != nil {
		t.Errorf("agent defaults = %v", agent)
	}
	msg, _ = s.Get(ctx, KindPeer, "p1")
	peer := msg.(*peers.Peer)
	if peer.GetMaxContacts() != -1 || peer.GetEnabled() || peer.GetBalancingAlgorithm() != peers.LoadBalancingAlgorithm_UNSPECIFIED || peer.GetTrace() != nil {
		t.Errorf("peer defaults = %v", peer)
	}
	msg, _ = s.Get(ctx, KindTrunk, "t1")
	trunk := msg.(*trunks.Trunk)
	if trunk.GetSendRegister() || trunk.GetInboundUri() != "" || len(trunk.GetUris()) != 0 || trunk.GetNormalizeToE164() {
		t.Errorf("trunk defaults = %v", trunk)
	}
	msg, _ = s.Get(ctx, KindACL, "acl1")
	if proto.Size(msg) == 0 {
		t.Error("acl should carry its name and ref")
	}
}

func TestResourceValidate(t *testing.T) {
	ok := func() *resource {
		return &resource{APIVersion: "v2beta1", Kind: "Credentials", Ref: "c1",
			Metadata: metadata{Name: "c"},
			Spec:     resourceSpec{Credentials: &credentialsSpec{Username: "user1", Password: "p"}}}
	}
	if err := ok().validate(); err != nil {
		t.Fatalf("valid resource: %v", err)
	}
	enabled := true
	port := int32(70000)
	weight := int32(0)
	tests := []struct {
		name string
		mod  func(r *resource)
		path string
	}{
		{"apiVersion", func(r *resource) { r.APIVersion = "v1" }, "/apiVersion"},
		{"ref", func(r *resource) { r.Ref = "" }, "/ref"},
		{"name", func(r *resource) { r.Metadata.Name = "" }, "/metadata"},
		{"long name", func(r *resource) { r.Metadata.Name = strings.Repeat("x", 61) }, "/metadata/name"},
		{"trace without enabled", func(r *resource) { r.Spec.Trace = &traceSettings{} }, "/spec/trace"},
		{"credentials missing", func(r *resource) { r.Spec.Credentials = nil }, "/spec"},
		{"credentials username", func(r *resource) { r.Spec.Credentials.Username = "" }, "/spec/credentials"},
		{"credentials short username", func(r *resource) { r.Spec.Credentials.Username = "abc" }, "/spec/credentials/username"},
		{"credentials password", func(r *resource) { r.Spec.Credentials.Password = "" }, "/spec/credentials"},
		{"agent username", func(r *resource) { r.Kind = "Agent"; r.Spec.Username = "" }, "/spec"},
		{"agent privacy", func(r *resource) { r.Kind = "Agent"; r.Spec.Username = "user1"; r.Spec.Privacy = "secret" }, "/spec/privacy"},
		{"peer aor", func(r *resource) { r.Kind = "Peer"; r.Spec.Username = "user1"; r.Spec.AOR = "sip" }, "/spec/aor"},
		{"peer contactAddr", func(r *resource) { r.Kind = "Peer"; r.Spec.Username = "user1"; r.Spec.ContactAddr = "1.2" }, "/spec/contactAddr"},
		{"peer algorithm", func(r *resource) {
			r.Kind = "Peer"
			r.Spec.Username = "user1"
			r.Spec.LoadBalancing = &loadBalancing{Algorithm: "random"}
		}, "/spec/loadBalancing/algorithm"},
		{"domain context", func(r *resource) { r.Kind = "Domain" }, "/spec"},
		{"domain uri", func(r *resource) { r.Kind = "Domain"; r.Spec.Context = &domainContext{} }, "/spec/context"},
		{"domain policy", func(r *resource) {
			r.Kind = "Domain"
			r.Spec.Context = &domainContext{DomainURI: "sip.local", EgressPolicies: []egressPolicy{{Rule: ".*"}}}
		}, "/spec/context/egressPolicies/0"},
		{"number geoInfo", func(r *resource) { r.Kind = "Number" }, "/metadata"},
		{"number location", func(r *resource) { r.Kind = "Number"; r.Metadata.GeoInfo = &geoInfo{} }, "/spec"},
		{"number telUrl", func(r *resource) {
			r.Kind = "Number"
			r.Metadata.GeoInfo = &geoInfo{}
			r.Spec.Location = &numberLocation{}
		}, "/spec/location"},
		{"trunk inbound uri", func(r *resource) { r.Kind = "Trunk"; r.Spec.Inbound = &trunkInbound{} }, "/spec/inbound"},
		{"trunk outbound uris", func(r *resource) { r.Kind = "Trunk"; r.Spec.Outbound = &trunkOutbound{} }, "/spec/outbound"},
		{"trunk uri host", func(r *resource) {
			r.Kind = "Trunk"
			r.Spec.Outbound = &trunkOutbound{URIs: []trunkURI{{}}}
		}, "/spec/outbound/uris/0/uri"},
		{"trunk uri port", func(r *resource) {
			r.Kind = "Trunk"
			r.Spec.Outbound = &trunkOutbound{URIs: []trunkURI{{URI: trunkURIAddr{Host: "h", Port: &port, Transport: "udp"}}}}
		}, "/spec/outbound/uris/0/uri/port"},
		{"trunk uri transport", func(r *resource) {
			p := int32(5060)
			r.Kind = "Trunk"
			r.Spec.Outbound = &trunkOutbound{URIs: []trunkURI{{URI: trunkURIAddr{Host: "h", Port: &p, Transport: "smtp"}}}}
		}, "/spec/outbound/uris/0/uri/transport"},
		{"trunk uri weight", func(r *resource) {
			p := int32(5060)
			r.Kind = "Trunk"
			r.Spec.Outbound = &trunkOutbound{URIs: []trunkURI{{URI: trunkURIAddr{Host: "h", Port: &p, Transport: "udp"}, Weight: &weight, Enabled: &enabled}}}
		}, "/spec/outbound/uris/0/weight"},
		{"acl short rule", func(r *resource) {
			r.Kind = "AccessControlList"
			r.Spec.AccessControlList = &aclRules{Allow: []string{"1.2.3"}}
		}, "/spec/accessControlList/allow/0"},
		{"acl empty list", func(r *resource) {
			r.Kind = "AccessControlList"
			r.Spec.AccessControlList = &aclRules{Deny: []string{}}
		}, "/spec/accessControlList/deny"},
		{"acl duplicates", func(r *resource) {
			r.Kind = "AccessControlList"
			r.Spec.AccessControlList = &aclRules{Deny: []string{"0.0.0.0/1", "0.0.0.0/1"}}
		}, "/spec/accessControlList/deny"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := ok()
			tt.mod(r)
			err := r.validate()
			var badRes *badResourceError
			if !errors.As(err, &badRes) {
				t.Fatalf("err = %v, want a bad resource", err)
			}
			if badRes.Path != tt.path {
				t.Errorf("path = %s, want %s (%v)", badRes.Path, tt.path, err)
			}
		})
	}
}

func TestKindOf(t *testing.T) {
	for in, want := range map[string]Kind{
		"Agent": KindAgent, "agent": KindAgent, "AGENT": KindAgent,
		"AccessControlList": KindACL, "accesscontrollist": KindACL,
		"Credentials": KindCredentials, "Number": KindNumber,
		"Trunk": KindTrunk, "Peer": KindPeer, "Domain": KindDomain,
		"Gateway": "", "": "",
	} {
		if got := kindOf(in); got != want {
			t.Errorf("kindOf(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEnumMappers(t *testing.T) {
	if privacyOf("Private") != agents.Privacy_PRIVATE || privacyOf("PRIVATE") != agents.Privacy_PRIVATE {
		t.Error("private")
	}
	if privacyOf("None") != agents.Privacy_NONE || privacyOf("") != agents.Privacy_NONE {
		t.Error("none")
	}
	if balancingAlgorithmOf("least-sessions") != peers.LoadBalancingAlgorithm_LEAST_SESSIONS {
		t.Error("least-sessions")
	}
	if balancingAlgorithmOf("round-robin") != peers.LoadBalancingAlgorithm_ROUND_ROBIN {
		t.Error("round-robin")
	}
	if balancingAlgorithmOf("") != peers.LoadBalancingAlgorithm_UNSPECIFIED {
		t.Error("unspecified")
	}
}

func TestFilesPeerACL(t *testing.T) {
	peer := "- apiVersion: v2beta1\n  kind: Peer\n  ref: p1\n  metadata: {name: p}\n  spec: {username: peer1, aor: sip:p@sip.local, accessControlListRef: %s}\n"
	acl := "- apiVersion: v2beta1\n  kind: AccessControlList\n  ref: acl-01\n  metadata: {name: acl}\n  spec: {accessControlList: {allow: [192.0.2.10/32], deny: [0.0.0.0/0]}}\n"
	s, err := NewFiles(writeResources(t, fmt.Sprintf(peer, "acl-01")+acl))
	if err != nil {
		t.Fatal(err)
	}
	msg, err := s.Get(context.Background(), KindPeer, "p1")
	if err != nil {
		t.Fatal(err)
	}
	if list := msg.(*peers.Peer).GetAccessControlList(); list.GetRef() != "acl-01" || len(list.GetAllow()) != 1 {
		t.Errorf("acl = %v", list)
	}
	if _, err := NewFiles(writeResources(t, fmt.Sprintf(peer, "nope"))); err == nil || !strings.Contains(err.Error(), "the resource with ref nope does not exist") {
		t.Errorf("a reference that names nothing: %v", err)
	}
}
