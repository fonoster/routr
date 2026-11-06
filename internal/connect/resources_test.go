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
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

func TestFindResource(t *testing.T) {
	ctx := context.Background()
	t.Run("an Agent in its Domain", func(t *testing.T) {
		env := newTestEnv(t, nil)
		if a := env.connect.findResource(ctx, "sip.local", "1001"); a == nil || a.GetUsername() != "1001" {
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
	if caller.GetRef() != "agent-01" || callee.GetRef() != "agent-02" {
		t.Errorf("findResources() = %v, %v", caller.GetRef(), callee.GetRef())
	}
	// One plan: each resource fetched once
	if env.agents.calls != 2 || env.domains.calls != 2 {
		t.Errorf("lookups = %d agents, %d domains, want two each", env.agents.calls, env.domains.calls)
	}
}

func TestFindInboundTrunk(t *testing.T) {
	ctx := context.Background()
	env := newTestEnv(t, nil)
	env.trunks.items = []*trunks.Trunk{{Ref: "trunk-01", InboundUri: "trunk01.acme.com"}}
	if tr := env.connect.findInboundTrunk(ctx, "trunk01.acme.com"); tr.GetRef() != "trunk-01" {
		t.Errorf("findInboundTrunk() = %v", tr)
	}
	if tr := env.connect.findInboundTrunk(ctx, "sip.local"); tr != nil {
		t.Errorf("findInboundTrunk() = %v, want nil", tr)
	}
	env.trunks.err = errors.New("down")
	if tr := env.connect.findInboundTrunk(ctx, "trunk01.acme.com"); tr != nil {
		t.Errorf("a failing API found %v", tr)
	}
	env.connect.trunks = nil
	if tr := env.connect.findInboundTrunk(ctx, "trunk01.acme.com"); tr != nil {
		t.Errorf("without a Trunks client found %v", tr)
	}
}

func TestRoutingDirection(t *testing.T) {
	agent := testAgent("agent-01", "1001")
	tests := []struct {
		caller, callee *agents.Agent
		want           direction
	}{
		{agent, agent, directionAgentToAgent},
		{agent, nil, directionAgentToPSTN},
		{nil, agent, directionUnknown},
		{nil, nil, directionUnknown},
	}
	for _, tt := range tests {
		if got := routingDirection(tt.caller, tt.callee); got != tt.want {
			t.Errorf("routingDirection(%v, %v) = %s, want %s", tt.caller != nil, tt.callee != nil, got, tt.want)
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

func TestCheckAgentAccess(t *testing.T) {
	env := newTestEnv(t, nil)
	caller := testAgent("agent-01", "1001")
	if res := env.connect.checkAgentAccess(agentInvite(env.now), caller); res != nil {
		t.Errorf("an authenticated Agent was refused: %v", res)
	}
	noAuth := agentInvite(env.now)
	noAuth.Message.Authorization = nil
	res := env.connect.checkAgentAccess(noAuth, caller)
	if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate().GetStale() {
		t.Errorf("without credentials = %v", res)
	}
	noCreds := testAgent("agent-01", "1001")
	noCreds.Credentials = nil
	if res := env.connect.checkAgentAccess(emptyCredentialsInvite(env.now), noCreds); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("an Agent without credentials = %v, want 403", res)
	}
	noUsername := testAgent("agent-01", "1001")
	noUsername.Credentials.Username = ""
	noUsername.Credentials.Password = ""
	if res := env.connect.checkAgentAccess(emptyCredentialsInvite(env.now), noUsername); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("an Agent with empty credentials = %v, want 403", res)
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

func TestCredentialsOf(t *testing.T) {
	agent := testAgent("agent-01", "1001")
	creds, ok := credentialsOf(agent)
	if !ok || creds.Username != "1001" || creds.Secret != "1234" {
		t.Errorf("credentialsOf() = %v, %v", creds, ok)
	}
	agent.Credentials.Username = ""
	if _, ok := credentialsOf(agent); ok {
		t.Error("credentials without a username are not credentials")
	}
	agent.Credentials = nil
	if _, ok := credentialsOf(agent); ok {
		t.Error("an Agent without credentials has none")
	}
	if _, ok := credentialsOf(nil); ok {
		t.Error("no Agent has no credentials")
	}
}

func TestCheckAccess(t *testing.T) {
	env := newTestEnv(t, nil)
	caller := testAgent("agent-01", "1001")
	req := agentInvite(env.now)
	for _, dir := range []direction{directionAgentToAgent, directionAgentToPSTN} {
		if res := env.connect.checkAccess(req, caller, dir); res != nil {
			t.Errorf("%s: an authenticated Agent was refused: %v", dir, res)
		}
	}
	if res := env.connect.checkAccess(req, nil, directionUnknown); responseTypeOf(res) != "FORBIDDEN" {
		t.Errorf("unknown direction = %v", res)
	}
}
