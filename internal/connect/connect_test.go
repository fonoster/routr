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
	"bufio"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func TestNew(t *testing.T) {
	env := newTestEnv(t, nil)
	all := Dependencies{Location: env.location, Agents: env.agents, Domains: env.domains}
	spec := config.ConnectSpec{NonceMaxAge: 300, RegisterDefaultExpires: 3600}
	tests := []struct {
		name string
		spec config.ConnectSpec
		deps Dependencies
	}{
		{"negative nonceMaxAge", config.ConnectSpec{NonceMaxAge: -1}, all},
		{"negative registerDefaultExpires", config.ConnectSpec{RegisterDefaultExpires: -1}, all},
		{"no location", spec, Dependencies{Agents: env.agents, Domains: env.domains}},
		{"no agents", spec, Dependencies{Location: env.location, Domains: env.domains}},
		{"no domains", spec, Dependencies{Location: env.location, Agents: env.agents}},
	}
	for _, tt := range tests {
		if _, err := New(tt.spec, Trust{}, tt.deps, Options{}); err == nil {
			t.Errorf("%s: New() expected an error", tt.name)
		}
	}
	c, err := New(spec, Trust{EdgePorts: []string{"edgeport-02"}, EdgePortAddresses: []string{"10.0.0.0/24"}}, all, Options{})
	if err != nil || c.log == nil || c.now == nil || c.nonceMaxAge != 300 || c.registerDefaultExpires != 3600 {
		t.Errorf("New() = %+v, %v", c, err)
	}
	if len(c.trust.refs) != 1 || len(c.trust.addresses) != 1 {
		t.Errorf("the trust is kept: %+v", c.trust)
	}
	// The zero spec is Routr 2's defaults, with any nonce accepted
	c, err = New(config.ConnectSpec{}, Trust{}, all, Options{})
	if err != nil || c.nonceMaxAge != 0 || c.registerDefaultExpires != config.DefaultRegisterDefaultExpires {
		t.Errorf("New(zero) = %+v, %v", c, err)
	}
}

func TestProcessMessageValidation(t *testing.T) {
	env := newTestEnv(t, nil)
	for name, in := range map[string]*ppb.MessageRequest{"nil": nil, "no message": {Ref: "x"}} {
		_, err := env.connect.ProcessMessage(context.Background(), in)
		if status.Code(err) != codes.InvalidArgument {
			t.Errorf("%s: error = %v, want InvalidArgument", name, err)
		}
	}
}

func TestDispatchResponse(t *testing.T) {
	env := newTestEnv(t, nil)
	req := agentInvite(env.now)
	req.Message.MessageType = &spb.SIPMessage_ResponseType{ResponseType: spb.ResponseType_RINGING}
	req.Message.ReasonPhrase = "Ringing"
	req.Metadata = map[string]string{"k": "v"}
	before := proto.Clone(req).(*ppb.MessageRequest)

	res := env.process(t, req)
	if responseTypeOf(res) != "RINGING" {
		t.Fatalf("response = %v", res)
	}
	if vias := res.GetMessage().GetVia(); len(vias) != 1 || vias[0].GetHost() != "127.0.0.1" {
		t.Errorf("via = %v, want our own removed", vias)
	}
	if res.GetMetadata()["k"] != "v" || !proto.Equal(res.GetSender(), req.GetSender()) {
		t.Error("the sender or the metadata were not kept")
	}
	if env.agents.calls != 0 || env.location.findCalls != 0 {
		t.Error("a response was looked up")
	}
	if !proto.Equal(before, req) {
		t.Error("the request received was changed")
	}
}

