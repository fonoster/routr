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
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// formatEnv is corpusEnv with Agent 1001's calls leaving from the Number
// +442079460018 of the given country on trunk-01, set up by the Trunk changes.
func formatEnv(t *testing.T, country string, change func(*trunks.Trunk)) *testEnv {
	t.Helper()
	env := corpusEnv(t)
	trunk := env.trunks.items[0]
	change(trunk)
	policy := env.domains.items[0].EgressPolicies[0]
	policy.Number = &numbers.Number{Ref: "number-uk", TelUrl: "tel:+442079460018", CountryIsoCode: country, Trunk: trunk}
	policy.NumberRef = "number-uk"
	return env
}

func dial(t *testing.T, env *testEnv, user string) *ppb.MessageRequest {
	t.Helper()
	req := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: user, toDomain: "sip.local"})
	req.Message.GetRequestUri().UserParam = "phone"
	req.Message.To.Address.Uri.UserParam = "phone"
	res := env.process(t, req)
	if responseTypeOf(res) != "" {
		t.Fatalf("response = %v", res)
	}
	return &ppb.MessageRequest{Message: res.GetMessage(), ListeningPoints: req.GetListeningPoints(), Localnets: req.GetLocalnets(), ExternalAddrs: req.GetExternalAddrs(), EdgePortRef: req.GetEdgePortRef()}
}

func calledFormat(format trunks.NumberFormat, prefix string) func(*trunks.Trunk) {
	return func(tr *trunks.Trunk) {
		tr.CalledNumberFormat = format
		tr.CalledNumberPrefix = prefix
	}
}

