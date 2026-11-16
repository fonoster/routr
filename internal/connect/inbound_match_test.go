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
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// numberingEnv has the issue's fixtures: the Number +442079460018 (GB, alias
// sales) on trunk-uk, a Number on trunk-us, and a Number on no Trunk.
func numberingEnv(t *testing.T) *testEnv {
	t.Helper()
	env := newTestEnv(t, nil)
	uk := &trunks.Trunk{Ref: "trunk-uk", InboundUri: "trunk-uk.acme.com"}
	us := &trunks.Trunk{Ref: "trunk-us", InboundUri: "trunk-us.acme.com"}
	env.trunks.items = []*trunks.Trunk{uk, us}
	env.numbers.items = []*numbers.Number{
		{Ref: "number-uk", TelUrl: "tel:+442079460018", CountryIsoCode: "GB", Aliases: []string{"sales"}, AorLink: "sip:sales@sip.local", Trunk: uk},
		{Ref: "number-us", TelUrl: "tel:+12079460019", CountryIsoCode: "US", AorLink: "sip:us@sip.local", Trunk: us},
		{Ref: "number-none", TelUrl: "tel:+442079460099", CountryIsoCode: "GB", AorLink: "sip:none@sip.local"},
	}
	return env
}

// trunkInvite is a carrier's INVITE to user on the Trunk at host.
func trunkInvite(env *testEnv, host, user string) *ppb.MessageRequest {
	return newRequest(env.now, requestOpts{fromUser: "+15551234567", fromDomain: "carrier.example", toUser: user, toDomain: "carrier.example", requestURIHost: host, noAuth: true})
}

func didNumbers(msg *spb.SIPMessage) []string {
	var out []string
	for _, e := range msg.GetExtensions() {
		if strings.EqualFold(e.GetName(), "X-DID-Number") {
			out = append(out, e.GetValue())
		}
	}
	return out
}

func expectNotFound(t *testing.T, res *ppb.MessageResponse, user string) {
	t.Helper()
	if responseTypeOf(res) != "NOT_FOUND" || res.GetMessage().GetReasonPhrase() != "No Number found for "+user {
		t.Errorf("response = %s %q, want 404 No Number found for %s", responseTypeOf(res), res.GetMessage().GetReasonPhrase(), user)
	}
}