func TestDispatchMethodNotAllowed(t *testing.T) {
	env := newTestEnv(t, nil)
	for _, m := range []ppb.Method{ppb.Method_PUBLISH, ppb.Method_NOTIFY, ppb.Method_SUBSCRIBE, ppb.Method_MESSAGE, ppb.Method_REFER} {
		req := newRequest(env.now, requestOpts{method: m, fromUser: "1001", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local"})
		res := env.process(t, req)
		if responseTypeOf(res) != "METHOD_NOT_ALLOWED" || res.GetMessage().GetReasonPhrase() != "Method Not Allowed" {
			t.Errorf("%s: response = %v", m, res)
		}
	}
}

// inDialog is the fixture of the Node in-dialog tests: a request inside a
// dialog carries the To tag and a Route back to this EdgePort.
func inDialog(env *testEnv, method ppb.Method) *ppb.MessageRequest {
	req := newRequest(env.now, requestOpts{method: method, fromUser: "1001", fromDomain: "sip.local", toUser: "sipp", toDomain: "10.111.221.22", noAuth: true})
	req.Message.To.Tag = "callee-tag"
	req.Message.Route = []*spb.Route{{Address: &spb.Address{Uri: &spb.SipURI{Host: "10.100.42.127", Port: 5060, LrParam: true, TransportParam: "UDP"}}}}
	return req
}

func expectForwardedAlongTheRouteSet(t *testing.T, res *ppb.MessageResponse, original *ppb.MessageRequest) {
	t.Helper()
	if responseTypeOf(res) != "" {
		t.Fatalf("response = %v, want the request forwarded", res)
	}
	msg := res.GetMessage()
	// Request-URI untouched: the remote target, not a trunk or an agent
	if msg.GetRequestUri().GetHost() != original.GetMessage().GetRequestUri().GetHost() || msg.GetRequestUri().GetUser() != original.GetMessage().GetRequestUri().GetUser() {
		t.Errorf("requestUri = %v", msg.GetRequestUri())
	}
	// Our own Route was consumed, nothing else was added to the route set
	if len(msg.GetRoute()) != 0 {
		t.Errorf("route = %v", hops(msg.GetRoute()))
	}
	if msg.GetMaxForwards().GetMaxForwards() != original.GetMessage().GetMaxForwards().GetMaxForwards()-1 {
		t.Errorf("maxForwards = %d", msg.GetMaxForwards().GetMaxForwards())
	}
	// No new-call treatment: no gateway auth, no direction
	if extensionValue(msg, headerGatewayAuth) != "" || extensionValue(msg, headerCallDirection) != "" {
		t.Error("an in-dialog request got the new-call treatment")
	}
	if len(msg.GetVia()) != 3 || msg.GetVia()[0].GetHost() != "200.22.21.42" {
		t.Errorf("via = %v", msg.GetVia())
	}
}

func TestDispatchInDialog(t *testing.T) {
	t.Run("forwards an agent's re-INVITE along the route set instead of routing it", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := inDialog(env, ppb.Method_INVITE)
		expectForwardedAlongTheRouteSet(t, env.process(t, req), req)
		if env.agents.calls != 0 || env.location.findCalls != 0 {
			t.Error("an in-dialog request was looked up")
		}
	})
	t.Run("forwards a re-INVITE without credentials instead of challenging it", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := inDialog(env, ppb.Method_INVITE)
		req.Message.Authorization = nil
		expectForwardedAlongTheRouteSet(t, env.process(t, req), req)
	})
	for _, m := range []ppb.Method{ppb.Method_REFER, ppb.Method_NOTIFY, ppb.Method_UPDATE, ppb.Method_INFO, ppb.Method_BYE, ppb.Method_ACK} {
		t.Run("forwards an in-dialog "+m.String(), func(t *testing.T) {
			env := newTestEnv(t, nil)
			req := inDialog(env, m)
			expectForwardedAlongTheRouteSet(t, env.process(t, req), req)
		})
	}
	t.Run("forwards a BYE and an ACK without a To tag too", func(t *testing.T) {
		for _, m := range []ppb.Method{ppb.Method_BYE, ppb.Method_ACK} {
			env := newTestEnv(t, nil)
			req := inDialog(env, m)
			req.Message.To.Tag = ""
			expectForwardedAlongTheRouteSet(t, env.process(t, req), req)
		}
	})
	t.Run("still refuses a NOTIFY and a REFER outside a dialog", func(t *testing.T) {
		for _, m := range []ppb.Method{ppb.Method_NOTIFY, ppb.Method_REFER} {
			env := newTestEnv(t, nil)
			req := inDialog(env, m)
			req.Message.To.Tag = ""
			if res := env.process(t, req); responseTypeOf(res) != "METHOD_NOT_ALLOWED" {
				t.Errorf("%s: response = %v", m, res)
			}
		}
	})
	t.Run("a REGISTER with a To tag is still a registration", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := registerRequest(env.now, requestOpts{noAuth: true})
		req.Message.To.Tag = "tag"
		expectChallenge(t, env.process(t, req), "sip.local", false)
	})
	t.Run("a CANCEL with a To tag keeps its own path", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := inDialog(env, ppb.Method_CANCEL)
		res := env.process(t, req)
		// The last-message route points the Request-URI at itself: untouched
		if responseTypeOf(res) != "" || res.GetMessage().GetRequestUri().GetHost() != "10.111.221.22" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("answers 502 when the next hop wants a transport this EdgePort lacks", func(t *testing.T) {
		env := newTestEnv(t, nil)
		req := inDialog(env, ppb.Method_BYE)
		req.Message.GetRequestUri().TransportParam = "TLS"
		if res := env.process(t, req); responseTypeOf(res) != "BAD_GATEWAY" {
			t.Errorf("response = %v, want 502", res)
		}
	})
}

