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
	"errors"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

func TestFindResource(t *testing.T) {
	ctx := context.Background()
	t.Run("an Agent in its Domain", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if a := env.connect.findResource(ctx, "sip.local", "1001"); !a.isAgent() || a.agent.GetUsername() != "1001" {
			t.Errorf("findResource() = %v", a)
		}
		if env.agents.calls != 1 || env.domains.calls != 1 {
			t.Errorf("lookups = %d agents, %d domains, want one each", env.agents.calls, env.domains.calls)
		}
	})
	t.Run("an Agent of another Domain", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.domains.items = append(env.domains.items, &domains.Domain{Ref: "domain-02", DomainUri: "sip.localx"})
		if a := env.connect.findResource(ctx, "sip.localx", "1001"); a != nil {
			t.Errorf("findResource() = %v, want nil", a)
		}
	})
	t.Run("a Domain that does not exist", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if a := env.connect.findResource(ctx, "sip.local2", "1001"); a != nil {
			t.Errorf("findResource() = %v, want nil", a)
		}
	})
	t.Run("an Agent that does not exist", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if a := env.connect.findResource(ctx, "sip.local", "1003"); a != nil {
			t.Errorf("findResource() = %v, want nil", a)
		}
	})
	t.Run("a NOT_FOUND from the API finds nothing", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.agents.err = status.Error(codes.NotFound, "no agent")
		if a := env.connect.findResource(ctx, "sip.local", "1001"); a != nil {
			t.Errorf("findResource() = %v, want nil", a)
		}
	})
	t.Run("a failing API finds nothing, as in Routr 2", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.domains.err = status.Error(codes.Unavailable, "down")
		if a := env.connect.findResource(ctx, "sip.local", "1001"); a != nil {
			t.Errorf("findResource() = %v, want nil", a)
		}
	})
}

func TestFindResources(t *testing.T) {
	env := newTestEnv(t, nil)
	req := agentInvite(env.now)
	caller, callee := env.connect.findResources(context.Background(), req)
	if caller.ref() != "agent-01" || callee.ref() != "agent-02" {
		t.Errorf("findResources() = %v, %v", caller.ref(), callee.ref())
	}
	// One plan: each resource fetched once
	if env.agents.calls != 2 || env.domains.calls != 2 {
		t.Errorf("lookups = %d agents, %d domains, want two each", env.agents.calls, env.domains.calls)
	}
}

func TestFindResourceOrder(t *testing.T) {
	ctx := context.Background()
	t.Run("a Number comes before an Agent and a Peer of the same name", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.numbers.items = []*numbers.Number{{Ref: "number-01", TelUrl: "tel:1001"}}
		env.peers.items = []*peers.Peer{{Ref: "peer-01", Username: "1001"}}
		if r := env.connect.findResource(ctx, "sip.local", "1001"); !r.isNumber() {
			t.Errorf("findResource() = %v, want the Number", r)
		}
		if env.agents.calls != 0 || env.peers.calls != 0 {
			t.Errorf("lookups after the Number: %d agents, %d peers", env.agents.calls, env.peers.calls)
		}
	})
	t.Run("an Agent comes before a Peer of the same name", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.peers.items = []*peers.Peer{{Ref: "peer-01", Username: "1001"}}
		if r := env.connect.findResource(ctx, "sip.local", "1001"); !r.isAgent() {
			t.Errorf("findResource() = %v, want the Agent", r)
		}
		if env.peers.calls != 0 {
			t.Errorf("%d peer lookups after the Agent", env.peers.calls)
		}
	})
	t.Run("an Agent of another Domain hides a Peer of the same name", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.peers.items = []*peers.Peer{{Ref: "peer-01", Username: "1001"}}
		if r := env.connect.findResource(ctx, "sip.localx", "1001"); r != nil {
			t.Errorf("findResource() = %v, want nil", r)
		}
	})
	t.Run("a Peer takes any host", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.peers.items = []*peers.Peer{{Ref: "peer-01", Username: "asterisk"}}
		if r := env.connect.findResource(ctx, "anything", "asterisk"); !r.isPeer() {
			t.Errorf("findResource() = %v, want the Peer", r)
		}
	})
	t.Run("without Numbers and Peers clients only Agents are found", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.connect.numbers = nil
		env.connect.peers = nil
		if r := env.connect.findResource(ctx, "sip.local", "1001"); !r.isAgent() {
			t.Errorf("findResource() = %v, want the Agent", r)
		}
		if r := env.connect.findResource(ctx, "sip.local", "asterisk"); r != nil {
			t.Errorf("findResource() = %v, want nil", r)
		}
	})
}

