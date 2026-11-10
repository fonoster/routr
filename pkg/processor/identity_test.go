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

package processor

import (
	"encoding/base64"
	"reflect"
	"strings"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The identity cases of mods/processor/test/alterations.unit.test.ts ("per-Trunk
// caller identity") and identity_uri_form.unit.test.ts.

func encoded(s string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(s))
}

func decoded(t *testing.T, value string) string {
	t.Helper()
	out, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		t.Fatalf("decode %q: %v", value, err)
	}
	return string(out)
}

var number = &FromRewrite{User: "+18295863314", Host: "sip.provider.net"}

func fromURI(req *MessageRequest) *sipmessage.SipURI {
	return req.GetMessage().GetFrom().GetAddress().GetUri()
}

func toURI(req *MessageRequest) *sipmessage.SipURI {
	return req.GetMessage().GetTo().GetAddress().GetUri()
}

func TestEncodeDecodeIdentity(t *testing.T) {
	tests := []struct {
		uri     *sipmessage.SipURI
		written string
		want    *identity
	}{
		{&sipmessage.SipURI{User: "+15555550188", Host: "wa.meta.vc", Port: 5061}, "+15555550188@wa.meta.vc:5061", &identity{user: "+15555550188", host: "wa.meta.vc", port: 5061}},
		{&sipmessage.SipURI{User: "alice", Host: "[::1]", Port: 5060}, "alice@[::1]:5060", &identity{user: "alice", host: "[::1]", port: 5060}},
		{&sipmessage.SipURI{User: "+18295863314", Host: "sip.provider.net", Port: -1, UserParam: "phone"}, "+18295863314@sip.provider.net;user=phone", &identity{user: "+18295863314", host: "sip.provider.net", userParam: "phone"}},
		{&sipmessage.SipURI{User: "bob", Host: "[::1]"}, "bob@[::1]", &identity{user: "bob", host: "[::1]"}},
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
	for _, value := range []string{"", encoded("no-at-sign"), "not base64!"} {
		if got := decodeIdentity(value); got != nil {
			t.Errorf("decodeIdentity(%q) = %+v, want nil", value, got)
		}
	}
}

func TestDecodeIdentityUser(t *testing.T) {
	values := map[string]string{"rfo": "YQ", "rfn": "Yg", "rco": "Yw", "rcn": "ZA"}
	if got := identityUser(values); got != "rfo.YQ.rfn.Yg.rco.Yw.rcn.ZA" {
		t.Errorf("identityUser() = %q", got)
	}
	if got := identityUser(nil); got != "" {
		t.Errorf("identityUser(nil) = %q", got)
	}
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

func TestNormalizeToE164Alteration(t *testing.T) {
	tests := []struct {
		name, from, to   string
		wantFrom, wantTo string
	}{
		{"converts From and To", "17853178071", "46721895538", "+17853178071", "+46721895538"},
		{"converts To and leaves a From that is no number", "1001", "46721895538", "1001", "+46721895538"},
		// A French landline (01) has no mobile prefix
		{"normalizes a landline in every header, From included", "33183646565", "33183646566", "+33183646565", "+33183646566"},
		{"a number that already has its plus", "+17853178071", "+46721895538", "+17853178071", "+46721895538"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := pstnMessage(tt.from, tt.to)
			NormalizeToE164(req)
			if got := fromURI(req).GetUser(); got != tt.wantFrom {
				t.Errorf("from = %q, want %q", got, tt.wantFrom)
			}
			if got := toURI(req).GetUser(); got != tt.wantTo {
				t.Errorf("to = %q, want %q", got, tt.wantTo)
			}
			if got := req.GetMessage().GetRequestUri().GetUser(); got != tt.wantTo {
				t.Errorf("requestUri = %q, want %q", got, tt.wantTo)
			}
		})
	}
	t.Run("a response, which has no Request-URI", func(t *testing.T) {
		req := pstnMessage("17853178071", "46721895538")
		req.Message.MessageType = &sipmessage.SIPMessage_ResponseType{ResponseType: sipmessage.ResponseType_OK}
		NormalizeToE164(req)
		if got := fromURI(req).GetUser(); got != "+17853178071" {
			t.Errorf("from = %q", got)
		}
	})
}

func TestIsAnonymous(t *testing.T) {
	if !IsAnonymous(&sipmessage.SipURI{Host: "anonymous.invalid"}) || !IsAnonymous(&sipmessage.SipURI{User: "Anonymous", Host: "x.com"}) || !IsAnonymous(&sipmessage.SipURI{User: "1", Host: "ANONYMOUS.invalid"}) {
		t.Error("anonymous not recognized")
	}
	if IsAnonymous(&sipmessage.SipURI{User: "1001", Host: "sip.local"}) {
		t.Error("1001 is not anonymous")
	}
}

func TestRewriteFromWithNumber(t *testing.T) {
	t.Run("presents the Number as the caller at the given domain", func(t *testing.T) {
		req := exampleRequest()
		RewriteFromWithNumber(req, exampleRoute(), number)
		from := fromURI(req)
		if from.GetUser() != "+18295863314" || from.GetHost() != "sip.provider.net" || from.GetUserParam() != "phone" || from.GetPort() != -1 {
			t.Errorf("from = %v", from)
		}
		// Tag and display name stay, so the dialog is the same one
		if req.GetMessage().GetFrom().GetTag() != "9041462a" || req.GetMessage().GetFrom().GetAddress().GetDisplayName() != "John Doe" {
			t.Errorf("from header = %v", req.GetMessage().GetFrom())
		}
	})
	t.Run("moves To to the trunk's host and port, its user kept", func(t *testing.T) {
		req := pstnMessage("1001", "17853178070")
		trunk := exampleRoute()
		trunk.Host = "wa.meta.vc"
		trunk.Port = "5061"
		RewriteFromWithNumber(req, trunk, number)
		to := toURI(req)
		if to.GetUser() != "17853178070" || to.GetHost() != "wa.meta.vc" || to.GetPort() != 5061 || to.GetTransportParam() != "TCP" {
			t.Errorf("to = %v", to)
		}
	})
	t.Run("uses whatever domain the rewrite carries", func(t *testing.T) {
		req := exampleRequest()
		RewriteFromWithNumber(req, exampleRoute(), &FromRewrite{User: "+18295863314", Host: "wa.example.com"})
		if got := fromURI(req).GetHost(); got != "wa.example.com" {
			t.Errorf("from host = %q", got)
		}
	})
	t.Run("does nothing without a rewrite", func(t *testing.T) {
		req := exampleRequest()
		RewriteFromWithNumber(req, exampleRoute(), nil)
		if !proto.Equal(req, exampleRequest()) {
			t.Error("the request changed")
		}
	})
	t.Run("never rewrites an anonymous From, and still moves To", func(t *testing.T) {
		req := pstnMessage("anonymous", "17853178070")
		fromURI(req).Host = "anonymous.invalid"
		RewriteFromWithNumber(req, exampleRoute(), number)
		if from := fromURI(req); from.GetUser() != "anonymous" || from.GetHost() != "anonymous.invalid" {
			t.Errorf("from = %v", from)
		}
		if got := toURI(req).GetHost(); got != "127.0.0.1" {
			t.Errorf("to host = %q", got)
		}
	})
}

func TestIdentityRewriteParameters(t *testing.T) {
	t.Run("records nothing when the identity did not change", func(t *testing.T) {
		req := exampleRequest()
		if got := IdentityRewriteParameters(proto.Clone(req).(*MessageRequest), req); len(got) != 0 {
			t.Errorf("parameters = %v", got)
		}
	})
	// The rule of the Contract: the alterations change the request in place,
	// so the original has to be a clone taken before them
	t.Run("the same request twice records nothing", func(t *testing.T) {
		req := exampleRequest()
		RewriteFromWithNumber(req, exampleRoute(), number)
		if got := IdentityRewriteParameters(req, req); len(got) != 0 {
			t.Errorf("parameters = %v", got)
		}
	})
	t.Run("records the original and the new From and To", func(t *testing.T) {
		altered := exampleRequest()
		original := proto.Clone(altered).(*MessageRequest)
		RewriteFromWithNumber(altered, exampleRoute(), number)
		parameters := IdentityRewriteParameters(original, altered)
		// To moved to the Trunk's host, so it is recorded as well
		want := map[string]string{
			// With the port, when the URI names one
			"rfo": "1001@sip.local:5060",
			"rfn": "+18295863314@sip.provider.net;user=phone",
			"rco": "1001@sip.local:5060",
			"rcn": "1001@127.0.0.1:5060",
		}
		if len(parameters) != len(want) {
			t.Fatalf("parameters = %v", parameters)
		}
		for name, value := range want {
			// Base64url: a SIP token, no quoting needed
			if !identityValue.MatchString(parameters[name]) {
				t.Errorf("%s = %q is not base64url", name, parameters[name])
			}
			if got := decoded(t, parameters[name]); got != value {
				t.Errorf("%s = %q, want %q", name, got, value)
			}
		}

		before := len(altered.GetMessage().GetRecordRoute())
		if err := AddSelfRecordRoute(altered, exampleRoute(), parameters); err != nil {
			t.Fatal(err)
		}
		rr := altered.GetMessage().GetRecordRoute()
		// Every entry this EdgePort added, and none of the ones already there
		added := len(rr) - before
		if added < 1 {
			t.Fatalf("recordRoute = %v", rr)
		}
		if strings.HasPrefix(rr[added].GetAddress().GetUri().GetUser(), "rfo.") {
			t.Error("an entry that was already there got the mapping")
		}
		user := "rfo." + parameters["rfo"] + ".rfn." + parameters["rfn"] + ".rco." + parameters["rco"] + ".rcn." + parameters["rcn"]
		for _, entry := range rr[:added] {
			// In the URI user part, which a user agent keeps (RFC 3261 section
			// 12.1.2), and not as header parameters, which it may drop
			if got := entry.GetAddress().GetUri().GetUser(); got != user {
				t.Errorf("user = %q, want %q", got, user)
			}
			if _, ok := entry.GetParameters()["rfo"]; ok {
				t.Error("the mapping is in the header parameters")
			}
		}
	})
	t.Run("records a To normalized by NormalizeToE164", func(t *testing.T) {
		altered := pstnMessage("1001", "46721895538")
		original := proto.Clone(altered).(*MessageRequest)
		NormalizeToE164(altered)
		parameters := IdentityRewriteParameters(original, altered)
		if len(parameters) != 2 || decoded(t, parameters["rco"]) != "46721895538@sip.local:5060" || decoded(t, parameters["rcn"]) != "+46721895538@sip.local:5060" {
			t.Errorf("parameters = %v", parameters)
		}
	})
	t.Run("a To that changes only its port", func(t *testing.T) {
		altered := exampleRequest()
		original := proto.Clone(altered).(*MessageRequest)
		toURI(altered).Port = 5070
		if got := IdentityRewriteParameters(original, altered); len(got) != 2 || got["rcn"] == "" {
			t.Errorf("parameters = %v", got)
		}
	})
}

// The in-dialog cases of alterations.unit.test.ts: the mapping in the header
// parameters of this EdgePort's Route entry, the form Routr wrote before the
// mapping moved into the URI.
func TestSwapIdentityFromRouteSetHeaderParameters(t *testing.T) {
	// A call to a callee other than the caller, so the From and To mappings
	// tell them apart
	invite := pstnMessage("1001", "17853178070")
	original := proto.Clone(invite).(*MessageRequest)
	RewriteFromWithNumber(invite, exampleRoute(), number)
	parameters := IdentityRewriteParameters(original, invite)

	caller, callee, presented := fromURI(original), toURI(original), fromURI(invite)

	// An in-dialog request whose first Route entry is this EdgePort, stamped
	// by the INVITE that set up the dialog
	inDialog := func(from, to *sipmessage.SipURI) *MessageRequest {
		req := pstnMessage("x", "y")
		req.Message.From.Address.Uri = proto.Clone(from).(*sipmessage.SipURI)
		req.Message.To.Address.Uri = proto.Clone(to).(*sipmessage.SipURI)
		req.Message.Route[0].Parameters = parameters
		return req
	}

	t.Run("gives a request from the caller the From the Trunk knows", func(t *testing.T) {
		req := inDialog(caller, callee)
		SwapIdentityFromRouteSet(req)
		if from := fromURI(req); from.GetUser() != "+18295863314" || from.GetHost() != "sip.provider.net" || from.GetUserParam() != "phone" {
			t.Errorf("from = %v", from)
		}
	})
	t.Run("gives a request from the Trunk the caller's own identity in To", func(t *testing.T) {
		req := inDialog(callee, presented)
		SwapIdentityFromRouteSet(req)
		if to := toURI(req); to.GetUser() != "1001" || to.GetHost() != "sip.local" || to.GetUserParam() != "" {
			t.Errorf("to = %v", to)
		}
	})
	t.Run("leaves a To the Trunk did not get from Routr alone", func(t *testing.T) {
		// A carrier that answers with the caller's original identity in To
		req := inDialog(callee, caller)
		SwapIdentityFromRouteSet(req)
		if to := toURI(req); to.GetUser() != "1001" || to.GetHost() != "sip.local" {
			t.Errorf("to = %v", to)
		}
	})
	t.Run("ignores the mapping on a Route entry of another EdgePort", func(t *testing.T) {
		req := inDialog(caller, callee)
		req.Message.Route[0].Address.Uri.Host = "192.0.2.10"
		SwapIdentityFromRouteSet(req)
		if got := fromURI(req).GetUser(); got != "1001" {
			t.Errorf("from user = %q", got)
		}
	})
}

// The cases of identity_uri_form.unit.test.ts: the mapping in the Route URI
// user part.
func TestSwapIdentityFromRouteSetURIForm(t *testing.T) {
	// The mapping an INVITE from the caller (1001@sip.local) to a WhatsApp
	// callee through a Trunk leaves in Record-Route
	mapping := map[string]string{
		"rfo": encoded("1001@sip.local"),
		"rfn": encoded("+18295863314@sip.provider.net;user=phone"),
		"rco": encoded("+15555550188@10.216.30.40"),
		"rcn": encoded("+15555550188@wa.meta.vc:5061"),
	}
	userPart := identityUser(mapping)
	uri := func(user, host string, port int32) *sipmessage.SipURI {
		return &sipmessage.SipURI{User: user, Host: host, Port: port}
	}
	caller := func() *sipmessage.SipURI { return uri("1001", "sip.local", -1) }
	callee := func() *sipmessage.SipURI { return uri("+15555550188", "10.216.30.40", -1) }
	presented := func() *sipmessage.SipURI { return uri("+18295863314", "sip.provider.net", -1) }
	calleeAtTrunk := func() *sipmessage.SipURI { return uri("+15555550188", "wa.meta.vc", 5061) }

	// An in-dialog request whose first Route entry is this EdgePort
	inDialog := func(from, to *sipmessage.SipURI, user string, parameters map[string]string) *MessageRequest {
		req := pstnMessage("x", "y")
		req.Message.From.Address.Uri = from
		req.Message.To.Address.Uri = to
		req.Message.Route[0].Address.Uri.User = user
		req.Message.Route[0].Parameters = parameters
		return req
	}
	expect := func(t *testing.T, what string, got *sipmessage.SipURI, user, host, userParam string, port int32) {
		t.Helper()
		if got.GetUser() != user || got.GetHost() != host || got.GetUserParam() != userParam || got.GetPort() != port {
			t.Errorf("%s = %v, want %s@%s:%d;user=%s", what, got, user, host, port, userParam)
		}
	}

	t.Run("gives a request from the caller the From and To the Trunk saw", func(t *testing.T) {
		req := inDialog(caller(), callee(), userPart, nil)
		SwapIdentityFromRouteSet(req)
		expect(t, "from", fromURI(req), "+18295863314", "sip.provider.net", "phone", -1)
		expect(t, "to", toURI(req), "+15555550188", "wa.meta.vc", "", 5061)
	})
	t.Run("gives a request from the Trunk the caller's original From and To", func(t *testing.T) {
		req := inDialog(calleeAtTrunk(), presented(), userPart, nil)
		SwapIdentityFromRouteSet(req)
		// rco has no port, so the URI has none
		expect(t, "from", fromURI(req), "+15555550188", "10.216.30.40", "", -1)
		expect(t, "to", toURI(req), "1001", "sip.local", "", -1)
	})
	t.Run("leaves the port alone when the mapping is in header parameters", func(t *testing.T) {
		req := inDialog(calleeAtTrunk(), presented(), "", mapping)
		SwapIdentityFromRouteSet(req)
		expect(t, "from", fromURI(req), "+15555550188", "10.216.30.40", "", 5061)
	})
	t.Run("swaps once, from the user part, when the entry carries both forms", func(t *testing.T) {
		parameters := map[string]string{}
		for name, value := range mapping {
			parameters[name] = value
		}
		parameters["rfn"] = encoded("+15555550111@other.example.net")
		req := inDialog(caller(), callee(), userPart, parameters)
		SwapIdentityFromRouteSet(req)
		expect(t, "from", fromURI(req), "+18295863314", "sip.provider.net", "phone", -1)
	})
	t.Run("ignores a user part of another form and reads the header parameters", func(t *testing.T) {
		req := inDialog(caller(), callee(), "roomr", mapping)
		SwapIdentityFromRouteSet(req)
		expect(t, "from", fromURI(req), "+18295863314", "sip.provider.net", "phone", -1)
	})
	t.Run("ignores the mapping on a Route entry of another EdgePort", func(t *testing.T) {
		req := inDialog(caller(), callee(), userPart, nil)
		req.Message.Route[0].Address.Uri.Host = "192.0.2.10"
		SwapIdentityFromRouteSet(req)
		if !proto.Equal(fromURI(req), caller()) || !proto.Equal(toURI(req), callee()) {
			t.Errorf("from = %v, to = %v", fromURI(req), toURI(req))
		}
	})
	t.Run("leaves a request without a mapping untouched", func(t *testing.T) {
		req := inDialog(caller(), callee(), "", nil)
		before := proto.Clone(req)
		SwapIdentityFromRouteSet(req)
		if !proto.Equal(req, before) {
			t.Error("the request changed")
		}
	})
}

// End to end: the identity a processor rewrites on an INVITE comes back on the
// dialog's BYE, from either side, through nothing but the Record-Route this
// EdgePort added.
func TestIdentitySurvivesTheDialog(t *testing.T) {
	trunk := exampleRoute()
	invite := pstnMessage("1001", "17853178070")
	invite.Method = Method_INVITE

	original := proto.Clone(invite).(*MessageRequest)
	RewriteFromWithNumber(invite, trunk, number)
	parameters := IdentityRewriteParameters(original, invite)
	if len(parameters) != 4 {
		t.Fatalf("parameters = %v", parameters)
	}
	before := len(invite.GetMessage().GetRecordRoute())
	if err := AddSelfRecordRoute(invite, trunk, parameters); err != nil {
		t.Fatal(err)
	}
	if added := len(invite.GetMessage().GetRecordRoute()) - before; added != 1 {
		t.Fatalf("%d Record-Route entries added, want 1", added)
	}
	recorded := invite.GetMessage().GetRecordRoute()[0]

	// An in-dialog BYE: both ends copy the Record-Route URIs into their route
	// set (RFC 3261 section 12.1.2) and drop its header parameters
	bye := func(from, to *sipmessage.SipURI) *MessageRequest {
		req := exampleRequest()
		req.Method = Method_BYE
		req.Message.From.Address.Uri = proto.Clone(from).(*sipmessage.SipURI)
		req.Message.To.Address.Uri = proto.Clone(to).(*sipmessage.SipURI)
		req.Message.To.Tag = "callee-tag"
		req.Message.Route = []*sipmessage.Route{{Address: proto.Clone(recorded.GetAddress()).(*sipmessage.Address)}}
		return req
	}
	same := func(t *testing.T, what string, got, want *sipmessage.SipURI) {
		t.Helper()
		if got.GetUser() != want.GetUser() || got.GetHost() != want.GetHost() || uriPort(got) != uriPort(want) || got.GetUserParam() != want.GetUserParam() {
			t.Errorf("%s = %v, want %v", what, got, want)
		}
	}

	t.Run("a BYE from the Trunk gets the original From and To back", func(t *testing.T) {
		// The Trunk is the callee: its From is the INVITE's To as it saw it,
		// its To the Number the caller was presented as
		req := bye(toURI(invite), fromURI(invite))
		SwapIdentityFromRouteSet(req)
		same(t, "from", fromURI(req), toURI(original))
		same(t, "to", toURI(req), fromURI(original))
	})
	t.Run("a BYE from the caller gets the From and To the Trunk saw", func(t *testing.T) {
		req := bye(fromURI(original), toURI(original))
		SwapIdentityFromRouteSet(req)
		same(t, "from", fromURI(req), fromURI(invite))
		same(t, "to", toURI(req), toURI(invite))
	})
	t.Run("without the clone the BYE can't be restored", func(t *testing.T) {
		req := pstnMessage("1001", "17853178070")
		RewriteFromWithNumber(req, trunk, number)
		if err := AddSelfRecordRoute(req, trunk, IdentityRewriteParameters(req, req)); err != nil {
			t.Fatal(err)
		}
		if user := req.GetMessage().GetRecordRoute()[0].GetAddress().GetUri().GetUser(); user != "" {
			t.Errorf("the Record-Route carries %q", user)
		}
	})
}
