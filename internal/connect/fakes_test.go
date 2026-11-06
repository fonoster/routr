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

package connect

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/pb/verifier"
)

// The fakes implement the generated client interfaces by embedding them:
// only the methods Connect calls are given a body.

type fakeAgents struct {
	agents.AgentsClient
	mu    sync.Mutex
	items []*agents.Agent
	err   error
	calls int
}

func (f *fakeAgents) FindBy(_ context.Context, in *agents.FindByRequest, _ ...grpc.CallOption) (*agents.FindByResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	res := &agents.FindByResponse{}
	for _, a := range f.items {
		if in.GetFieldName() == "username" && a.GetUsername() == in.GetFieldValue() {
			res.Items = append(res.Items, a)
		}
	}
	return res, nil
}

type fakeDomains struct {
	domains.DomainsClient
	mu    sync.Mutex
	items []*domains.Domain
	err   error
	calls int
}

func (f *fakeDomains) FindBy(_ context.Context, in *domains.FindByRequest, _ ...grpc.CallOption) (*domains.FindByResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	res := &domains.FindByResponse{}
	for _, d := range f.items {
		if in.GetFieldName() == "domainUri" && d.GetDomainUri() == in.GetFieldValue() {
			res.Items = append(res.Items, d)
		}
	}
	return res, nil
}

type fakeTrunks struct {
	trunks.TrunksClient
	items []*trunks.Trunk
	err   error
}

func (f *fakeTrunks) FindBy(_ context.Context, in *trunks.FindByRequest, _ ...grpc.CallOption) (*trunks.FindByResponse, error) {
	if f.err != nil {
		return nil, f.err
	}
	res := &trunks.FindByResponse{}
	for _, t := range f.items {
		if in.GetFieldName() == "inboundUri" && t.GetInboundUri() == in.GetFieldValue() {
			res.Items = append(res.Items, t)
		}
	}
	return res, nil
}

type fakeNumbers struct {
	numbers.NumbersClient
	items []*numbers.Number
	err   error
	calls int
}

func (f *fakeNumbers) FindBy(_ context.Context, in *numbers.FindByRequest, _ ...grpc.CallOption) (*numbers.FindByResponse, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	res := &numbers.FindByResponse{}
	for _, n := range f.items {
		if in.GetFieldName() == "telUrl" && n.GetTelUrl() == in.GetFieldValue() {
			res.Items = append(res.Items, n)
		}
	}
	return res, nil
}

type fakePeers struct {
	peers.PeersClient
	items []*peers.Peer
	err   error
	calls int
}

func (f *fakePeers) FindBy(_ context.Context, in *peers.FindByRequest, _ ...grpc.CallOption) (*peers.FindByResponse, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	res := &peers.FindByResponse{}
	for _, p := range f.items {
		if (in.GetFieldName() == "username" && p.GetUsername() == in.GetFieldValue()) ||
			(in.GetFieldName() == "aor" && p.GetAor() == in.GetFieldValue()) {
			res.Items = append(res.Items, p)
		}
	}
	return res, nil
}

type fakeVerifier struct {
	verifier.VerifierClient
	payload map[string]string
	err     error
}

func (f *fakeVerifier) Verify(context.Context, *verifier.VerifyRequest, ...grpc.CallOption) (*verifier.VerifyResponse, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &verifier.VerifyResponse{Payload: f.payload}, nil
}

// fakeLocation keeps routes by AOR as the memory Location does: FindRoutes
// of an unknown AOR is NOT_FOUND.
type fakeLocation struct {
	lpb.LocationClient
	mu         sync.Mutex
	routes     map[string][]*lpb.Route
	addErr     error
	findErr    error
	added      []*lpb.AddRouteRequest
	findCalls  int
	found      []*lpb.FindRoutesRequest
	emptyFound bool
}

func newFakeLocation() *fakeLocation {
	return &fakeLocation{routes: map[string][]*lpb.Route{}}
}

func (f *fakeLocation) AddRoute(_ context.Context, in *lpb.AddRouteRequest, _ ...grpc.CallOption) (*emptypb.Empty, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.addErr != nil {
		return nil, f.addErr
	}
	f.added = append(f.added, in)
	f.routes[in.GetAor()] = append(f.routes[in.GetAor()], in.GetRoute())
	return &emptypb.Empty{}, nil
}

func (f *fakeLocation) FindRoutes(_ context.Context, in *lpb.FindRoutesRequest, _ ...grpc.CallOption) (*lpb.FindRoutesResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.findCalls++
	f.found = append(f.found, in)
	if f.findErr != nil {
		return nil, f.findErr
	}
	routes := f.routes[in.GetAor()]
	if len(routes) == 0 {
		if f.emptyFound {
			return &lpb.FindRoutesResponse{}, nil
		}
		return nil, status.Errorf(codes.NotFound, "no routes found for aor: %s", in.GetAor())
	}
	return &lpb.FindRoutesResponse{Routes: routes}, nil
}

// The resources of config/resources: Agents 1001 and 1002 of sip.local, with
// the password 1234.