func TestFindInboundTrunk(t *testing.T) {
	ctx := context.Background()
	env := newTestEnv(t, nil)
	env.trunks.items = []*trunks.Trunk{{Ref: "trunk-01", InboundUri: "trunk01.acme.com"}}
	if tr, err := env.connect.findInboundTrunk(ctx, "trunk01.acme.com"); err != nil || tr.GetRef() != "trunk-01" {
		t.Errorf("findInboundTrunk() = %v, %v", tr, err)
	}
	if tr, err := env.connect.findInboundTrunk(ctx, "sip.local"); err != nil || tr != nil {
		t.Errorf("findInboundTrunk() = %v, %v, want nothing", tr, err)
	}
	env.trunks.err = status.Error(codes.NotFound, "no trunk")
	if tr, err := env.connect.findInboundTrunk(ctx, "trunk01.acme.com"); err != nil || tr != nil {
		t.Errorf("a NOT_FOUND found %v, %v", tr, err)
	}
	env.trunks.err = errors.New("down")
	if _, err := env.connect.findInboundTrunk(ctx, "trunk01.acme.com"); err == nil {
		t.Error("a failing API is an error")
	}
	env.connect.trunks = nil
	if tr, err := env.connect.findInboundTrunk(ctx, "trunk01.acme.com"); err != nil || tr != nil {
		t.Errorf("without a Trunks client found %v, %v", tr, err)
	}
}

func TestRoutingDirection(t *testing.T) {
	agent := &resource{agent: testAgent("agent-01", "1001")}
	peer := &resource{peer: &peers.Peer{Ref: "peer-01"}}
	number := &resource{number: &numbers.Number{Ref: "number-01"}}
	tests := []struct {
		name           string
		caller, callee *resource
		want           direction
	}{
		{"agent, agent", agent, agent, directionAgentToAgent},
		{"agent, peer", agent, peer, directionAgentToPeer},
		{"agent, unknown", agent, nil, directionAgentToPSTN},
		{"agent, number", agent, number, directionFromPSTN},
		{"peer, agent", peer, agent, directionPeerToAgent},
		{"peer, unknown", peer, nil, directionPeerToPSTN},
		{"peer, number", peer, number, directionFromPSTN},
		{"peer, peer", peer, peer, directionUnknown},
		{"unknown, number", nil, number, directionFromPSTN},
		{"number, number", number, number, directionFromPSTN},
		{"number, unknown", number, nil, directionUnknown},
		{"unknown, agent", nil, agent, directionUnknown},
		{"unknown, peer", nil, peer, directionUnknown},
		{"unknown, unknown", nil, nil, directionUnknown},
	}
	for _, tt := range tests {
		if got := routingDirection(tt.caller, tt.callee); got != tt.want {
			t.Errorf("%s: routingDirection() = %s, want %s", tt.name, got, tt.want)
		}
	}
}

func TestVerifyDigest(t *testing.T) {
	creds := auth.Credentials{Username: "1001", Secret: "1234"}
	t.Run("the right digest on a fresh nonce passes", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if res := env.connect.verifyDigest(agentInvite(env.now), creds); res != nil {
			t.Errorf("verifyDigest() = %v, want nil", res)
		}
	})
	t.Run("a wrong digest is challenged again, without stale", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := agentInvite(env.now)
		req.Message.Authorization.Response = "0000000000000000000000000000dead"
		res := env.connect.verifyDigest(req, creds)
		if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate().GetStale() {
			t.Errorf("verifyDigest() = %v", res)
		}
		if res.GetMessage().GetWwwAuthenticate().GetRealm() != "sip.local" {
			t.Errorf("realm = %q, want the Request-URI host", res.GetMessage().GetWwwAuthenticate().GetRealm())
		}
	})
	t.Run("the wrong credentials are challenged again", func(t *testing.T) {
		env := newTestEnv(t, nil)
		res := env.connect.verifyDigest(agentInvite(env.now), auth.Credentials{Username: "1001", Secret: "4321"})
		if responseTypeOf(res) != "UNAUTHORIZED" {
			t.Errorf("verifyDigest() = %v", res)
		}
	})
	t.Run("the right digest on an expired nonce is challenged with stale", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local",
			nonce: auth.GenerateNonce(func() time.Time { return env.now.Add(-400 * time.Second) })})
		res := env.connect.verifyDigest(req, creds)
		if responseTypeOf(res) != "UNAUTHORIZED" || !res.GetMessage().GetWwwAuthenticate().GetStale() {
			t.Errorf("verifyDigest() = %v", res)
		}
	})
	t.Run("nonceMaxAge 0 accepts any nonce", func(t *testing.T) {
		cfg := testConfig()
		zero := 0
		cfg.Spec.NonceMaxAge = &zero
		env := newTestEnv(t, cfg)
		req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local", nonce: "b8fe2321cf489ac475c80c6e5cfa1c22"})
		if res := env.connect.verifyDigest(req, creds); res != nil {
			t.Errorf("verifyDigest() = %v, want nil", res)
		}
	})
}

