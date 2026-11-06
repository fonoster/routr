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
	"errors"
	"reflect"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// withRoute registers r1, the route to Agent 1002, with the networks of the
// request fixture so the tailor finds its interfaces.
func (e *testEnv) withRoute(req *ppb.MessageRequest, r *lpb.Route) *lpb.Route {
	r.ListeningPoints = req.GetListeningPoints()
	r.Localnets = req.GetLocalnets()
	r.ExternalAddrs = req.GetExternalAddrs()
	e.location.routes["sip:1002@sip.local"] = []*lpb.Route{r}
	return r
}

func TestChallengeBeforeRouting(t *testing.T) {
	env := newTestEnv(t, nil)
	noAuth := agentInvite(env.now)
	noAuth.Message.Authorization = nil
	withToken := agentInvite(env.now)
	withToken.Message.Authorization = nil
	withToken.Message.Extensions = append(withToken.Message.Extensions, &spb.Extension{Name: "X-Connect-Token", Value: "token"})
	options := agentInvite(env.now)
	options.Method = ppb.Method_OPTIONS
	options.Message.Authorization = nil
	tests := []struct {
		name  string
		req   *ppb.MessageRequest
		trunk *trunks.Trunk
		want  bool
	}{
		{"an INVITE without credentials", noAuth, nil, true},
		{"an INVITE with credentials", agentInvite(env.now), nil, false},
		{"an INVITE from a Trunk", noAuth, &trunks.Trunk{Ref: "trunk-01"}, false},
		{"an INVITE with a Connect Token", withToken, nil, false},
		{"a request that is no INVITE", options, nil, false},
	}
	for _, tt := range tests {
		if got := challengeBeforeRouting(tt.req, tt.trunk); got != tt.want {
			t.Errorf("%s: challengeBeforeRouting() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestHandleRequestChallenge(t *testing.T) {
	env := newTestEnv(t, nil)
	req := agentInvite(env.now)
	req.Message.Authorization = nil
	res := env.process(t, req)
	expectChallenge(t, res, "sip.local", false)
	// The challenge-before-routing rule: no lookup before the 401
	if env.agents.calls != 0 || env.domains.calls != 0 || env.location.findCalls != 0 {
		t.Errorf("lookups before the challenge: %d agents, %d domains, %d routes", env.agents.calls, env.domains.calls, env.location.findCalls)
	}
}

func TestHandleRequestAgentToAgent(t *testing.T) {
	env := newTestEnv(t, nil)
	req := agentInvite(env.now)
	env.withRoute(req, r1())
	original := proto.Clone(req).(*ppb.MessageRequest)

	res := env.process(t, req)
	if responseTypeOf(res) != "" {
		t.Fatalf("response = %v, want the INVITE forwarded", res)
	}
	msg := res.GetMessage()
	uri := msg.GetRequestUri()
	if uri.GetUser() != "1002" || uri.GetHost() != "192.168.1.3" || uri.GetPort() != 5060 || uri.GetTransportParam() != "TCP" {
		t.Errorf("requestUri = %v", uri)
	}
	if len(msg.GetVia()) != 3 || msg.GetVia()[0].GetHost() != "200.22.21.42" || msg.GetVia()[0].GetTransport() != "TCP" || !msg.GetVia()[0].GetRPortFlag() {
		t.Errorf("via = %v", msg.GetVia())
	}
	if msg.GetMaxForwards().GetMaxForwards() != 69 {
		t.Errorf("maxForwards = %d", msg.GetMaxForwards().GetMaxForwards())
	}
	if msg.GetAuthorization() != nil {
		t.Error("Authorization was forwarded")
	}
	if extensionValue(msg, headerCallDirection) != "agent-to-agent" {
		t.Errorf("X-Call-Direction = %q", extensionValue(msg, headerCallDirection))
	}
	if got := len(msg.GetRecordRoute()); got != 2 {
		t.Errorf("recordRoute = %d entries, want 2", got)
	}
	rr := msg.GetRecordRoute()[0].GetAddress().GetUri()
	if rr.GetHost() != "200.22.21.42" || rr.GetPort() != 5060 || !rr.GetLrParam() || rr.GetTransportParam() != "TCP" {
		t.Errorf("recordRoute[0] = %v", rr)
	}
	// Both preloaded Routes point at this EdgePort
	if len(msg.GetRoute()) != 0 {
		t.Errorf("route = %v", hops(msg.GetRoute()))
	}
	if res.GetMetadata()["trace.direction"] != "agent-to-agent" {
		t.Errorf("metadata = %v", res.GetMetadata())
	}
	if !proto.Equal(res.GetSender(), req.GetSender()) {
		t.Error("the sender was not kept")
	}
	if !proto.Equal(original, req) {
		t.Error("the request received was changed")
	}
	// The access check ran and the callee was looked up: four lookups, once each
	if env.agents.calls != 2 || env.domains.calls != 2 || env.location.findCalls != 1 {
		t.Errorf("lookups: %d agents, %d domains, %d routes", env.agents.calls, env.domains.calls, env.location.findCalls)
	}
}

func TestHandleRequestAnswers(t *testing.T) {
	tests := []struct {
		name       string
		arrange    func(env *testEnv) *ppb.MessageRequest
		wantType   string
		wantReason string
	}{
		{
			"480 when the callee has no route",
			func(env *testEnv) *ppb.MessageRequest { return agentInvite(env.now) },
			"TEMPORARILY_UNAVAILABLE", "Temporarily Unavailable",
		},
		{
			"480 when the Location answers no routes",
			func(env *testEnv) *ppb.MessageRequest { env.location.emptyFound = true; return agentInvite(env.now) },
			"TEMPORARILY_UNAVAILABLE", "Temporarily Unavailable",
		},
		{
			"500 when the Location fails",
			func(env *testEnv) *ppb.MessageRequest {
				env.location.findErr = errors.New("down")
				return agentInvite(env.now)
			},
			"SERVER_INTERNAL_ERROR", "Internal Server Error",
		},
		{
			"500 for a call to the PSTN from a Domain with no egress policy, as Routr 2 answers",
			func(env *testEnv) *ppb.MessageRequest {
				return newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "17853178070", toDomain: "sip.local"})
			},
			"SERVER_INTERNAL_ERROR", "Internal Server Error",
		},
		{
			"403 for a caller that is no Agent",
			func(env *testEnv) *ppb.MessageRequest {
				return newRequest(env.now, requestOpts{fromUser: "asterisk", fromDomain: "unknown.com", toUser: "1002", toDomain: "sip.local"})
			},
			"FORBIDDEN", "Forbidden",
		},
		{
			"401 for the wrong credentials",
			func(env *testEnv) *ppb.MessageRequest {
				req := agentInvite(env.now)
				req.Message.Authorization.Response = "0000000000000000000000000000dead"
				return req
			},
			"UNAUTHORIZED", "Unauthorized",
		},
		{
			"403 for a call from a Trunk to no Number of it",
			func(env *testEnv) *ppb.MessageRequest {
				env.trunks.items = []*trunks.Trunk{{Ref: "trunk-01", InboundUri: "trunk01.acme.com"}}
				req := newRequest(env.now, requestOpts{fromUser: "+19195551212", fromDomain: "newyork1.voip.ms", toUser: "+17066041487", toDomain: "newyork1.voip.ms", requestURIHost: "trunk01.acme.com", noAuth: true})
				return req
			},
			"FORBIDDEN", "Forbidden",
		},
		{
			"500 for a Connect Token with no verifier configured, as Routr 2 answers",
			func(env *testEnv) *ppb.MessageRequest {
				req := agentInvite(env.now)
				req.Message.Authorization = nil
				req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "X-Connect-Token", Value: "token"})
				return req
			},
			"SERVER_INTERNAL_ERROR", "Server Internal Error",
		},
		{
			"500 for an OPTIONS from nobody, as Routr 2 answers",
			func(env *testEnv) *ppb.MessageRequest {
				req := newRequest(env.now, requestOpts{method: ppb.Method_OPTIONS, fromUser: "x", fromDomain: "unknown.com", toUser: "y", toDomain: "unknown.com", noAuth: true})
				return req
			},
			"SERVER_INTERNAL_ERROR", "Internal Server Error",
		},
		{
			"502 when the route wants a transport this EdgePort lacks",
			func(env *testEnv) *ppb.MessageRequest {
				req := agentInvite(env.now)
				r := env.withRoute(req, r1())
				r.Transport = common.Transport_TLS
				return req
			},
			"BAD_GATEWAY", "Bad Gateway",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := newTestEnv(t, nil)
			res := env.process(t, tt.arrange(env))
			if responseTypeOf(res) != tt.wantType || res.GetMessage().GetReasonPhrase() != tt.wantReason {
				t.Errorf("response = %s %q, want %s %q", responseTypeOf(res), res.GetMessage().GetReasonPhrase(), tt.wantType, tt.wantReason)
			}
		})
	}
}

