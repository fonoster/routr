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
	"encoding/base64"
	"reflect"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func decoded(t *testing.T, value string) string {
	t.Helper()
	out, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		t.Fatalf("decode %q: %v", value, err)
	}
	return string(out)
}

func TestEncodeDecodeIdentity(t *testing.T) {
	tests := []struct {
		uri     *spb.SipURI
		written string
		want    *identity
	}{
		{&spb.SipURI{User: "roomr", Host: "default", Port: 5060}, "roomr@default:5060", &identity{user: "roomr", host: "default", port: 5060}},
		{&spb.SipURI{User: "+1", Host: "wa.example.com", Port: -1, UserParam: "phone"}, "+1@wa.example.com;user=phone", &identity{user: "+1", host: "wa.example.com", userParam: "phone"}},
		{&spb.SipURI{Host: "[2001:db8::1]", Port: 5060}, "@[2001:db8::1]:5060", &identity{host: "[2001:db8::1]", port: 5060}},
	}
	for _, tt := range tests {
		value := encodeIdentity(tt.uri)
		if got := decoded(t, value); got != tt.written {
			t.Errorf("encodeIdentity() wrote %q, want %q", got, tt.written)
		}
		if got := decodeIdentity(value); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("decodeIdentity(%q) = %+v, want %+v", tt.written, got, tt.want)
		}
	}
	if got := decodeIdentity(""); got != nil {
		t.Errorf("decodeIdentity(empty) = %+v", got)
	}
	if got := decodeIdentity(base64.RawURLEncoding.EncodeToString([]byte("no-at-sign"))); got != nil {
		t.Errorf("decodeIdentity(no @) = %+v", got)
	}
	if got := decodeIdentity("not base64!"); got != nil {
		t.Errorf("decodeIdentity(garbage) = %+v", got)
	}
}

func TestDecodeIdentityUser(t *testing.T) {
	values := map[string]string{"rfo": "YQ", "rfn": "Yg", "rco": "Yw", "rcn": "ZA"}
	if got := decodeIdentityUser(identityUser(values)); !reflect.DeepEqual(got, values) {
		t.Errorf("decodeIdentityUser() = %v", got)
	}
	if got := decodeIdentityUser("rco.Yw.rcn.ZA"); !reflect.DeepEqual(got, map[string]string{"rco": "Yw", "rcn": "ZA"}) {
		t.Errorf("a partial mapping = %v", got)
	}
	for _, user := range []string{"", "1001", "rfo", "rfn.Yg.rfo.YQ", "rfo.YQ.rfo.YQ", "xx.YQ", "rfo.Y!Q", "rfo.YQ.rfn"} {
		if got := decodeIdentityUser(user); got != nil {
			t.Errorf("decodeIdentityUser(%q) = %v, want nil", user, got)
		}
	}
}

func TestIdentityRewriteParameters(t *testing.T) {
	from := &spb.SipURI{User: "roomr", Host: "default", Port: -1}
	to := &spb.SipURI{User: "+15555550188", Host: "10.216.30.40", Port: -1}
	if got := identityRewriteParameters(from, to, from, to); len(got) != 0 {
		t.Errorf("nothing changed = %v", got)
	}
	newTo := &spb.SipURI{User: "+15555550188", Host: "wa.meta.vc", Port: 5061}
	got := identityRewriteParameters(from, to, from, newTo)
	if len(got) != 2 || decoded(t, got["rco"]) != "+15555550188@10.216.30.40" || decoded(t, got["rcn"]) != "+15555550188@wa.meta.vc:5061" {
		t.Errorf("a changed To = %v", got)
	}
	portOnly := &spb.SipURI{User: "+15555550188", Host: "10.216.30.40", Port: 5070}
	if got := identityRewriteParameters(from, to, from, portOnly); got["rcn"] == "" {
		t.Errorf("a To that changes only its port = %v", got)
	}
}

