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
	"fmt"
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trace"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func testNow() time.Time {
	return time.Date(2026, 10, 23, 21, 43, 34, 0, time.UTC)
}

// The resources of etc/corpus/resources the recordings touch.

func corpusTrunk(ref, inboundURI string) *trunks.Trunk {
	return &trunks.Trunk{
		Ref:                 ref,
		InboundUri:          inboundURI,
		OutboundCredentials: &credentials.Credentials{Ref: "credentials-04", Username: "pbx-1", Password: "1234"},
		Uris:                []*trunks.TrunkURI{{User: "pbx-1", Host: "sip.provider.net", Port: 7060, Transport: "udp", Priority: 10, Weight: 10, Enabled: proto.Bool(true)}},
	}
}

func corpusACL() *acl.AccessControlList {
	return &acl.AccessControlList{
		Ref:   "acl-01",
		Deny:  []string{"0.0.0.0/1"},
		Allow: []string{"192.168.1.3/31", "127.0.0.1/8", "10.111.221.22/31"},
	}
}

// corpusEnv is a Connect that answers the recordings: any nonce is fresh, and
// the resources are those of the replay.
func corpusEnv(t *testing.T) *testEnv {
	t.Helper()
	cfg := testConfig()
	zero := 0
	cfg.Spec.NonceMaxAge = &zero
	env := newTestEnv(t, cfg)

	trunk01 := corpusTrunk("trunk-01", "trunk01.acme.com")
	trunk01.AccessControlList = corpusACL()
	trunk01.SendRegister = true
	trunk02 := corpusTrunk("trunk-02", "trunk02.acme.com")
	trunk02.AccessControlList = corpusACL()
	trunk02.InboundCredentials = &credentials.Credentials{Ref: "credentials-04", Username: "pbx-1", Password: "1234"}
	env.trunks.items = []*trunks.Trunk{trunk01, trunk02}

	number01 := &numbers.Number{Ref: "number-01", TelUrl: "tel:+17066041487", AorLink: "sip:conference@sip.local", SessionAffinityHeader: "X-Room-Id", Trunk: trunk01,
		ExtraHeaders: []*numbers.ExtraHeader{{Name: "X-Room-Id", Value: "jsa-shqm-iyo"}}}
	env.numbers.items = []*numbers.Number{
		number01,
		{Ref: "number-03", TelUrl: "tel:+18295863314", AorLink: "sip:1001@sip.local", Trunk: trunk02},
		{Ref: "number-06", TelUrl: "tel:+18295863315", AorLink: "sip:1002@sip.local", Trunk: trunk02},
	}
	env.peers.items = []*peers.Peer{{
		Ref: "peer-01", Username: "asterisk", Aor: "sip:conference@sip.local", MaxContacts: -1,
		Credentials:        &credentials.Credentials{Ref: "credentials-03", Username: "asterisk", Password: "1234"},
		BalancingAlgorithm: peers.LoadBalancingAlgorithm_LEAST_SESSIONS, WithSessionAffinity: true,
	}}
	domain := testDomain()
	domain.AccessControlList = corpusACL()
	domain.EgressPolicies = []*domains.EgressPolicy{{Rule: ".*", NumberRef: "number-01", Number: number01}}
	env.domains.items = []*domains.Domain{domain}
	for _, a := range env.agents.items {
		a.Domain = domain
	}
	env.agents.items[0].Privacy = agents.Privacy_PRIVATE
	env.agents.items[1].Privacy = agents.Privacy_NONE
	return env
}

func TestCorpusProvider(t *testing.T) {
	tests := []struct {
		name  string
		files []string
	}{
		{"sc-1.3.1, agent 1001, privacy Private", []string{"seet-agent-1001_sc-1.3.1-dod-invite_provider_20261106.jsonl"}},
		{"sc-1.3.1, agent 1002, privacy None", []string{"seet-agent-1002_sc-1.3.1-dod-invite_provider_20261023.jsonl"}},
		{"sc-1.3.2", []string{
			"seet-agent-1001_register-before-sc-1.3.2-did-invite_routr_20261023.jsonl",
			"seet-provider_sc-1.3.2-did-invite_agent-1001_20261023.jsonl",
		}},
		{"rr-1.2.1", []string{"seet-agent-1001_rr-1.2.1-dod-declined_provider_20261106.jsonl"}},
		{"sc-12.2.1", []string{"seet-agent-1001_sc-12.2.1-dod-reinvite_provider_20261106.jsonl"}},
		{"sc-12.1.1", []string{
			"seet-agent-1002_register-before-sc-12.1.1-blind-transfer_routr_20261023.jsonl",
			"seet-agent-1001_sc-12.1.1-blind-transfer_provider_20261106.jsonl",
			"seet-provider_sc-12.1.1-transfer-target_agent-1002_20261023.jsonl",
		}},
		{"a Peer calling out by alias", []string{"sipp-peer-asterisk_dod-invite-route-by-alias_provider_20261030.jsonl"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := corpusEnv(t)
			for _, file := range tt.files {
				replay(t, env, file)
			}
		})
	}
}