func testDomain() *domains.Domain {
	return &domains.Domain{ApiVersion: "v2beta1", Ref: "domain-01", Name: "Local Domain", DomainUri: "sip.local"}
}

func testAgent(ref, username string) *agents.Agent {
	return &agents.Agent{
		ApiVersion:  "v2beta1",
		Ref:         ref,
		Name:        "Agent " + username,
		Username:    username,
		Enabled:     true,
		MaxContacts: -1,
		Domain:      testDomain(),
		Credentials: &credentials.Credentials{Ref: "credentials-" + username, Username: username, Password: "1234"},
	}
}

// testEnv is a Connect over fakes.
type testEnv struct {
	connect  *Connect
	location *fakeLocation
	agents   *fakeAgents
	domains  *fakeDomains
	trunks   *fakeTrunks
	numbers  *fakeNumbers
	peers    *fakePeers
	verifier *fakeVerifier
	now      time.Time
}

// testSettings are the knobs the tests turn; newTestEnv maps them onto the
// spec and the trust New takes. A nil field is the default.
type testSettings struct {
	Spec *testSpec
	// WithVerifier gives the Connect a Verifier client, env.verifier
	WithVerifier bool
	// UntrustedHeaders is Options.UntrustedHeaders
	UntrustedHeaders []string
}

type testSpec struct {
	NonceMaxAge              *int
	RegisterDefaultExpires   *int
	TrustedEdgePorts         []string
	TrustedEdgePortAddresses []string
}

func testConfig() *testSettings {
	nonceMaxAge := 300
	expires := 3600
	return &testSettings{Spec: &testSpec{NonceMaxAge: &nonceMaxAge, RegisterDefaultExpires: &expires}}
}

// settingsOf is the spec and the trust of the knobs.
func settingsOf(cfg *testSettings) (config.ConnectSpec, Trust) {
	spec := config.ConnectSpec{NonceMaxAge: config.DefaultNonceMaxAge, RegisterDefaultExpires: config.DefaultRegisterDefaultExpires}
	if cfg.Spec.NonceMaxAge != nil {
		spec.NonceMaxAge = *cfg.Spec.NonceMaxAge
	}
	if cfg.Spec.RegisterDefaultExpires != nil {
		spec.RegisterDefaultExpires = *cfg.Spec.RegisterDefaultExpires
	}
	return spec, Trust{EdgePorts: cfg.Spec.TrustedEdgePorts, EdgePortAddresses: cfg.Spec.TrustedEdgePortAddresses}
}