func TestHandleRequestOptionsAreRoutedWithoutAccessCheck(t *testing.T) {
	// Only an INVITE is checked; another out-of-dialog request from an Agent
	// is routed as it is, as the Node router does
	env := newTestEnv(t, nil)
	req := newRequest(env.now, requestOpts{method: ppb.Method_OPTIONS, fromUser: "1001", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local", noAuth: true})
	env.withRoute(req, r1())
	res := env.process(t, req)
	if responseTypeOf(res) != "" || res.GetMessage().GetRequestUri().GetHost() != "192.168.1.3" {
		t.Errorf("response = %v", res)
	}
}

func TestHandleRequestCancel(t *testing.T) {
	env := newTestEnv(t, nil)
	req := agentInvite(env.now)
	req.Method = ppb.Method_CANCEL
	req.Message.Authorization = nil
	res := env.process(t, req)
	if responseTypeOf(res) != "" {
		t.Fatalf("response = %v, want the CANCEL forwarded", res)
	}
	if env.location.findCalls != 0 || env.agents.calls != 0 {
		t.Error("a CANCEL was routed as a new call")
	}
	if res.GetMessage().GetMaxForwards().GetMaxForwards() != 69 || extensionValue(res.GetMessage(), headerCallDirection) != "" {
		t.Errorf("message = %v", res.GetMessage())
	}
}

func TestHandleRequestFromPeerEdgePort(t *testing.T) {
	cfg := testConfig()
	cfg.Spec.TrustedEdgePorts = []string{"edgeport-02"}
	cfg.Spec.TrustedEdgePortAddresses = []string{"10.0.0.0/24"}
	withRef := func(env *testEnv, received string) *ppb.MessageRequest {
		req := agentInvite(env.now)
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: headerEdgePortRef, Value: "edgeport-02"})
		req.Message.Via[0].Received = received
		return req
	}

	t.Run("takes the fast path when forwarded by a trusted peer", func(t *testing.T) {
		env := newTestEnv(t, cfg)
		req := withRef(env, "10.0.0.5")
		req.Message.GetRequestUri().Host = "10.100.42.9"
		res := env.process(t, req)
		if responseTypeOf(res) != "" {
			t.Fatalf("response = %v, want the INVITE forwarded", res)
		}
		if env.location.findCalls != 0 || env.agents.calls != 0 {
			t.Error("a trusted forward was routed")
		}
		if extensionValue(res.GetMessage(), headerEdgePortRef) != "" {
			t.Error("X-Edgeport-Ref was forwarded on")
		}
	})
	t.Run("answers 502 when the next hop wants a transport this EdgePort lacks", func(t *testing.T) {
		env := newTestEnv(t, cfg)
		req := withRef(env, "10.0.0.5")
		req.Message.GetRequestUri().TransportParam = "TLS"
		req.ListeningPoints = []*ppb.NetInterface{{Host: "10.1.1.1", Port: 5060, Transport: common.Transport_TCP}}
		if res := env.process(t, req); responseTypeOf(res) != "BAD_GATEWAY" {
			t.Errorf("response = %v, want 502", res)
		}
	})
	t.Run("ignores a forged X-Edgeport-Ref with the default config", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := withRef(env, "10.0.0.5")
		env.withRoute(req, r1())
		res := env.process(t, req)
		if responseTypeOf(res) != "" {
			t.Fatalf("response = %v, want the INVITE routed", res)
		}
		if env.location.findCalls != 1 {
			t.Error("the request was not routed normally")
		}
		if extensionValue(res.GetMessage(), headerEdgePortRef) != "" {
			t.Error("the forged X-Edgeport-Ref survived")
		}
	})
	t.Run("challenges an unauthorized relay attempt with a forged X-Edgeport-Ref", func(t *testing.T) {
		env := newTestEnv(t, cfg)
		req := withRef(env, "203.0.113.7")
		req.Message.Authorization = nil
		expectChallenge(t, env.process(t, req), "sip.local", false)
	})
	t.Run("routes through the peer EdgePort first, drops Routes to itself and keeps the rest", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := agentInvite(env.now)
		foreign := proto.Clone(req.Message.Route[0]).(*spb.Route)
		foreign.GetAddress().GetUri().Host = "203.0.113.50"
		req.Message.Route = append(req.Message.Route, foreign)
		r := r1()
		r.EdgePortRef = "edgeport-02"
		r.ListeningPoints = []*ppb.NetInterface{{Host: "0.0.0.0", Port: 6060, Transport: common.Transport_TCP}}
		r.Localnets = []string{"192.168.1.2/24"}
		r.ExternalAddrs = []string{}
		env.location.routes["sip:1002@sip.local"] = []*lpb.Route{r}

		res := env.process(t, req)
		if responseTypeOf(res) != "" {
			t.Fatalf("response = %v, want the INVITE forwarded", res)
		}
		msg := res.GetMessage()
		if got := hops(msg.GetRoute()); !reflect.DeepEqual(got, []string{"192.168.1.2:6060", "192.168.1.3:5060", "203.0.113.50:5060"}) {
			t.Errorf("route = %v", got)
		}
		if extensionValue(msg, headerEdgePortRef) != "edgeport-01" {
			t.Error("X-Edgeport-Ref was not added")
		}
		if msg.GetAuthorization() == nil {
			t.Error("the peer EdgePort rebuilds the route from the message: the credentials go with it")
		}
		if msg.GetMaxForwards().GetMaxForwards() != 69 || len(msg.GetVia()) != 3 {
			t.Errorf("maxForwards %d, via %d", msg.GetMaxForwards().GetMaxForwards(), len(msg.GetVia()))
		}
		// The Request-URI is left for the peer EdgePort
		if msg.GetRequestUri().GetHost() != "sip.local" {
			t.Errorf("requestUri = %v", msg.GetRequestUri())
		}
	})
}

func TestHandleRequestLocationNotFound(t *testing.T) {
	env := newTestEnv(t, nil)
	env.location.findErr = status.Error(codes.NotFound, "no routes found for aor: sip:1002@sip.local")
	if res := env.process(t, agentInvite(env.now)); responseTypeOf(res) != "TEMPORARILY_UNAVAILABLE" {
		t.Errorf("response = %v, want 480", res)
	}
}