// pstnInvite is an INVITE from a Trunk's carrier to a Number.
func pstnInvite(env *testEnv, toUser string) *ppb.MessageRequest {
	return newRequest(env.now, requestOpts{fromUser: "+19195551212", fromDomain: "newyork1.voip.ms", toUser: toUser, toDomain: "newyork1.voip.ms", requestURIHost: "trunk01.acme.com", noAuth: true})
}

// routeTo binds a route at the AOR, on the networks of the request.
func routeTo(env *testEnv, req *ppb.MessageRequest, aor string) *lpb.Route {
	r := r1()
	r.ListeningPoints = req.GetListeningPoints()
	r.Localnets = req.GetLocalnets()
	r.ExternalAddrs = req.GetExternalAddrs()
	r.Transport = common.Transport_UDP
	env.location.routes[aor] = []*lpb.Route{r}
	return r
}

// peerInvite is an authenticated INVITE from Peer asterisk.
func peerInvite(env *testEnv, dodNumber string) *ppb.MessageRequest {
	req := newRequest(env.now, requestOpts{fromUser: "asterisk", fromDomain: "sip.local", toUser: "+17853178070", toDomain: "sip.local"})
	if dodNumber != "" {
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "X-DOD-Number", Value: dodNumber})
	}
	return req
}