func TestNormalizeE164Alteration(t *testing.T) {
	req := newRequest(testNow(), requestOpts{fromUser: "17853178070", fromDomain: "a", toUser: "18295863314", toDomain: "b", noAuth: true})
	normalizeE164Alteration(req)
	msg := req.GetMessage()
	if msg.GetFrom().GetAddress().GetUri().GetUser() != "+17853178070" || msg.GetTo().GetAddress().GetUri().GetUser() != "+18295863314" || msg.GetRequestUri().GetUser() != "+18295863314" {
		t.Errorf("normalized = %v", msg)
	}
	req = newRequest(testNow(), requestOpts{fromUser: "1001", fromDomain: "a", toUser: "18295863314", toDomain: "b", noAuth: true})
	normalizeE164Alteration(req)
	if got := req.GetMessage().GetFrom().GetAddress().GetUri().GetUser(); got != "1001" {
		t.Errorf("an extension became %q", got)
	}
}

func TestIsAnonymous(t *testing.T) {
	if !isAnonymous(&spb.SipURI{User: "Anonymous", Host: "x"}) || !isAnonymous(&spb.SipURI{User: "1", Host: "ANONYMOUS.invalid"}) {
		t.Error("anonymous not recognized")
	}
	if isAnonymous(&spb.SipURI{User: "1001", Host: "sip.local"}) {
		t.Error("1001 is not anonymous")
	}
}

// identityRoute and identityInvite are the fixtures of
// mods/connect/test/identity_route_uri.unit.test.ts: a Trunk like the WhatsApp
// one, and a Peer's INVITE to a callee through it.
func identityRoute(rewrite bool) *route {
	r := &route{
		user:           "+15555550188",
		host:           "wa.meta.vc",
		port:           5061,
		advertisedHost: "wa.meta.vc",
		advertisedPort: 5061,
		transport:      "TLS",
		edgePortRef:    "edgeport-01",
		listeningPoints: []*ppb.NetInterface{
			{Host: "10.216.30.40", Port: 5060, Transport: common.Transport_UDP},
			{Host: "10.216.30.40", Port: 5060, Transport: common.Transport_TCP},
			{Host: "10.216.30.40", Port: 5061, Transport: common.Transport_TLS},
		},
		localnets:     []string{"10.216.30.40/29"},
		externalAddrs: []string{"203.0.113.10"},
	}
	if rewrite {
		r.rewriteFrom = &fromRewrite{user: "+15555550100", host: "wa-1.pstn.example.com"}
	}
	return r
}

func identityInvite() *ppb.MessageRequest {
	req := newRequest(testNow(), requestOpts{fromUser: "roomr", fromDomain: "default", toUser: "+15555550188", toDomain: "10.216.30.40", noAuth: true})
	r := identityRoute(false)
	req.ListeningPoints = r.listeningPoints
	req.Localnets = r.localnets
	req.ExternalAddrs = r.externalAddrs
	req.Message.Route = nil
	req.Message.To.Address.Uri.Port = -1
	req.Message.To.Tag = "callee-tag"
	return req
}

func TestRewriteFromWithNumber(t *testing.T) {
	t.Run("presents the Number at the given domain, To at the Trunk", func(t *testing.T) {
		req := identityInvite()
		rewriteFromWithNumber(req, identityRoute(true))
		from := req.GetMessage().GetFrom()
		to := req.GetMessage().GetTo()
		uri := from.GetAddress().GetUri()
		if uri.GetUser() != "+15555550100" || uri.GetHost() != "wa-1.pstn.example.com" || uri.GetUserParam() != "phone" || uri.GetPort() != -1 {
			t.Errorf("From = %v", uri)
		}
		if from.GetTag() != "9041462a" {
			t.Errorf("From tag = %q", from.GetTag())
		}
		if u := to.GetAddress().GetUri(); u.GetUser() != "+15555550188" || u.GetHost() != "wa.meta.vc" || u.GetPort() != 5061 {
			t.Errorf("To = %v", u)
		}
		if to.GetTag() != "callee-tag" {
			t.Errorf("To tag = %q", to.GetTag())
		}
	})
	t.Run("does nothing when the Trunk does not ask", func(t *testing.T) {
		req := identityInvite()
		want := proto.Clone(req)
		rewriteFromWithNumber(req, identityRoute(false))
		if !proto.Equal(req, want) {
			t.Errorf("request changed: %v", req)
		}
	})
	t.Run("moves To but never rewrites an anonymous From", func(t *testing.T) {
		req := identityInvite()
		req.Message.From.Address.Uri.User = "anonymous"
		req.Message.From.Address.Uri.Host = "anonymous.invalid"
		params := applyTrunkIdentity(req, identityRoute(true))
		if u := req.GetMessage().GetFrom().GetAddress().GetUri(); u.GetUser() != "anonymous" || u.GetHost() != "anonymous.invalid" {
			t.Errorf("From = %v", u)
		}
		if req.GetMessage().GetTo().GetAddress().GetUri().GetHost() != "wa.meta.vc" {
			t.Errorf("To = %v", req.GetMessage().GetTo())
		}
		if len(params) != 2 || params["rco"] == "" || params["rcn"] == "" {
			t.Errorf("parameters = %v", params)
		}
	})
}

