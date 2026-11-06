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
	"regexp"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/pb/connect/trace"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func registerRequest(now time.Time, o requestOpts) *ppb.MessageRequest {
	o.method = ppb.Method_REGISTER
	if o.fromUser == "" {
		o.fromUser, o.fromDomain, o.toUser, o.toDomain = "1001", "sip.local", "1001", "sip.local"
	}
	req := newRequest(now, o)
	req.Message.GetRequestUri().User = ""
	return req
}

func expectChallenge(t *testing.T, res *ppb.MessageResponse, realm string, stale bool) {
	t.Helper()
	if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetReasonPhrase() != "Unauthorized" {
		t.Fatalf("response = %v, want 401 Unauthorized", res)
	}
	www := res.GetMessage().GetWwwAuthenticate()
	if www.GetScheme() != "Digest" || www.GetRealm() != realm || www.GetQop() != "auth" || www.GetAlgorithm() != "MD5" || www.GetOpaque() != "" || www.GetDomain() != "" {
		t.Errorf("WWW-Authenticate = %v", www)
	}
	if www.GetStale() != stale {
		t.Errorf("stale = %v, want %v", www.GetStale(), stale)
	}
	if !regexp.MustCompile(`^[0-9a-f]+\.[0-9a-f]{32}$`).MatchString(www.GetNonce()) {
		t.Errorf("nonce = %q, want <hex seconds>.<md5>", www.GetNonce())
	}
	if res.GetSender() != nil || len(res.GetMetadata()) != 0 {
		t.Error("a challenge carries a sender or metadata")
	}
}

func TestHandleRegister(t *testing.T) {
	t.Run("challenges a REGISTER without credentials", func(t *testing.T) {
		env := newTestEnv(t, nil)
		res := env.process(t, registerRequest(env.now, requestOpts{noAuth: true}))
		expectChallenge(t, res, "sip.local", false)
		if len(env.location.added) != 0 || env.agents.calls != 0 {
			t.Error("a challenge needs nothing from the database")
		}
	})
	t.Run("binds the contact and answers 200 with it", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := registerRequest(env.now, requestOpts{})
		res := env.process(t, req)
		if responseTypeOf(res) != "OK" || res.GetMessage().GetReasonPhrase() != "" {
			t.Fatalf("response = %v, want 200", res)
		}
		if !proto.Equal(res.GetMessage().GetContact(), req.GetMessage().GetContact()) {
			t.Errorf("contact = %v, want the registered one", res.GetMessage().GetContact())
		}
		if len(res.GetMessage().GetExtensions()) != 0 || res.GetMessage().GetVia() != nil || len(res.GetMetadata()) != 0 {
			t.Errorf("the 200 carries more than the Node code sent: %v", res)
		}
		if len(env.location.added) != 1 {
			t.Fatalf("addRoute calls = %d, want 1", len(env.location.added))
		}
		added := env.location.added[0]
		if added.GetAor() != "sip:1001@sip.local" || added.GetMaxContacts() != -1 {
			t.Errorf("addRoute(%s, maxContacts %d)", added.GetAor(), added.GetMaxContacts())
		}
		r := added.GetRoute()
		if r.GetUser() != "1001" || r.GetHost() != "127.0.0.1" || r.GetPort() != "5060" || r.GetExpires() != 60 || r.GetEdgePortRef() != "edgeport-01" {
			t.Errorf("route = %v", r)
		}
	})
	t.Run("grants the configured default expiry", func(t *testing.T) {
		cfg := testConfig()
		expires := 600
		cfg.Spec.RegisterDefaultExpires = &expires
		env := newTestEnv(t, cfg)
		req := registerRequest(env.now, requestOpts{})
		req.Message.Expires = nil
		env.process(t, req)
		if got := env.location.added[0].GetRoute().GetExpires(); got != 600 {
			t.Errorf("expires = %d, want 600", got)
		}
	})
	t.Run("challenges wrong credentials", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := registerRequest(env.now, requestOpts{})
		req.Message.Authorization.Response = "0000000000000000000000000000dead"
		expectChallenge(t, env.process(t, req), "sip.local", false)
		if len(env.location.added) != 0 {
			t.Error("a route was added")
		}
	})
	t.Run("asks again, with stale, when the nonce has expired", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := registerRequest(env.now, requestOpts{nonce: auth.GenerateNonce(func() time.Time { return env.now.Add(-400 * time.Second) })})
		expectChallenge(t, env.process(t, req), "sip.local", true)
		if len(env.location.added) != 0 {
			t.Error("a route was added")
		}
	})
	t.Run("refuses an unknown Agent", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := registerRequest(env.now, requestOpts{fromUser: "1003", fromDomain: "sip.local", toUser: "1003", toDomain: "sip.local"})
		res := env.process(t, req)
		if responseTypeOf(res) != "FORBIDDEN" || res.GetMessage().GetReasonPhrase() != "Forbidden" {
			t.Errorf("response = %v, want 403 Forbidden", res)
		}
	})
	t.Run("refuses an Agent of another Domain", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := registerRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.localx", toUser: "1001", toDomain: "sip.localx"})
		if res := env.process(t, req); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v, want 403", res)
		}
	})
	t.Run("answers 403 with the reason when the Location refuses the binding", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.location.addErr = status.Error(codes.InvalidArgument, "exceeds maximum of 1 allowed contacts")
		res := env.process(t, registerRequest(env.now, requestOpts{}))
		if responseTypeOf(res) != "FORBIDDEN" || res.GetMessage().GetReasonPhrase() != "exceeds maximum of 1 allowed contacts" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("answers 500 when the Location fails", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.location.addErr = errors.New("down")
		res := env.process(t, registerRequest(env.now, requestOpts{}))
		if responseTypeOf(res) != "SERVER_INTERNAL_ERROR" || res.GetMessage().GetReasonPhrase() != "Internal Server Error" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("flags the registration for recording when the Agent asks", func(t *testing.T) {
		env := newTestEnv(t, nil)
		env.agents.items[0].Trace = &trace.Trace{Enabled: true}
		res := env.process(t, registerRequest(env.now, requestOpts{}))
		if res.GetMetadata()["trace.record"] != "agent-01" {
			t.Errorf("metadata = %v", res.GetMetadata())
		}
	})
	t.Run("refuses a Connect Token, which has no verifier yet", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := registerRequest(env.now, requestOpts{noAuth: true})
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "X-Connect-Token", Value: "token"})
		if res := env.process(t, req); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v, want 403", res)
		}
	})
}