func TestAgentToPSTN(t *testing.T) {
	invite := func(env *testEnv) *ppb.MessageRequest {
		return newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "17853178070", toDomain: "sip.local"})
	}
	t.Run("leaves through the Number of the first matching policy", func(t *testing.T) {
		env := corpusEnv(t)
		res := env.process(t, invite(env))
		msg := res.GetMessage()
		ruri := msg.GetRequestUri()
		if ruri.GetUser() != "17853178070" || ruri.GetHost() != "sip.provider.net" || ruri.GetPort() != 7060 || ruri.GetTransportParam() != "UDP" {
			t.Errorf("Request-URI = %v", ruri)
		}
		for name, want := range map[string]string{
			"Privacy":             "id",
			"Remote-Party-ID":     "<sip:+17066041487@sip.provider.net>;screen=yes;party=calling",
			"X-Gateway-Auth":      "cGJ4LTE6MTIzNA==",
			"X-Call-Direction":    "agent-to-pstn",
			"P-Asserted-Identity": "<sip:+17066041487@sip.provider.net;user=phone>",
		} {
			if got := extensionValue(msg, name); got != want {
				t.Errorf("%s = %q, want %q", name, got, want)
			}
		}
		if res.GetMetadata()["trace.direction"] != "agent-to-pstn" || res.GetMetadata()["trace.trunk"] != "trunk-01" {
			t.Errorf("metadata = %v", res.GetMetadata())
		}
	})
	t.Run("Privacy follows the Agent's setting, not what the Agent sent", func(t *testing.T) {
		for _, tt := range []struct {
			setting agents.Privacy
			sent    string
			want    string
		}{
			{agents.Privacy_PRIVATE, "", "id"},
			{agents.Privacy_PRIVATE, "none", "id"},
			{agents.Privacy_NONE, "", "none"},
			{agents.Privacy_NONE, "id", "none"},
		} {
			env := corpusEnv(t)
			env.agents.items[0].Privacy = tt.setting
			req := invite(env)
			if tt.sent != "" {
				req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "Privacy", Value: tt.sent})
			}
			var got []string
			for _, ext := range env.process(t, req).GetMessage().GetExtensions() {
				if ext.GetName() == "Privacy" {
					got = append(got, ext.GetValue())
				}
			}
			if len(got) != 1 || got[0] != tt.want {
				t.Errorf("setting %v, sent %q: Privacy = %v, want [%s]", tt.setting, tt.sent, got, tt.want)
			}
		}
	})
	t.Run("skips a policy that does not match", func(t *testing.T) {
		env := corpusEnv(t)
		env.domains.items[0].EgressPolicies = append([]*domains.EgressPolicy{{Rule: "^44", NumberRef: "number-x"}}, env.domains.items[0].EgressPolicies...)
		if res := env.process(t, invite(env)); responseTypeOf(res) != "" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("500 when no policy matches, a rule does not compile or the Number has no Trunk", func(t *testing.T) {
		for _, policy := range []*domains.EgressPolicy{
			{Rule: "^44", NumberRef: "number-x"},
			{Rule: "(", NumberRef: "number-x"},
			{Rule: ".*", NumberRef: "number-x", Number: &numbers.Number{Ref: "number-x"}},
		} {
			env := corpusEnv(t)
			env.domains.items[0].EgressPolicies = []*domains.EgressPolicy{policy}
			if res := env.process(t, invite(env)); responseTypeOf(res) != "SERVER_INTERNAL_ERROR" {
				t.Errorf("rule %q = %v", policy.GetRule(), res)
			}
		}
	})
	t.Run("flags the call for recording when the Trunk asks, over the Agent", func(t *testing.T) {
		env := corpusEnv(t)
		env.agents.items[0].Trace = &trace.Trace{Enabled: true}
		if res := env.process(t, invite(env)); res.GetMetadata()["trace.record"] != "agent-01" {
			t.Errorf("metadata = %v", res.GetMetadata())
		}
		env.trunks.items[0].Trace = &trace.Trace{Enabled: true}
		if res := env.process(t, invite(env)); res.GetMetadata()["trace.record"] != "trunk-01" {
			t.Errorf("metadata = %v", res.GetMetadata())
		}
	})
	t.Run("presents the Number on a Trunk with rewriteFromWithNumber and normalizes", func(t *testing.T) {
		env := corpusEnv(t)
		env.trunks.items[0].RewriteFromWithNumber = true
		env.trunks.items[0].NormalizeToE164 = true
		env.trunks.items[0].FromDomain = "wa.example.com"
		msg := env.process(t, invite(env)).GetMessage()
		from := msg.GetFrom().GetAddress().GetUri()
		if from.GetUser() != "+17066041487" || from.GetHost() != "wa.example.com" || from.GetUserParam() != "phone" {
			t.Errorf("From = %v", from)
		}
		if msg.GetRequestUri().GetUser() != "+17853178070" || msg.GetTo().GetAddress().GetUri().GetUser() != "+17853178070" {
			t.Errorf("users = %v, %v", msg.GetRequestUri(), msg.GetTo())
		}
		if decodeIdentityUser(msg.GetRecordRoute()[0].GetAddress().GetUri().GetUser()) == nil {
			t.Errorf("Record-Route = %v", msg.GetRecordRoute()[0])
		}
	})
	t.Run("leaves the identity alone with the settings off", func(t *testing.T) {
		env := corpusEnv(t)
		msg := env.process(t, invite(env)).GetMessage()
		if u := msg.GetFrom().GetAddress().GetUri(); u.GetUser() != "1001" || u.GetHost() != "sip.local" {
			t.Errorf("From = %v", u)
		}
		if msg.GetRecordRoute()[0].GetAddress().GetUri().GetUser() != "" {
			t.Errorf("Record-Route = %v", msg.GetRecordRoute()[0])
		}
	})
}

func TestPeerToPSTN(t *testing.T) {
	t.Run("leaves through the Number in X-DOD-Number", func(t *testing.T) {
		env := corpusEnv(t)
		res := env.process(t, peerInvite(env, "+17066041487"))
		msg := res.GetMessage()
		if msg.GetRequestUri().GetHost() != "sip.provider.net" || extensionValue(msg, "X-Call-Direction") != "peer-to-pstn" {
			t.Errorf("message = %v", msg)
		}
		if got := extensionValue(msg, "X-DOD-Number"); got != "+17066041487" {
			t.Errorf("an authenticated Peer lost X-DOD-Number: %q", got)
		}
	})
	t.Run("Privacy follows X-DOD-Privacy", func(t *testing.T) {
		for dod, want := range map[string]string{"": "none", "id": "id", "ID": "id", "none": "none", "private": "none"} {
			env := corpusEnv(t)
			req := peerInvite(env, "+17066041487")
			if dod != "" {
				req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "X-DOD-Privacy", Value: dod})
			}
			if got := extensionValue(env.process(t, req).GetMessage(), "Privacy"); got != want {
				t.Errorf("X-DOD-Privacy %q: Privacy = %q, want %q", dod, got, want)
			}
		}
	})
	t.Run("400 without X-DOD-Number", func(t *testing.T) {
		env := corpusEnv(t)
		res := env.process(t, peerInvite(env, ""))
		if responseTypeOf(res) != "BAD_REQUEST" || res.GetMessage().GetReasonPhrase() != "Missing or empty 'X-DOD-Number' header required for peer-to-pstn routing" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("404 for a Number that does not exist", func(t *testing.T) {
		env := corpusEnv(t)
		res := env.process(t, peerInvite(env, "+10000000000"))
		if responseTypeOf(res) != "NOT_FOUND" || res.GetMessage().GetReasonPhrase() != "No Number found for tel:+10000000000" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("a Number bound to an access key", func(t *testing.T) {
		bound := func(env *testEnv) {
			extended, err := structpb.NewStruct(map[string]any{"accessKeyId": "WO00000000"})
			if err != nil {
				t.Fatal(err)
			}
			env.numbers.items[0].Extended = extended
		}
		env := corpusEnv(t)
		bound(env)
		if res := env.process(t, peerInvite(env, "+17066041487")); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("no key = %v", res)
		}
		wrong := peerInvite(env, "+17066041487")
		wrong.Message.Extensions = append(wrong.Message.Extensions, &spb.Extension{Name: "X-Access-Key-Id", Value: "other"})
		if res := env.process(t, wrong); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("wrong key = %v", res)
		}
		right := peerInvite(env, "+17066041487")
		right.Message.Extensions = append(right.Message.Extensions, &spb.Extension{Name: "X-Access-Key-Id", Value: "WO00000000"})
		if res := env.process(t, right); responseTypeOf(res) != "" {
			t.Errorf("right key = %v", res)
		}
	})
	t.Run("a Peer without credentials is forbidden", func(t *testing.T) {
		env := corpusEnv(t)
		env.peers.items[0].Credentials = nil
		if res := env.process(t, peerInvite(env, "+17066041487")); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v", res)
		}
	})
}