func TestOutboundNumberFormat(t *testing.T) {
	t.Run("writes the called number in the Request-URI and To", func(t *testing.T) {
		tests := []struct {
			name, country, dialed string
			format                trunks.NumberFormat
			prefix                string
			want                  string
			userPhone             bool
		}{
			{"unset sends it as dialed", "GB", "+442079460010", trunks.NumberFormat_UNSPECIFIED, "", "+442079460010", true},
			{"e164", "GB", "+442079460010", trunks.NumberFormat_E164, "", "+442079460010", true},
			{"e164-without-plus with a prefix", "GB", "+442079460010", trunks.NumberFormat_E164_WITHOUT_PLUS, "9", "9442079460010", false},
			{"national with a prefix", "GB", "+442079460010", trunks.NumberFormat_NATIONAL, "9", "902079460010", false},
			{"international with a prefix", "GB", "+442079460010", trunks.NumberFormat_INTERNATIONAL, "9", "900442079460010", false},
			{"international from a US Number", "US", "+442079460010", trunks.NumberFormat_INTERNATIONAL, "", "011442079460010", false},
			{"international from an AU Number", "AU", "+442079460010", trunks.NumberFormat_INTERNATIONAL, "", "0011442079460010", false},
			{"a national number dialed, sent in e164", "GB", "02079460010", trunks.NumberFormat_E164, "", "+442079460010", true},
			{"a foreign number under national goes international", "GB", "+33142685300", trunks.NumberFormat_NATIONAL, "9", "90033142685300", false},
			{"# in the prefix is escaped", "GB", "+442079460010", trunks.NumberFormat_NATIONAL, "#9", "%23902079460010", false},
			{"national with a lower-case country", "gb", "+442079460010", trunks.NumberFormat_NATIONAL, "", "02079460010", false},
			{"national from an unknown country is e164 with no prefix", "XX", "+442079460010", trunks.NumberFormat_NATIONAL, "9", "+442079460010", true},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				env := formatEnv(t, tt.country, calledFormat(tt.format, tt.prefix))
				msg := dial(t, env, tt.dialed).GetMessage()
				for name, uri := range map[string]*spb.SipURI{"Request-URI": msg.GetRequestUri(), "To": msg.GetTo().GetAddress().GetUri()} {
					if uri.GetUser() != tt.want {
						t.Errorf("%s user = %q, want %q", name, uri.GetUser(), tt.want)
					}
					if got := uri.GetUserParam() == "phone"; got != tt.userPhone {
						t.Errorf("%s user=phone = %v, want %v", name, got, tt.userPhone)
					}
				}
			})
		}
	})
	t.Run("sends emergency numbers, short codes and names as dialed", func(t *testing.T) {
		for _, format := range []trunks.NumberFormat{trunks.NumberFormat_E164, trunks.NumberFormat_E164_WITHOUT_PLUS, trunks.NumberFormat_NATIONAL, trunks.NumberFormat_INTERNATIONAL} {
			for _, dialed := range []string{"911", "112", "sales"} {
				for _, country := range []string{"GB", "US"} {
					env := formatEnv(t, country, calledFormat(format, "9"))
					msg := dial(t, env, dialed).GetMessage()
					if msg.GetRequestUri().GetUser() != dialed || msg.GetTo().GetAddress().GetUri().GetUser() != dialed || msg.GetRequestUri().GetUserParam() != "phone" {
						t.Errorf("%s %s from %s: Request-URI = %v, To = %v", format, dialed, country, msg.GetRequestUri(), msg.GetTo())
					}
				}
			}
		}
	})
	t.Run("writes the caller Number in From, P-Asserted-Identity and Remote-Party-ID", func(t *testing.T) {
		env := formatEnv(t, "GB", func(tr *trunks.Trunk) {
			tr.RewriteFromWithNumber = true
			tr.CallerNumberFormat = trunks.NumberFormat_E164_WITHOUT_PLUS
			tr.CallerNumberPrefix = "9"
		})
		msg := dial(t, env, "+442079460010").GetMessage()
		if from := msg.GetFrom().GetAddress().GetUri(); from.GetUser() != "9442079460018" || from.GetUserParam() != "" {
			t.Errorf("From = %v", from)
		}
		if got := extensionValue(msg, "P-Asserted-Identity"); got != "<sip:9442079460018@sip.provider.net>" {
			t.Errorf("P-Asserted-Identity = %q", got)
		}
		if got := extensionValue(msg, "Remote-Party-ID"); got != "<sip:9442079460018@sip.provider.net>;screen=yes;party=calling" {
			t.Errorf("Remote-Party-ID = %q", got)
		}
		if to := msg.GetTo().GetAddress().GetUri(); to.GetUser() != "+442079460010" {
			t.Errorf("To = %v: the called format is unset", to)
		}
	})
	t.Run("formats P-Asserted-Identity without rewriting From when rewriteFromWithNumber is off", func(t *testing.T) {
		env := formatEnv(t, "GB", func(tr *trunks.Trunk) { tr.CallerNumberFormat = trunks.NumberFormat_NATIONAL })
		msg := dial(t, env, "+442079460010").GetMessage()
		if from := msg.GetFrom().GetAddress().GetUri(); from.GetUser() != "1001" {
			t.Errorf("From = %v", from)
		}
		if got := extensionValue(msg, "P-Asserted-Identity"); got != "<sip:02079460018@sip.provider.net>" {
			t.Errorf("P-Asserted-Identity = %q", got)
		}
	})
	t.Run("keeps user=phone on a caller Number written with its +", func(t *testing.T) {
		env := formatEnv(t, "GB", func(tr *trunks.Trunk) {
			tr.RewriteFromWithNumber = true
			tr.CallerNumberFormat = trunks.NumberFormat_E164
		})
		msg := dial(t, env, "+442079460010").GetMessage()
		if from := msg.GetFrom().GetAddress().GetUri(); from.GetUser() != "+442079460018" || from.GetUserParam() != "phone" {
			t.Errorf("From = %v", from)
		}
		if got := extensionValue(msg, "P-Asserted-Identity"); got != "<sip:+442079460018@sip.provider.net;user=phone>" {
			t.Errorf("P-Asserted-Identity = %q", got)
		}
	})
	t.Run("leaves an anonymous From alone", func(t *testing.T) {
		req := identityInvite()
		from := req.GetMessage().GetFrom().GetAddress().GetUri()
		from.User, from.Host, from.UserParam = "anonymous", "anonymous.invalid", "phone"
		r := identityRoute(true)
		r.rewriteFrom = fromRewriteOf(&trunks.Trunk{RewriteFromWithNumber: true}, &numbers.Number{TelUrl: "tel:+442079460018"}, "wa.meta.vc",
			&numberFormats{caller: numberFormat{format: trunks.NumberFormat_NATIONAL}, region: "GB"})
		r.formats = &numberFormats{caller: numberFormat{format: trunks.NumberFormat_NATIONAL}, region: "GB"}
		applyTrunkIdentity(req, r)
		if from.GetUser() != "anonymous" || from.GetHost() != "anonymous.invalid" || from.GetUserParam() != "phone" {
			t.Errorf("From = %v", from)
		}
	})
	t.Run("formats a Peer's call with the X-DOD-Number Number's country", func(t *testing.T) {
		env := corpusEnv(t)
		trunk := env.trunks.items[0]
		trunk.CalledNumberFormat = trunks.NumberFormat_INTERNATIONAL
		env.numbers.items[0].CountryIsoCode = "US"
		req := peerInvite(env, "+17066041487")
		req.Message.GetRequestUri().User = "+442079460010"
		req.Message.To.Address.Uri.User = "+442079460010"
		res := env.process(t, req)
		if got := res.GetMessage().GetRequestUri().GetUser(); got != "011442079460010" {
			t.Errorf("Request-URI user = %q (%v)", got, res)
		}
	})
	t.Run("with no format the INVITE is the same as before", func(t *testing.T) {
		plain := dial(t, formatEnv(t, "GB", func(*trunks.Trunk) {}), "+442079460010")
		prefixOnly := dial(t, formatEnv(t, "GB", func(tr *trunks.Trunk) { tr.CalledNumberPrefix = "9" }), "+442079460010")
		if !proto.Equal(plain.GetMessage(), prefixOnly.GetMessage()) {
			t.Errorf("a prefix without a format changed the INVITE:\n%v\n%v", plain.GetMessage(), prefixOnly.GetMessage())
		}
		if rr := plain.GetMessage().GetRecordRoute()[0].GetAddress().GetUri().GetUser(); rr != "" {
			t.Errorf("Record-Route user = %q, want no identity mapping", rr)
		}
	})
	t.Run("maps the BYE back both ways under national", func(t *testing.T) {
		env := formatEnv(t, "GB", func(tr *trunks.Trunk) { tr.CalledNumberFormat = trunks.NumberFormat_NATIONAL })
		invite := newRequest(env.now, requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "+442079460010", toDomain: "sip.local"})
		out := env.process(t, invite).GetMessage()
		if out.GetTo().GetAddress().GetUri().GetUser() != "02079460010" {
			t.Fatalf("To = %v", out.GetTo())
		}
		var ours []*spb.Route
		for _, rr := range out.GetRecordRoute() {
			if decodeIdentityUser(rr.GetAddress().GetUri().GetUser()) != nil {
				ours = append(ours, &spb.Route{Address: proto.Clone(rr.GetAddress()).(*spb.Address), Parameters: rr.GetParameters()})
			}
		}
		if len(ours) == 0 {
			t.Fatalf("no identity mapping in Record-Route %v", out.GetRecordRoute())
		}
		bye := func(from, to *spb.SipURI, route []*spb.Route) *ppb.MessageRequest {
			req := newRequest(env.now, requestOpts{method: ppb.Method_BYE, noAuth: true})
			req.Message.From.Address.Uri = from
			req.Message.To.Address.Uri = to
			req.Message.To.Tag = "carrier-tag"
			req.Message.Route = route
			return req
		}
		// The carrier's BYE: From is the number it was called at
		reversed := make([]*spb.Route, len(ours))
		for i, r := range ours {
			reversed[len(ours)-1-i] = r
		}
		carrierBye := bye(proto.Clone(out.GetTo().GetAddress().GetUri()).(*spb.SipURI), proto.Clone(out.GetFrom().GetAddress().GetUri()).(*spb.SipURI), reversed)
		got := env.process(t, carrierBye).GetMessage()
		if from := got.GetFrom().GetAddress().GetUri(); from.GetUser() != "+442079460010" {
			t.Errorf("the carrier's BYE reaches the Agent with From %v, want +442079460010", from)
		}
		if to := got.GetTo().GetAddress().GetUri(); to.GetUser() != "1001" {
			t.Errorf("the carrier's BYE reaches the Agent with To %v", to)
		}
		// The Agent's BYE: To is the number it dialed
		agentBye := bye(proto.Clone(invite.GetMessage().GetFrom().GetAddress().GetUri()).(*spb.SipURI), proto.Clone(invite.GetMessage().GetTo().GetAddress().GetUri()).(*spb.SipURI), ours)
		got = env.process(t, agentBye).GetMessage()
		if to := got.GetTo().GetAddress().GetUri(); to.GetUser() != "02079460010" || to.GetUserParam() != "" {
			t.Errorf("the Agent's BYE reaches the carrier with To %v, want 02079460010", to)
		}
	})
}