// The corpus replay: the SEET agent-to-agent recordings (etc/corpus), made
// with Routr 2, through this processor. Every message the Node Connect
// sent, this one must send too, byte for byte at the gRPC boundary; the
// nonces differ, since Routr 2.17 did not stamp them.

type corpusRecord struct {
	Seq      int             `json:"seq"`
	Kind     string          `json:"kind"`
	Method   string          `json:"method"`
	Request  json.RawMessage `json:"request"`
	Response struct {
		Message json.RawMessage `json:"message"`
	} `json:"response"`
}

func loadCorpus(t *testing.T, name string) []corpusRecord {
	t.Helper()
	f, err := os.Open(filepath.Join("..", "..", "etc", "corpus", name))
	if err != nil {
		t.Fatalf("corpus: %v", err)
	}
	defer f.Close()
	var records []corpusRecord
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1<<20), 1<<24)
	for scanner.Scan() {
		if len(scanner.Bytes()) == 0 {
			continue
		}
		var r corpusRecord
		if err := json.Unmarshal(scanner.Bytes(), &r); err != nil {
			t.Fatalf("corpus %s: %v", name, err)
		}
		records = append(records, r)
	}
	return records
}

func replay(t *testing.T, env *testEnv, name string) {
	t.Helper()
	unmarshal := protojson.UnmarshalOptions{DiscardUnknown: true}
	nonceFormat := regexp.MustCompile(`^[0-9a-f]+\.[0-9a-f]{32}$`)
	for _, rec := range loadCorpus(t, name) {
		req := &ppb.MessageRequest{}
		if err := unmarshal.Unmarshal(rec.Request, req); err != nil {
			t.Fatalf("%s seq %d: request: %v", name, rec.Seq, err)
		}
		want := &spb.SIPMessage{}
		if err := unmarshal.Unmarshal(rec.Response.Message, want); err != nil {
			t.Fatalf("%s seq %d: response: %v", name, rec.Seq, err)
		}
		res := env.process(t, req)
		got := res.GetMessage()
		if www := got.GetWwwAuthenticate(); www != nil && want.GetWwwAuthenticate() != nil {
			if !nonceFormat.MatchString(www.GetNonce()) {
				t.Errorf("%s seq %d: nonce %q is not <hex seconds>.<md5>", name, rec.Seq, www.GetNonce())
			}
			www.Nonce = want.GetWwwAuthenticate().GetNonce()
		}
		if !proto.Equal(got, want) {
			t.Errorf("%s seq %d (%s %s):\n got %s\nwant %s", name, rec.Seq, rec.Kind, rec.Method, protojson.Format(got), protojson.Format(want))
		}
	}
}