func TestCheckAgentOrPeerAccess(t *testing.T) {
	env := newTestEnv(t, nil)
	caller := &resource{agent: testAgent("agent-01", "1001")}
	if res := env.connect.checkAgentOrPeerAccess(agentInvite(env.now), caller); res != nil {
		t.Errorf("an authenticated Agent was refused: %v", res)
	}
	noAuth := agentInvite(env.now)
	noAuth.Message.Authorization = nil
	res := env.connect.checkAgentOrPeerAccess(noAuth, caller)
	if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate().GetStale() {
		t.Errorf("without credentials = %v", res)
	}
	noCreds := testAgent("agent-01", "1001")
	noCreds.Credentials = nil
	if res := env.connect.checkAgentOrPeerAccess(emptyCredentialsInvite(env.now), &resource{agent: noCreds}); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("an Agent without credentials = %v, want 403", res)
	}
	noUsername := testAgent("agent-01", "1001")
	noUsername.Credentials.Username = ""
	noUsername.Credentials.Password = ""
	if res := env.connect.checkAgentOrPeerAccess(emptyCredentialsInvite(env.now), &resource{agent: noUsername}); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("an Agent with empty credentials = %v, want 403", res)
	}
	peerNoCreds := &resource{peer: &peers.Peer{Ref: "peer-01", Username: "asterisk"}}
	if res := env.connect.checkAgentOrPeerAccess(emptyCredentialsInvite(env.now), peerNoCreds); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("a Peer without credentials = %v, want 403", res)
	}
}

// emptyCredentialsInvite is the INVITE of Agent 1001 signed with the
// credentials an Agent without any would verify against: "" and "".
func emptyCredentialsInvite(now time.Time) *ppb.MessageRequest {
	req := agentInvite(now)
	a := req.Message.Authorization
	a.Username = ""
	a.Response = auth.CalculateResponse(auth.Challenge{
		Realm: a.Realm, Nonce: a.Nonce, NonceCount: a.NonceCount, CNonce: a.CNonce, Qop: a.Qop, URI: a.Uri, Method: req.GetMethod().String(),
	}, auth.Credentials{})
	return req
}

func TestCredentialsFrom(t *testing.T) {
	creds, ok := credentialsFrom(&credentials.Credentials{Username: "1001", Password: "1234"})
	if !ok || creds.Username != "1001" || creds.Secret != "1234" {
		t.Errorf("credentialsFrom() = %v, %v", creds, ok)
	}
	if _, ok := credentialsFrom(&credentials.Credentials{Password: "1234"}); ok {
		t.Error("credentials without a username are not credentials")
	}
	if _, ok := credentialsFrom(nil); ok {
		t.Error("no credentials are none")
	}
}

func TestCheckAccess(t *testing.T) {
	env := newTestEnv(t, nil)
	caller := &resource{agent: testAgent("agent-01", "1001")}
	req := agentInvite(env.now)
	for _, dir := range []direction{directionAgentToAgent, directionAgentToPeer, directionAgentToPSTN, directionPeerToAgent, directionPeerToPSTN} {
		if res := env.connect.checkAccess(req, caller, nil, nil, dir); res != nil {
			t.Errorf("%s: an authenticated caller was refused: %v", dir, res)
		}
	}
	if res := env.connect.checkAccess(req, nil, nil, nil, directionUnknown); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("unknown direction = %v", res)
	}
	if res := env.connect.checkAccess(req, nil, nil, nil, directionFromPSTN); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("from-pstn with no Number and no Trunk = %v", res)
	}
}