func newTestEnv(t *testing.T, cfg *testSettings) *testEnv {
	t.Helper()
	if cfg == nil {
		cfg = testConfig()
	}
	spec, trust := settingsOf(cfg)
	env := &testEnv{
		location: newFakeLocation(),
		agents:   &fakeAgents{items: []*agents.Agent{testAgent("agent-01", "1001"), testAgent("agent-02", "1002")}},
		domains:  &fakeDomains{items: []*domains.Domain{testDomain()}},
		trunks:   &fakeTrunks{},
		numbers:  &fakeNumbers{},
		peers:    &fakePeers{},
		verifier: &fakeVerifier{},
		now:      time.Date(2026, 10, 23, 21, 43, 34, 0, time.UTC),
	}
	deps := Dependencies{Location: env.location, Agents: env.agents, Domains: env.domains, Trunks: env.trunks, Numbers: env.numbers, Peers: env.peers}
	if cfg.WithVerifier {
		deps.Verifier = env.verifier
	}
	c, err := New(spec, trust, deps, Options{
		Logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
		Now:              func() time.Time { return env.now },
		UntrustedHeaders: cfg.UntrustedHeaders,
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	env.connect = c
	return env
}

func (e *testEnv) process(t *testing.T, req *ppb.MessageRequest) *ppb.MessageResponse {
	t.Helper()
	res, err := e.connect.ProcessMessage(context.Background(), req)
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}
	return res
}

// The request fixture of mods/connect/test/examples.ts createRequest.

type requestOpts struct {
	method         ppb.Method
	fromUser       string
	fromDomain     string
	toUser         string
	toDomain       string
	requestURIHost string
	noAuth         bool
	nonce          string
}

func uri(user, host string, port int32) *spb.SipURI {
	return &spb.SipURI{User: user, Host: host, TransportParam: "TCP", TtlParam: -1, Port: port}
}

// signedAuthorization is examples.ts createAuthorization: the digest Agent
// 1001 computes for its INVITE to 1002, answering the given nonce.
func signedAuthorization(method ppb.Method, username, nonce string) *spb.Authorization {
	a := &spb.Authorization{
		Realm:      "sip.local",
		Scheme:     "Digest",
		CNonce:     "7314861c4c17b0ea43311cce5eae2506",
		Nonce:      nonce,
		Algorithm:  "MD5",
		Qop:        "",
		Opaque:     "",
		Username:   username,
		Uri:        "sip:1002@sip.local;transport=TCP",
		NonceCount: 13,
	}
	a.Response = auth.CalculateResponse(auth.Challenge{
		Realm: a.Realm, Nonce: a.Nonce, NonceCount: a.NonceCount, CNonce: a.CNonce, Qop: a.Qop, URI: a.Uri, Method: method.String(),
	}, auth.Credentials{Username: username, Secret: "1234"})
	return a
}

func newRequest(now time.Time, o requestOpts) *ppb.MessageRequest {
	if o.method == ppb.Method_UNKNOWN {
		o.method = ppb.Method_INVITE
	}
	if o.requestURIHost == "" {
		o.requestURIHost = o.toDomain
	}
	if o.nonce == "" {
		o.nonce = auth.GenerateNonce(func() time.Time { return now })
	}
	req := &ppb.MessageRequest{
		Ref:           "AynhXaFtbdXwHrUEzt_rUQ..",
		EdgePortRef:   "edgeport-01",
		Method:        o.method,
		ExternalAddrs: []string{"200.22.21.42"},
		Localnets:     []string{"10.100.42.127/31", "10.100.42.128/31"},
		ListeningPoints: []*ppb.NetInterface{
			{Host: "10.100.42.127", Port: 5060, Transport: common.Transport_TCP},
			{Host: "10.100.42.127", Port: 5060, Transport: common.Transport_UDP},
		},
		Sender: &ppb.NetInterface{Host: "127.0.0.1", Port: 36214, Transport: common.Transport_TCP},
		Message: &spb.SIPMessage{
			MessageType: &spb.SIPMessage_RequestUri{RequestUri: uri(o.toUser, o.requestURIHost, 5060)},
			Via: []*spb.Via{
				{Host: "proxy", Received: "127.0.0.1", Port: 5060, Branch: "z9hG4bK-524287-1---7315a24d84546819", Transport: "TCP", RPort: -1, Ttl: -1},
				{Host: "127.0.0.1", Port: 36214, Branch: "z9hG4bK-524287-1---7315a24d84546819", Transport: "TCP", RPort: -1, Ttl: -1},
			},
			Extensions: []*spb.Extension{
				{Name: "CSeq", Value: "14 " + o.method.String()},
				{Name: "Allow", Value: "INVITE"},
				{Name: "User-Agent", Value: "Z 5.4.12 v2.10.13.2"},
				{Name: "Allow-Events", Value: "presence"},
			},
			From:          &spb.From{Address: &spb.Address{Uri: uri(o.fromUser, o.fromDomain, 5060)}, Tag: "9041462a"},
			To:            &spb.To{Address: &spb.Address{Uri: uri(o.toUser, o.toDomain, 5060)}},
			Contact:       &spb.Contact{Address: &spb.Address{Uri: uri("1001", "127.0.0.1", 36214)}, Expires: -1, QValue: -1},
			CallId:        &spb.CallID{CallId: "AynhXaFtbdXwHrUEzt_rUQ.."},
			ContentLength: &spb.ContentLength{},
			MaxForwards:   &spb.MaxForwards{MaxForwards: 70},
			Expires:       &spb.Expires{Expires: 60},
			RecordRoute: []*spb.RecordRoute{
				{Parameters: map[string]string{"a": "1", "b": "2"}, Address: &spb.Address{Uri: uri("", "127.0.0.1", 5060)}},
			},
			Route: []*spb.Route{
				{Address: &spb.Address{Uri: uri("", "10.100.42.127", 5060)}},
				{Address: &spb.Address{Uri: uri("", "10.100.42.128", 5060)}},
			},
		},
	}
	if !o.noAuth {
		req.Message.Authorization = signedAuthorization(o.method, o.fromUser, o.nonce)
	}
	return req
}

// agentInvite is the INVITE of Agent 1001 to Agent 1002 in sip.local.
func agentInvite(now time.Time) *ppb.MessageRequest {
	return newRequest(now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local"})
}

// r1 is examples.ts r1: the route to Agent 1002, as the Location returns it.
func r1() *lpb.Route {
	return &lpb.Route{
		User:            "1002",
		Host:            "192.168.1.3",
		Port:            "5060",
		AdvertisedHost:  "192.168.1.3",
		AdvertisedPort:  "5060",
		Transport:       common.Transport_TCP,
		SessionCount:    -1,
		RegisteredOn:    1761255805000,
		EdgePortRef:     "edgeport-01",
		ListeningPoints: []*ppb.NetInterface{{Host: "10.1.1.1", Port: 5060, Transport: common.Transport_TCP}},
		Localnets:       []string{},
		ExternalAddrs:   []string{},
	}
}

func responseTypeOf(res *ppb.MessageResponse) string {
	rt, ok := res.GetMessage().GetMessageType().(*spb.SIPMessage_ResponseType)
	if !ok {
		return ""
	}
	return rt.ResponseType.String()
}

func hops(routes []*spb.Route) []string {
	var out []string
	for _, r := range routes {
		out = append(out, fmt.Sprintf("%s:%d", r.GetAddress().GetUri().GetHost(), r.GetAddress().GetUri().GetPort()))
	}
	return out
}

func extensionValue(msg *spb.SIPMessage, name string) string {
	return getHeaderValue(&ppb.MessageRequest{Message: msg}, name)
}