func TestCorpusAgentToAgent(t *testing.T) {
	cfg := testConfig()
	// The recorded requests answer the nonces Routr 2 issued that day
	zero := 0
	cfg.Spec.NonceMaxAge = &zero
	env := newTestEnv(t, cfg)

	// Agent 1002 registers, then Agent 1001 calls it: the route the INVITE
	// finds is the one the REGISTER bound
	replay(t, env, "seet-agent-1002_register-before-rr-1.1.2-agent-to-agent_routr_20261023.jsonl")
	if len(env.location.added) != 1 || env.location.added[0].GetAor() != "sip:1002@sip.local" {
		t.Fatalf("registrations = %v", env.location.added)
	}
	replay(t, env, "seet-agent-1001_rr-1.1.2-agent-to-agent_agent-1002_20261023.jsonl")
}

func TestInDialogStripsUntrustedHeaders(t *testing.T) {
	withPlatformHeaders := func(req *ppb.MessageRequest) {
		req.Message.Extensions = append(req.Message.Extensions,
			&spb.Extension{Name: "X-App-Ref", Value: "evil"}, &spb.Extension{Name: "x-call-ref", Value: "x"})
	}
	kept := func(res *ppb.MessageResponse) bool {
		return extensionValue(res.GetMessage(), "X-App-Ref") != "" || extensionValue(res.GetMessage(), "X-Call-Ref") != ""
	}
	for _, m := range []ppb.Method{ppb.Method_BYE, ppb.Method_INVITE, ppb.Method_UPDATE, ppb.Method_INFO, ppb.Method_REFER, ppb.Method_NOTIFY} {
		for _, side := range []string{"caller", "callee"} {
			t.Run(m.String()+" from the "+side, func(t *testing.T) {
				env := newTestEnv(t, nil)
				req := inDialog(env, m)
				if side == "callee" {
					from, to := req.Message.From, req.Message.To
					from.Address, to.Address = to.Address, from.Address
				}
				withPlatformHeaders(req)
				res := env.process(t, req)
				if responseTypeOf(res) != "" || kept(res) {
					t.Errorf("response = %v, want it forwarded without the platform headers", res)
				}
			})
		}
	}
	t.Run("untrustedHeadersToStrip [] keeps them", func(t *testing.T) {
		env := newTestEnv(t, &testSettings{Spec: testConfig().Spec, UntrustedHeaders: []string{}})
		req := inDialog(env, ppb.Method_BYE)
		withPlatformHeaders(req)
		res := env.process(t, req)
		if responseTypeOf(res) != "" || extensionValue(res.GetMessage(), "X-App-Ref") != "evil" || extensionValue(res.GetMessage(), "X-Call-Ref") != "x" {
			t.Errorf("response = %v, want the headers kept", res)
		}
	})
	t.Run("a crossed dialog", func(t *testing.T) {
		rr := crossedInvite(t).GetRecordRoute()
		callee := &spb.SipURI{User: "1002", Host: calleeHost, Port: 40000, TransportParam: "UDP"}
		env := newTestEnv(t, crossedConfig())
		req := bye(env, routeSet(rr, true), callee)
		onEdgePort(req, "edgeport-b", edgePortB, &ppb.NetInterface{Host: "10.244.0.1", Port: 33000, Transport: common.Transport_TCP})
		withPlatformHeaders(req)
		res := env.process(t, req)
		if responseTypeOf(res) != "" || kept(res) {
			t.Errorf("response = %v, want it forwarded without the platform headers", res)
		}
	})
}