func TestHandleRegistry(t *testing.T) {
	env := newTestEnv(t, nil)
	req := registerRequest(env.now, requestOpts{})
	req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: headerGatewayAuth, Value: "cGJ4LTE6MTIzNA=="}, &spb.Extension{Name: headerEdgePortRef, Value: "edgeport-01"})
	req.Message.GetRequestUri().Host = "sip.provider.net"
	res := env.process(t, req)
	if responseTypeOf(res) != "" {
		t.Fatalf("response = %v, want the REGISTER forwarded", res)
	}
	msg := res.GetMessage()
	if len(msg.GetVia()) != 3 || msg.GetVia()[0].GetHost() != "200.22.21.42" {
		t.Errorf("via = %v", msg.GetVia())
	}
	if msg.GetMaxForwards().GetMaxForwards() != 69 || msg.GetAuthorization() != nil {
		t.Errorf("maxForwards %d, authorization %v", msg.GetMaxForwards().GetMaxForwards(), msg.GetAuthorization())
	}
	// Both Routes of the fixture point at this EdgePort's localnets
	if got := hops(msg.GetRoute()); len(got) != 0 {
		t.Errorf("route = %v, want none", got)
	}
	if extensionValue(msg, headerEdgePortRef) != "" || extensionValue(msg, headerGatewayAuth) == "" {
		t.Error("X-Edgeport-Ref survived or X-Gateway-Auth was lost")
	}
	if len(env.location.added) != 0 || env.agents.calls != 0 {
		t.Error("a Trunk REGISTER is not a registration")
	}

	t.Run("answers 502 for a transport this EdgePort lacks", func(t *testing.T) {
		req := registerRequest(env.now, requestOpts{})
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: headerGatewayAuth, Value: "x"})
		req.Message.GetRequestUri().TransportParam = "TLS"
		if res := env.process(t, req); responseTypeOf(res) != "BAD_GATEWAY" {
			t.Errorf("response = %v, want 502", res)
		}
	})
}