func TestApplyTrunkIdentity(t *testing.T) {
	req := identityInvite()
	want := proto.Clone(req)
	if params := applyTrunkIdentity(req, identityRoute(false)); params != nil {
		t.Errorf("a Trunk that asks for nothing = %v", params)
	}
	if !proto.Equal(req, want) {
		t.Errorf("request changed: %v", req)
	}
	r := identityRoute(false)
	r.normalizeToE164 = true
	req = newRequest(testNow(), requestOpts{fromUser: "1001", fromDomain: "sip.local", toUser: "17853178070", toDomain: "sip.local", noAuth: true})
	params := applyTrunkIdentity(req, r)
	if decoded(t, params["rco"]) != "17853178070@sip.local:5060" || decoded(t, params["rcn"]) != "+17853178070@sip.local:5060" || params["rfo"] != "" {
		t.Errorf("parameters = %v", params)
	}
}

func TestTailorWritesTheMappingInTheRecordRouteURI(t *testing.T) {
	req := identityInvite()
	if err := tailor(req, identityRoute(true), false); err != nil {
		t.Fatalf("tailor() error = %v", err)
	}
	msg := req.GetMessage()
	if msg.GetTo().GetAddress().GetUri().GetHost() != msg.GetRequestUri().GetHost() || msg.GetTo().GetAddress().GetUri().GetPort() != msg.GetRequestUri().GetPort() {
		t.Errorf("To = %v, Request-URI = %v", msg.GetTo(), msg.GetRequestUri())
	}
	added := msg.GetRecordRoute()[:2]
	for _, rr := range added {
		values := decodeIdentityUser(rr.GetAddress().GetUri().GetUser())
		if len(values) != 4 {
			t.Fatalf("Record-Route user = %q", rr.GetAddress().GetUri().GetUser())
		}
		if got := decoded(t, values["rfo"]); got != "roomr@default:5060" {
			t.Errorf("rfo = %q", got)
		}
		if got := decoded(t, values["rfn"]); got != "+15555550100@wa-1.pstn.example.com;user=phone" {
			t.Errorf("rfn = %q", got)
		}
		if got := decoded(t, values["rco"]); got != "+15555550188@10.216.30.40" {
			t.Errorf("rco = %q", got)
		}
		if got := decoded(t, values["rcn"]); got != "+15555550188@wa.meta.vc:5061" {
			t.Errorf("rcn = %q", got)
		}
		if !reflect.DeepEqual(rr.GetParameters(), map[string]string{"r2": "on"}) {
			t.Errorf("parameters = %v", rr.GetParameters())
		}
	}
}