func TestInboundNumberMatch(t *testing.T) {
	t.Run("routes every form of the Number to its aorLink", func(t *testing.T) {
		for user, want := range map[string]string{
			"+442079460018":     "exact",
			"442079460018":      "digits",
			"02079460018":       "national",
			"2079460018":        "national",
			"00442079460018":    "international",
			"sales":             "alias",
			"442079460018;npdi": "digits",
		} {
			env := numberingEnv(t)
			req := trunkInvite(env, "trunk-uk.acme.com", user)
			routeTo(env, req, "sip:sales@sip.local")
			res := env.process(t, req)
			if responseTypeOf(res) != "" {
				t.Errorf("%s: response = %v", user, res)
				continue
			}
			if got := res.GetMetadata()["trace.numberMatch"]; got != want {
				t.Errorf("%s: numberMatch = %q, want %q", user, got, want)
			}
			if got := res.GetMetadata()["trace.trunk"]; got != "trunk-uk" {
				t.Errorf("%s: trunk = %q", user, got)
			}
			if got := extensionValue(res.GetMessage(), "X-Call-Direction"); got != "from-pstn" {
				t.Errorf("%s: X-Call-Direction = %q", user, got)
			}
		}
	})
	t.Run("404 for a wrong case, a partial number, another Trunk's Number and a Number with no Trunk", func(t *testing.T) {
		for _, user := range []string{"SALES", "2079460", "+12079460019", "12079460019", "+442079460099", "442079460099", "02079460099", "nobody"} {
			env := numberingEnv(t)
			expectNotFound(t, env.process(t, trunkInvite(env, "trunk-uk.acme.com", user)), user)
		}
	})
	t.Run("checks the access control list before any lookup", func(t *testing.T) {
		for _, user := range []string{"+442079460018", "nobody"} {
			env := numberingEnv(t)
			env.trunks.items[0].AccessControlList = &acl.AccessControlList{Allow: []string{"203.0.113.0/24"}, Deny: []string{"0.0.0.0/0"}}
			res := env.process(t, trunkInvite(env, "trunk-uk.acme.com", user))
			if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate() != nil {
				t.Errorf("%s: response = %v, want 401 without a challenge", user, res)
			}
			if env.numbers.calls != 0 {
				t.Errorf("%s: %d Number lookups before the access check", user, env.numbers.calls)
			}
		}
	})
	t.Run("challenges a Trunk with credentials, then answers 404 after a good digest", func(t *testing.T) {
		env := numberingEnv(t)
		env.trunks.items[0].InboundCredentials = &credentials.Credentials{Username: "pbx-1", Password: "1234"}
		req := trunkInvite(env, "trunk-uk.acme.com", "nobody")
		res := env.process(t, req)
		if responseTypeOf(res) != "UNAUTHORIZED" || res.GetMessage().GetWwwAuthenticate() == nil {
			t.Fatalf("response = %v, want a challenge", res)
		}
		if env.numbers.calls != 0 {
			t.Errorf("%d Number lookups before the challenge", env.numbers.calls)
		}
		req.Message.Authorization = signedAuthorization(ppb.Method_INVITE, "pbx-1", auth.GenerateNonce(func() time.Time { return env.now }))
		expectNotFound(t, env.process(t, req), "nobody")
	})
	t.Run("403 on a host that is no Trunk's", func(t *testing.T) {
		env := numberingEnv(t)
		req := trunkInvite(env, "elsewhere.example", "+442079460018")
		req.Message.Authorization = signedAuthorization(ppb.Method_INVITE, "pbx-1", auth.GenerateNonce(func() time.Time { return env.now }))
		if res := env.process(t, req); responseTypeOf(res) != "FORBIDDEN" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("404 and a warning for two Numbers of the Trunk at one step", func(t *testing.T) {
		env := numberingEnv(t)
		var logs bytes.Buffer
		env.connect.log = slog.New(slog.NewTextHandler(&logs, nil))
		uk := env.trunks.items[0]
		env.numbers.items = []*numbers.Number{
			{Ref: "number-gb", TelUrl: "tel:+442079460018", CountryIsoCode: "GB", AorLink: "sip:sales@sip.local", Trunk: uk},
			{Ref: "number-us", TelUrl: "tel:+12079460018", CountryIsoCode: "US", AorLink: "sip:us@sip.local", Trunk: uk},
		}
		expectNotFound(t, env.process(t, trunkInvite(env, "trunk-uk.acme.com", "2079460018")), "2079460018")
		if out := logs.String(); !strings.Contains(out, "level=WARN") || !strings.Contains(out, "number-gb") || !strings.Contains(out, "number-us") {
			t.Errorf("logs = %s", out)
		}
	})
	t.Run("sets exactly one X-DID-Number, its own, and leaves To and From as received", func(t *testing.T) {
		env := numberingEnv(t)
		req := trunkInvite(env, "trunk-uk.acme.com", "02079460018")
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "X-DID-Number", Value: "+15550000000"})
		routeTo(env, req, "sip:sales@sip.local")
		msg := env.process(t, req).GetMessage()
		if got := didNumbers(msg); len(got) != 1 || got[0] != "+442079460018" {
			t.Errorf("X-DID-Number = %v", got)
		}
		if to := msg.GetTo().GetAddress().GetUri(); to.GetUser() != "02079460018" || to.GetHost() != "carrier.example" {
			t.Errorf("To = %v", to)
		}
		if from := msg.GetFrom().GetAddress().GetUri(); from.GetUser() != "+15551234567" || from.GetHost() != "carrier.example" {
			t.Errorf("From = %v", from)
		}
	})
	t.Run("sets X-DID-Number even when the operator's untrusted headers leave it", func(t *testing.T) {
		cfg := testConfig()
		cfg.UntrustedHeaders = []string{}
		env := newTestEnv(t, cfg)
		base := numberingEnv(t)
		env.trunks.items, env.numbers.items = base.trunks.items, base.numbers.items
		req := trunkInvite(env, "trunk-uk.acme.com", "+442079460018")
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "x-did-number", Value: "+15550000000"})
		routeTo(env, req, "sip:sales@sip.local")
		if got := didNumbers(env.process(t, req).GetMessage()); len(got) != 1 || got[0] != "+442079460018" {
			t.Errorf("X-DID-Number = %v", got)
		}
	})
	t.Run("a Number with a lower-case country matches its national form", func(t *testing.T) {
		env := numberingEnv(t)
		env.numbers.items[0].CountryIsoCode = "gb"
		req := trunkInvite(env, "trunk-uk.acme.com", "02079460018")
		routeTo(env, req, "sip:sales@sip.local")
		if res := env.process(t, req); res.GetMetadata()["trace.numberMatch"] != "national" {
			t.Errorf("response = %v", res)
		}
	})
	t.Run("an Agent dialing a national number goes out agent-to-pstn as before", func(t *testing.T) {
		env := corpusEnv(t)
		uk := numberingEnv(t)
		env.trunks.items = append(env.trunks.items, uk.trunks.items[0])
		env.numbers.items = append(env.numbers.items, uk.numbers.items[0])
		res := env.process(t, newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "02079460018", toDomain: "sip.local"}))
		msg := res.GetMessage()
		if got := extensionValue(msg, "X-Call-Direction"); got != "agent-to-pstn" {
			t.Errorf("X-Call-Direction = %q (%v)", got, res)
		}
		if _, ok := res.GetMetadata()["trace.numberMatch"]; ok || len(didNumbers(msg)) != 0 {
			t.Errorf("metadata = %v, X-DID-Number = %v", res.GetMetadata(), didNumbers(msg))
		}
	})
	t.Run("a new Number matches its exact form at once and the others once the index is rebuilt", func(t *testing.T) {
		env := numberingEnv(t)
		expectNotFound(t, env.process(t, trunkInvite(env, "trunk-uk.acme.com", "02079460020")), "02079460020")
		env.numbers.items = append(env.numbers.items, &numbers.Number{Ref: "number-new", TelUrl: "tel:+442079460020", CountryIsoCode: "GB", AorLink: "sip:new@sip.local", Trunk: env.trunks.items[0]})
		req := trunkInvite(env, "trunk-uk.acme.com", "+442079460020")
		routeTo(env, req, "sip:new@sip.local")
		if res := env.process(t, req); res.GetMetadata()["trace.numberMatch"] != "exact" {
			t.Errorf("exact = %v", res)
		}
		expectNotFound(t, env.process(t, trunkInvite(env, "trunk-uk.acme.com", "02079460020")), "02079460020")
		env.now = env.now.Add(trunkIndexMaxAge + time.Second)
		req = trunkInvite(env, "trunk-uk.acme.com", "02079460020")
		routeTo(env, req, "sip:new@sip.local")
		if res := env.process(t, req); res.GetMetadata()["trace.numberMatch"] != "national" {
			t.Errorf("after the rebuild = %v", res)
		}
	})
	t.Run("500 when the Numbers API fails", func(t *testing.T) {
		env := numberingEnv(t)
		env.numbers.err = errors.New("down")
		if res := env.process(t, trunkInvite(env, "trunk-uk.acme.com", "sales")); responseTypeOf(res) != "SERVER_INTERNAL_ERROR" {
			t.Errorf("response = %v", res)
		}
	})
}