func TestPeerToAgentIsAnsweredAsInRoutr2(t *testing.T) {
	env := corpusEnv(t)
	req := newRequest(env.now, requestOpts{fromUser: "asterisk", fromDomain: "sip.local", toUser: "1001", toDomain: "sip.local"})
	if res := env.process(t, req); responseTypeOf(res) != "SERVER_INTERNAL_ERROR" {
		t.Errorf("response = %v", res)
	}
	req.Message.Authorization = nil
	if res := env.process(t, req); responseTypeOf(res) != "UNAUTHORIZED" {
		t.Errorf("without credentials = %v, want the challenge", res)
	}
}

func TestAgentToPeer(t *testing.T) {
	env := corpusEnv(t)
	req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "asterisk", toDomain: "sip.local"})
	routeTo(env, req, "sip:conference@sip.local")
	res := env.process(t, req)
	if extensionValue(res.GetMessage(), "X-Call-Direction") != "agent-to-peer" {
		t.Errorf("message = %v", res.GetMessage())
	}
	found := env.location.found[0]
	if found.GetAor() != "sip:conference@sip.local" || found.GetBackend().GetAlgorithm() != lpb.FindRoutesRequest_Backend_LEAST_SESSIONS || !found.GetBackend().GetWithSessionAffinity() {
		t.Errorf("FindRoutes = %v", found)
	}
}