func TestCheckAccessFromPSTN(t *testing.T) {
	trunk := func() *trunks.Trunk { return &trunks.Trunk{Ref: "trunk-01", InboundUri: "trunk01.acme.com"} }
	callee := func() *resource {
		return &resource{number: &numbers.Number{Ref: "number-01", Trunk: trunk()}}
	}
	request := func(env *testEnv, host, received string) *ppb.MessageRequest {
		req := newRequest(env.now, requestOpts{fromUser: "+17853178070", fromDomain: "newyork7.voip.ms", toUser: "+19103434434", toDomain: "newyork7.voip.ms", requestURIHost: "trunk01.acme.com", noAuth: true})
		req.Message.Via[0].Host = host
		req.Message.Via[0].Received = received
		return req
	}
	withACL := func() *trunks.Trunk {
		tr := trunk()
		tr.AccessControlList = &acl.AccessControlList{Allow: []string{"203.0.113.0/24"}, Deny: []string{"0.0.0.0/0"}}
		return tr
	}
	t.Run("allows a Trunk with no access control or credentials", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if res := env.connect.checkAccessFromPSTN(request(env, "10.0.0.5", ""), callee(), trunk()); res != nil {
			t.Errorf("checkAccessFromPSTN() = %v", res)
		}
	})
	t.Run("forbids a Number of another Trunk", func(t *testing.T) {
		env := newTestEnv(t, nil)
		other := &trunks.Trunk{Ref: "trunk-02"}
		if res := env.connect.checkAccessFromPSTN(request(env, "10.0.0.5", ""), callee(), other); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("checkAccessFromPSTN() = %v", res)
		}
	})
	t.Run("forbids a host that is no Trunk's", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if res := env.connect.checkAccessFromPSTN(request(env, "10.0.0.5", ""), callee(), nil); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("checkAccessFromPSTN() = %v", res)
		}
	})
	t.Run("denies a forged Via host when received is outside the list", func(t *testing.T) {
		env := newTestEnv(t, nil)
		res := env.connect.checkAccessFromPSTN(request(env, "203.0.113.10", "198.51.100.7"), callee(), withACL())
		if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate() != nil {
			t.Errorf("checkAccessFromPSTN() = %v, want 401 without a challenge", res)
		}
	})
	t.Run("allows the carrier address in received", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if res := env.connect.checkAccessFromPSTN(request(env, "10.0.0.5", "203.0.113.10"), callee(), withACL()); res != nil {
			t.Errorf("checkAccessFromPSTN() = %v", res)
		}
	})
	t.Run("falls back to the Via host when received is absent", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if res := env.connect.checkAccessFromPSTN(request(env, "203.0.113.10", ""), callee(), withACL()); res != nil {
			t.Errorf("allowed host = %v", res)
		}
		if res := env.connect.checkAccessFromPSTN(request(env, "198.51.100.7", ""), callee(), withACL()); responseTypeOf(res) != "UNAUTHORIZED" {
			t.Errorf("denied host = %v", res)
		}
	})
	t.Run("challenges a Trunk with credentials, then verifies them", func(t *testing.T) {
		env := newTestEnv(t, nil)
		tr := trunk()
		tr.InboundCredentials = &credentials.Credentials{Username: "pbx-1", Password: "1234"}
		req := request(env, "10.0.0.5", "")
		res := env.connect.checkAccessFromPSTN(req, callee(), tr)
		if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate().GetRealm() != "trunk01.acme.com" {
			t.Errorf("no Authorization = %v", res)
		}
		req.Message.Authorization = signedAuthorization(ppb.Method_INVITE, "pbx-1", auth.GenerateNonce(func() time.Time { return env.now }))
		if res := env.connect.checkAccessFromPSTN(req, callee(), tr); res != nil {
			t.Errorf("right credentials = %v", res)
		}
		req.Message.Authorization.Response = "0000000000000000000000000000dead"
		if res := env.connect.checkAccessFromPSTN(req, callee(), tr); responseTypeOf(res) != "UNAUTHORIZED" {
			t.Errorf("wrong credentials = %v", res)
		}
	})
	t.Run("forbids empty inbound credentials", func(t *testing.T) {
		env := newTestEnv(t, nil)
		tr := trunk()
		tr.InboundCredentials = &credentials.Credentials{}
		req := request(env, "10.0.0.5", "")
		req.Message.Authorization = emptyCredentialsInvite(env.now).GetMessage().GetAuthorization()
		if res := env.connect.checkAccessFromPSTN(req, callee(), tr); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("checkAccessFromPSTN() = %v", res)
		}
	})
}