func TestSwapIdentityFromRouteSet(t *testing.T) {
	// The Record-Route entries the INVITE got, as a user agent keeps them
	invite := identityInvite()
	if err := tailor(invite, identityRoute(true), false); err != nil {
		t.Fatalf("tailor() error = %v", err)
	}
	added := invite.GetMessage().GetRecordRoute()[:2]
	routeSet := func(reverse bool) []*spb.Route {
		var out []*spb.Route
		for _, rr := range added {
			entry := &spb.Route{Address: &spb.Address{Uri: proto.Clone(rr.GetAddress().GetUri()).(*spb.SipURI)}}
			if reverse {
				out = append([]*spb.Route{entry}, out...)
			} else {
				out = append(out, entry)
			}
		}
		return out
	}
	bye := func(from, to *spb.SipURI, route []*spb.Route) *ppb.MessageRequest {
		req := identityInvite()
		req.Method = ppb.Method_BYE
		req.Message.From.Address.Uri = from
		req.Message.To.Address.Uri = to
		req.Message.Route = route
		return req
	}
	callerFrom := func() *spb.SipURI { return &spb.SipURI{User: "roomr", Host: "default", Port: 5060} }
	callerTo := func() *spb.SipURI { return &spb.SipURI{User: "+15555550188", Host: "10.216.30.40", Port: -1} }
	trunkTo := func() *spb.SipURI { return &spb.SipURI{User: "+15555550188", Host: "wa.meta.vc", Port: 5061} }
	trunkFrom := func() *spb.SipURI {
		return &spb.SipURI{User: "+15555550100", Host: "wa-1.pstn.example.com", UserParam: "phone", Port: -1}
	}
	uriIs := func(t *testing.T, label string, got, want *spb.SipURI) {
		t.Helper()
		if got.GetUser() != want.GetUser() || got.GetHost() != want.GetHost() || got.GetPort() != want.GetPort() || got.GetUserParam() != want.GetUserParam() {
			t.Errorf("%s = %v, want %v", label, got, want)
		}
	}
	t.Run("gives the caller's BYE the From and To the Trunk saw", func(t *testing.T) {
		req := bye(callerFrom(), callerTo(), routeSet(true))
		swapIdentityFromRouteSet(req)
		uriIs(t, "From", req.GetMessage().GetFrom().GetAddress().GetUri(), trunkFrom())
		uriIs(t, "To", req.GetMessage().GetTo().GetAddress().GetUri(), trunkTo())
	})
	t.Run("gives the Trunk's BYE the caller's own From and To", func(t *testing.T) {
		req := bye(trunkTo(), trunkFrom(), routeSet(false))
		swapIdentityFromRouteSet(req)
		uriIs(t, "From", req.GetMessage().GetFrom().GetAddress().GetUri(), callerTo())
		uriIs(t, "To", req.GetMessage().GetTo().GetAddress().GetUri(), callerFrom())
	})
	t.Run("leaves a To the Trunk did not get from Routr alone", func(t *testing.T) {
		other := &spb.SipURI{User: "someone", Host: "else", Port: -1}
		req := bye(trunkTo(), other, routeSet(false))
		swapIdentityFromRouteSet(req)
		uriIs(t, "To", req.GetMessage().GetTo().GetAddress().GetUri(), other)
	})
	t.Run("ignores the mapping on a Route entry of another EdgePort", func(t *testing.T) {
		route := routeSet(true)
		for _, entry := range route {
			entry.Address.Uri.Host = "198.51.100.9"
		}
		req := bye(callerFrom(), callerTo(), route)
		swapIdentityFromRouteSet(req)
		uriIs(t, "From", req.GetMessage().GetFrom().GetAddress().GetUri(), callerFrom())
	})
	t.Run("reads a mapping in the header parameters, without the port", func(t *testing.T) {
		values := decodeIdentityUser(added[0].GetAddress().GetUri().GetUser())
		uri := proto.Clone(added[0].GetAddress().GetUri()).(*spb.SipURI)
		uri.User = ""
		req := bye(callerFrom(), callerTo(), []*spb.Route{{Address: &spb.Address{Uri: uri}, Parameters: values}})
		swapIdentityFromRouteSet(req)
		if got := req.GetMessage().GetFrom().GetAddress().GetUri(); got.GetUser() != "+15555550100" || got.GetPort() != 5060 {
			t.Errorf("From = %v, want the new user on the port it had", got)
		}
	})
	t.Run("does nothing without a mapping", func(t *testing.T) {
		req := bye(callerFrom(), callerTo(), []*spb.Route{{Address: &spb.Address{Uri: &spb.SipURI{Host: "10.216.30.40", Port: 5060}}}})
		swapIdentityFromRouteSet(req)
		uriIs(t, "From", req.GetMessage().GetFrom().GetAddress().GetUri(), callerFrom())
	})
}