func TestFromPSTN(t *testing.T) {
	t.Run("reaches the Peer at the aorLink, balanced, with the extra headers", func(t *testing.T) {
		env := corpusEnv(t)
		extended, err := structpb.NewStruct(map[string]any{"accessKeyId": "AK"})
		if err != nil {
			t.Fatal(err)
		}
		env.numbers.items[0].Extended = extended
		req := pstnInvite(env, "+17066041487")
		req.Message.Extensions = append(req.Message.Extensions,
			&spb.Extension{Name: "X-Room-Id", Value: "from-the-caller"},
			&spb.Extension{Name: "X-App-Ref", Value: "spoofed"},
			&spb.Extension{Name: "x-access-key-id", Value: "spoofed"},
			&spb.Extension{Name: "X-Is-Api-Originated-Type", Value: "true"},
			&spb.Extension{Name: "X-Call-Direction", Value: "spoofed"})
		routeTo(env, req, "sip:conference@sip.local")
		res := env.process(t, req)
		msg := res.GetMessage()
		if got := extensionValue(msg, "X-Room-Id"); got != "jsa-shqm-iyo" {
			t.Errorf("X-Room-Id = %q", got)
		}
		for _, name := range []string{"X-App-Ref", "X-Access-Key-Id", "X-Is-Api-Originated-Type"} {
			if got := extensionValue(msg, name); got != "" {
				t.Errorf("%s survived: %q", name, got)
			}
		}
		if extensionValue(msg, "User-Agent") == "" {
			t.Error("User-Agent is no platform header")
		}
		if got := extensionValue(msg, "X-Call-Direction"); got != "from-pstn" {
			t.Errorf("X-Call-Direction = %q", got)
		}
		found := env.location.found[0]
		if found.GetSessionAffinityRef() != "from-the-caller" || found.GetBackend() == nil {
			t.Errorf("FindRoutes = %v", found)
		}
		if res.GetMetadata()["accessKeyId"] != "AK" || res.GetMetadata()["trace.trunk"] != "trunk-01" {
			t.Errorf("metadata = %v", res.GetMetadata())
		}
	})
	t.Run("480 when nothing is registered at the aorLink", func(t *testing.T) {
		env := corpusEnv(t)
		if res := env.process(t, pstnInvite(env, "+17066041487")); responseTypeOf(res) != "TEMPORARILY_UNAVAILABLE" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("401 without a challenge from outside the access control list", func(t *testing.T) {
		env := corpusEnv(t)
		req := pstnInvite(env, "+17066041487")
		req.Message.Via[0].Received = "198.51.100.7"
		res := env.process(t, req)
		if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate() != nil {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("403 for a Number of another Trunk", func(t *testing.T) {
		env := corpusEnv(t)
		if res := env.process(t, pstnInvite(env, "+18295863314")); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("normalizes before routing on a Trunk with normalizeToE164", func(t *testing.T) {
		env := corpusEnv(t)
		env.trunks.items[0].NormalizeToE164 = true
		req := pstnInvite(env, "17066041487")
		routeTo(env, req, "sip:conference@sip.local")
		res := env.process(t, req)
		if extensionValue(res.GetMessage(), "X-Call-Direction") != "from-pstn" {
			t.Errorf("response = %v", res)
		}
		if got := res.GetMessage().GetFrom().GetAddress().GetUri().GetUser(); got != "+19195551212" {
			t.Errorf("From user = %q", got)
		}
	})
	t.Run("does not find a Number without the plus on a Trunk that does not normalize", func(t *testing.T) {
		env := corpusEnv(t)
		if res := env.process(t, pstnInvite(env, "17066041487")); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("500 when the Trunks API fails", func(t *testing.T) {
		env := corpusEnv(t)
		env.trunks.err = errors.New("down")
		if res := env.process(t, pstnInvite(env, "+17066041487")); responseTypeOf(res) != "SERVER_INTERNAL_ERROR" {
			t.Errorf("response = %v", res)
		}
	})
}

func TestUntrustedHeadersToStrip(t *testing.T) {
	headers := defaultUntrustedHeaders
	if got := untrustedHeadersToStrip(directionFromPSTN, false, headers); len(got) != len(headers) {
		t.Errorf("from-pstn = %v", got)
	}
	if got := untrustedHeadersToStrip(directionUnknown, false, headers); len(got) != len(headers) {
		t.Errorf("unknown = %v", got)
	}
	if got := untrustedHeadersToStrip(directionPeerToPSTN, false, headers); got != nil {
		t.Errorf("peer-to-pstn = %v", got)
	}
	withToken := untrustedHeadersToStrip(directionAgentToPeer, true, headers)
	if contains(withToken, "X-App-Ref") || !contains(withToken, "X-Access-Key-Id") || !contains(withToken, "X-Edgeport-Ref") || len(withToken) != len(headers)-1 {
		t.Errorf("with a token = %v", withToken)
	}
}

func TestUntrustedHeadersOption(t *testing.T) {
	cfg := testConfig()
	cfg.UntrustedHeaders = []string{}
	env := newTestEnv(t, cfg)
	if env.connect.untrustedHeaders == nil || len(env.connect.untrustedHeaders) != 0 {
		t.Errorf("empty = %v, want no headers", env.connect.untrustedHeaders)
	}
	if got := newTestEnv(t, nil).connect.untrustedHeaders; len(got) != len(defaultUntrustedHeaders) {
		t.Errorf("default = %v", got)
	}
}

func TestConnectToken(t *testing.T) {
	invite := func(env *testEnv) *ppb.MessageRequest {
		req := newRequest(env.now, requestOpts{fromUser: "web", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local", noAuth: true})
		req.Message.Extensions = append(req.Message.Extensions,
			&spb.Extension{Name: "X-Connect-Token", Value: "token"},
			&spb.Extension{Name: "X-App-Ref", Value: "app-01"},
			&spb.Extension{Name: "X-Access-Key-Id", Value: "spoofed"})
		return req
	}
	verifying := func(t *testing.T) *testEnv {
		cfg := testConfig()
		cfg.WithVerifier = true
		env := newTestEnv(t, cfg)
		env.verifier.payload = map[string]string{
			"ref": "agent-99", "domain": "sip.local", "domainRef": testDomain().GetRef(),
			"aorLink": "sip:voice@sip.local", "allowedMethods": `["INVITE"]`,
		}
		return env
	}
	t.Run("routes to the Peer at the aorLink, without a challenge", func(t *testing.T) {
		env := verifying(t)
		env.peers.items = []*peers.Peer{{Ref: "peer-02", Username: "freeswitch", Aor: "sip:voice@sip.local", BalancingAlgorithm: peers.LoadBalancingAlgorithm_ROUND_ROBIN}}
		req := invite(env)
		routeTo(env, req, "sip:voice@sip.local")
		msg := env.process(t, req).GetMessage()
		if extensionValue(msg, "X-Call-Direction") != "agent-to-peer" {
			t.Errorf("message = %v", msg)
		}
		if extensionValue(msg, "X-App-Ref") != "app-01" || extensionValue(msg, "X-Access-Key-Id") != "" {
			t.Errorf("a token keeps X-App-Ref and nothing else: %v", msg.GetExtensions())
		}
		if extensionValue(msg, "X-Connect-Token") != "" {
			t.Errorf("the token went on to the next hop: %v", msg.GetExtensions())
		}
	})
	t.Run("403 for a To outside the token's Domain", func(t *testing.T) {
		env := verifying(t)
		req := invite(env)
		req.Message.To.Address.Uri.Host = "other.local"
		routeTo(env, req, "sip:1002@other.local")
		if res := env.process(t, req); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v, want 403", res)
		}
		if env.location.findCalls != 0 {
			t.Error("the call was routed")
		}
	})
	t.Run("403 for a token whose Domain doesn't exist", func(t *testing.T) {
		env := verifying(t)
		env.verifier.payload["domain"] = "other.local"
		if res := env.process(t, invite(env)); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v, want 403", res)
		}
	})
	t.Run("routes to the target AOR when no Peer answers", func(t *testing.T) {
		env := verifying(t)
		req := invite(env)
		routeTo(env, req, "sip:1002@sip.local")
		if msg := env.process(t, req).GetMessage(); extensionValue(msg, "X-Call-Direction") != "agent-to-agent" {
			t.Errorf("message = %v", msg)
		}
	})
	t.Run("403 for a token that does not allow INVITE", func(t *testing.T) {
		env := verifying(t)
		env.verifier.payload["allowedMethods"] = `["REGISTER"]`
		if res := env.process(t, invite(env)); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("403 for a token that does not verify", func(t *testing.T) {
		env := verifying(t)
		env.verifier.err = errors.New("expired")
		if res := env.process(t, invite(env)); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v", res)
		}
	})
}

func TestAgentToAgentRoutesFromTheResolvedCallee(t *testing.T) {
	// To is the caller's to write: it must not pick whose contacts get the call
	env := newTestEnv(t, nil)
	req := agentInvite(env.now)
	req.Message.To.Address.Uri.User = "1001"
	req.Message.To.Address.Uri.Host = "other.local"
	routeTo(env, req, "sip:1002@sip.local")
	res := env.process(t, req)
	if responseTypeOf(res) != "" || extensionValue(res.GetMessage(), "X-Call-Direction") != "agent-to-agent" {
		t.Errorf("response = %v, want the call to Agent 1002", res)
	}
}

func TestEgressRules(t *testing.T) {
	cache := newRuleCache()
	for name, tc := range map[string]struct {
		rule, number string
		want         bool
	}{
		"plain":           {"^1785", "17853178070", true},
		"no match":        {"^1785", "12225553000", false},
		"a lookahead":     {`^(?!1900)\d+$`, "17853178070", true},
		"lookahead out":   {`^(?!1900)\d+$`, "19005550000", false},
		"a backreference": {`^(\d)\1`, "11", true},
	} {
		got, err := cache.match(tc.rule, tc.number)
		if err != nil || got != tc.want {
			t.Errorf("%s: %v, %v", name, got, err)
		}
	}
	if len(cache.rules) != 3 {
		t.Errorf("each rule is compiled once: %d", len(cache.rules))
	}
	first := cache.compiled("^1785")
	if again := cache.compiled("^1785"); again.re != first.re {
		t.Error("the rule was compiled again")
	}

	if _, err := cache.match("(", "1"); err == nil {
		t.Error("a bad rule is an error")
	}
	if _, ok := cache.rules["("]; !ok {
		t.Error("a bad rule is remembered too")
	}

	// A rule that backtracks forever stops
	done := make(chan error, 1)
	go func() {
		_, err := cache.match(`^(a+)+$`, strings.Repeat("a", 64)+"!")
		done <- err
	}()
	select {
	case err := <-done:
		if err == nil {
			t.Error("a rule past its timeout is an error")
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the match timeout did not stop the rule")
	}

	// Bounded: past the limit it starts over
	full := newRuleCache()
	for i := range maxEgressRules + 1 {
		full.compiled(fmt.Sprintf("^%d$", i))
	}
	if len(full.rules) != 1 {
		t.Errorf("rules = %d, want a new start", len(full.rules))
	}
}

func TestAgentToPSTNWithABadRuleIs500(t *testing.T) {
	env := newTestEnv(t, nil)
	env.agents.items[0].Domain.EgressPolicies = []*domains.EgressPolicy{{Rule: "(", NumberRef: "number-01"}}
	req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "17853178070", toDomain: "sip.local"})
	if res := env.process(t, req); responseTypeOf(res) != "SERVER_INTERNAL_ERROR" {
		t.Errorf("response = %v, want 500", res)
	}
}

func TestNewVerifierSettings(t *testing.T) {
	spec, trust := settingsOf(testConfig())
	deps := Dependencies{Location: newFakeLocation(), Agents: &fakeAgents{}, Domains: &fakeDomains{}, Verifier: &fakeVerifier{}}
	if _, err := New(spec, trust, deps, Options{VerifierPublicKey: []byte("x")}); err == nil {
		t.Error("a Verifier client and a public key are exclusive")
	}
	deps.Verifier = nil
	if _, err := New(spec, trust, deps, Options{VerifierPublicKey: []byte("not pem")}); err == nil {
		t.Error("a bad public key is an error")
	}
}

func TestTrunkURI(t *testing.T) {
	if _, _, _, err := trunkURI(&trunks.Trunk{Ref: "t"}, nil, rand.Float64); err == nil {
		t.Error("a Trunk without URIs is an error")
	}
	_, port, transport, err := trunkURI(&trunks.Trunk{Uris: []*trunks.TrunkURI{{Host: "h"}}}, nil, rand.Float64)
	if err != nil || port != 5060 || transport != "UDP" {
		t.Errorf("defaults = %d, %s, %v", port, transport, err)
	}
	_, port, transport, err = trunkURI(&trunks.Trunk{Uris: []*trunks.TrunkURI{{Host: "h", Port: 5061, Transport: "tls"}}}, nil, rand.Float64)
	if err != nil || port != 5061 || transport != "TLS" {
		t.Errorf("set = %d, %s, %v", port, transport, err)
	}
}

func TestTrunkAuthentication(t *testing.T) {
	h := trunkAuthentication(&trunks.Trunk{OutboundCredentials: &credentials.Credentials{Username: "pbx-1", Password: "1234"}})
	if h.name != "X-Gateway-Auth" || h.value != "cGJ4LTE6MTIzNA==" {
		t.Errorf("header = %+v", h)
	}
	if got := trunkAuthentication(&trunks.Trunk{}).value; got != "dW5kZWZpbmVkOnVuZGVmaW5lZA==" {
		t.Errorf("no credentials = %q", got)
	}
}

func TestTelNumber(t *testing.T) {
	if telNumber("tel:+17066041487") != "+17066041487" || telNumber("nothing") != "" {
		t.Error("telNumber()")
	}
}

func TestFromRewriteOf(t *testing.T) {
	number := &numbers.Number{TelUrl: "tel:18295863314"}
	if got := fromRewriteOf(&trunks.Trunk{}, number, "h"); got != nil {
		t.Errorf("not asked = %+v", got)
	}
	got := fromRewriteOf(&trunks.Trunk{RewriteFromWithNumber: true}, number, "h")
	if got.user != "+18295863314" || got.host != "h" {
		t.Errorf("rewrite = %+v", got)
	}
	got = fromRewriteOf(&trunks.Trunk{RewriteFromWithNumber: true, FromDomain: "d"}, number, "h")
	if got.host != "d" {
		t.Errorf("fromDomain = %+v", got)
	}
}

func TestResourcesOfTokenWithoutVerifier(t *testing.T) {
	env := newTestEnv(t, nil)
	_, _, res := env.connect.resourcesOfToken(context.Background(), agentInvite(env.now))
	if responseTypeOf(res) != "SERVER_INTERNAL_ERROR" || res.GetMessage().GetReasonPhrase() != "Server Internal Error" {
		t.Errorf("response = %v", res)
	}
}

func TestTrunkURISelection(t *testing.T) {
	uri := func(host string, priority, weight int32, enabled *bool) *trunks.TrunkURI {
		return &trunks.TrunkURI{Host: host, Priority: priority, Weight: weight, Enabled: enabled}
	}
	draw := func(v float64) func() float64 { return func() float64 { return v } }
	pick := func(t *testing.T, trunk *trunks.Trunk, r float64) string {
		t.Helper()
		u, err := selectTrunkURI(trunk, nil, draw(r))
		if err != nil {
			t.Fatal(err)
		}
		return u.GetHost()
	}
	t.Run("a disabled URI never gets calls", func(t *testing.T) {
		trunk := &trunks.Trunk{Uris: []*trunks.TrunkURI{uri("a", 0, 0, proto.Bool(false)), uri("b", 0, 0, nil)}}
		for _, r := range []float64{0, 0.5, 0.99} {
			if got := pick(t, trunk, r); got != "b" {
				t.Errorf("draw %v: %s", r, got)
			}
		}
	})
	t.Run("the lowest priority wins while it has an enabled URI", func(t *testing.T) {
		trunk := &trunks.Trunk{Uris: []*trunks.TrunkURI{uri("b", 20, 0, nil), uri("a", 10, 0, proto.Bool(true))}}
		for _, r := range []float64{0, 0.99} {
			if got := pick(t, trunk, r); got != "a" {
				t.Errorf("draw %v: %s", r, got)
			}
		}
		trunk.Uris[1].Enabled = proto.Bool(false)
		if got := pick(t, trunk, 0); got != "b" {
			t.Errorf("A disabled: %s", got)
		}
	})
	t.Run("weights share the calls", func(t *testing.T) {
		trunk := &trunks.Trunk{Uris: []*trunks.TrunkURI{uri("a", 10, 70, nil), uri("b", 10, 30, nil)}}
		for r, want := range map[float64]string{0: "a", 0.69: "a", 0.7: "b", 0.99: "b"} {
			if got := pick(t, trunk, r); got != want {
				t.Errorf("draw %v: %s, want %s", r, got, want)
			}
		}
	})
	t.Run("an excluded URI is skipped", func(t *testing.T) {
		trunk := &trunks.Trunk{Uris: []*trunks.TrunkURI{uri("A", 0, 0, nil), uri("b", 0, 0, nil)}}
		u, err := selectTrunkURI(trunk, map[string]bool{"@a:5060;udp": true}, draw(0))
		if err != nil || u.GetHost() != "b" {
			t.Errorf("%v, %v", u, err)
		}
	})
	t.Run("all disabled", func(t *testing.T) {
		trunk := &trunks.Trunk{Ref: "trunk-01", Uris: []*trunks.TrunkURI{uri("a", 0, 0, proto.Bool(false))}}
		if _, err := selectTrunkURI(trunk, nil, draw(0)); err == nil || err.Error() != "trunk trunk-01 has no enabled outbound uri" {
			t.Errorf("err = %v", err)
		}
		env := corpusEnv(t)
		env.numbers.items[0].Trunk.Uris[0].Enabled = proto.Bool(false)
		req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "17853178070", toDomain: "sip.local"})
		if res := env.process(t, req); responseTypeOf(res) != "SERVER_INTERNAL_ERROR" {
			t.Errorf("response = %v, want 500", res)
		}
	})
	t.Run("the chosen URI names the Request-URI, To and From", func(t *testing.T) {
		env := corpusEnv(t)
		trunk := env.numbers.items[0].Trunk
		second := proto.Clone(trunk.Uris[0]).(*trunks.TrunkURI)
		second.Host = "sip-b.provider.net"
		trunk.Uris[0].Enabled = proto.Bool(false)
		trunk.Uris = append(trunk.Uris, second)
		trunk.RewriteFromWithNumber = true
		req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "17853178070", toDomain: "sip.local"})
		msg := env.process(t, req).GetMessage()
		if msg.GetRequestUri().GetHost() != "sip-b.provider.net" || msg.GetTo().GetAddress().GetUri().GetHost() != "sip-b.provider.net" || msg.GetFrom().GetAddress().GetUri().GetHost() != "sip-b.provider.net" {
			t.Errorf("Request-URI %v, To %v, From %v", msg.GetRequestUri(), msg.GetTo().GetAddress().GetUri(), msg.GetFrom().GetAddress().GetUri())
		}
		if !strings.Contains(extensionValue(msg, "Remote-Party-ID"), "@sip-b.provider.net") {
			t.Errorf("Remote-Party-ID = %q", extensionValue(msg, "Remote-Party-ID"))
		}
	})
}

func TestTrunkFailover(t *testing.T) {
	// corpusEnv's first Number leaves through trunk-01; give it more URIs
	setUp := func(t *testing.T, hosts ...string) (*testEnv, *trunks.Trunk) {
		env := corpusEnv(t)
		env.connect.random = func() float64 { return 0 }
		trunk := env.numbers.items[0].Trunk
		first := trunk.Uris[0]
		trunk.Uris = nil
		for _, host := range hosts {
			u := proto.Clone(first).(*trunks.TrunkURI)
			u.Host = host
			trunk.Uris = append(trunk.Uris, u)
		}
		return env, trunk
	}
	invite := func(env *testEnv, tried string) *ppb.MessageRequest {
		req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "17853178070", toDomain: "sip.local"})
		if tried != "" {
			req.Metadata = map[string]string{"failover.tried": tried}
		}
		return req
	}
	const a, b = `"pbx-1@sip-a.provider.net:7060;udp"`, `"pbx-1@sip-b.provider.net:7060;udp"`

	t.Run("names the URI it chose while another remains", func(t *testing.T) {
		env, _ := setUp(t, "sip-a.provider.net", "sip-b.provider.net")
		res := env.process(t, invite(env, ""))
		if res.GetMessage().GetRequestUri().GetHost() != "sip-a.provider.net" || res.GetMetadata()["failover.tried"] != "["+a+"]" {
			t.Errorf("host %s, metadata %v", res.GetMessage().GetRequestUri().GetHost(), res.GetMetadata())
		}
		if res.GetMetadata()["trace.trunk"] != "trunk-01" {
			t.Errorf("the other metadata is gone: %v", res.GetMetadata())
		}
	})
	t.Run("leaves the tried URIs out, and drops the key on the last one", func(t *testing.T) {
		env, _ := setUp(t, "sip-a.provider.net", "sip-b.provider.net")
		res := env.process(t, invite(env, "["+a+"]"))
		if res.GetMessage().GetRequestUri().GetHost() != "sip-b.provider.net" {
			t.Errorf("host %s, want B", res.GetMessage().GetRequestUri().GetHost())
		}
		if _, ok := res.GetMetadata()["failover.tried"]; ok {
			t.Errorf("B is the last URI: %v", res.GetMetadata())
		}
	})
	t.Run("adds to the list while URIs remain", func(t *testing.T) {
		env, _ := setUp(t, "sip-a.provider.net", "sip-b.provider.net", "sip-c.provider.net")
		res := env.process(t, invite(env, "["+a+"]"))
		if got := res.GetMetadata()["failover.tried"]; got != "["+a+","+b+"]" {
			t.Errorf("failover.tried = %s", got)
		}
	})
	t.Run("a disabled URI isn't one that remains", func(t *testing.T) {
		env, trunk := setUp(t, "sip-a.provider.net", "sip-b.provider.net")
		trunk.Uris[1].Enabled = proto.Bool(false)
		if _, ok := env.process(t, invite(env, "")).GetMetadata()["failover.tried"]; ok {
			t.Error("the only other URI is disabled")
		}
	})
	t.Run("a Trunk with one URI says nothing, whatever the caller's attributes", func(t *testing.T) {
		env, _ := setUp(t, "sip-a.provider.net")
		extended, err := structpb.NewStruct(map[string]any{"failover.tried": "[]"})
		if err != nil {
			t.Fatal(err)
		}
		for _, agent := range env.agents.items {
			agent.Extended = extended
		}
		res := env.process(t, invite(env, ""))
		if _, ok := res.GetMetadata()["failover.tried"]; ok || res.GetMessage().GetRequestUri().GetHost() != "sip-a.provider.net" {
			t.Errorf("metadata %v", res.GetMetadata())
		}
	})
}
