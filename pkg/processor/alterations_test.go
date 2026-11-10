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
	"errors"
	"reflect"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/location"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The cases of mods/processor/test/alterations.unit.test.ts, on the fixtures
// of examples_test.go. The expected values are the Node functions' results on
// the same input, copied here as golden values.

func TestFixRequestURI(t *testing.T) {
	dialed := "17853178070"
	tests := []struct {
		name     string
		route    func() *location.Route
		wantUser string
	}{
		{"rewrites the user with the route user for a registered route", exampleRoute, "1001"},
		{"keeps the user when the route has none (outbound trunk)", func() *location.Route { r := exampleRoute(); r.User = ""; return r }, dialed},
		{"keeps the user when the route is not registered", func() *location.Route { r := exampleRoute(); r.RegisteredOn = 0; return r }, dialed},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := exampleRequest()
			req.Message.GetRequestUri().User = dialed
			FixRequestURI(req, tt.route())
			uri := req.GetMessage().GetRequestUri()
			if uri.GetHost() != "127.0.0.1" || uri.GetPort() != 5060 || uri.GetTransportParam() != "TCP" {
				t.Errorf("requestUri = %v", uri)
			}
			if uri.GetUser() != tt.wantUser {
				t.Errorf("user = %q, want %q", uri.GetUser(), tt.wantUser)
			}
		})
	}
	t.Run("a port that is not a number reads 0", func(t *testing.T) {
		req := exampleRequest()
		r := exampleRoute()
		r.Port = "sip"
		FixRequestURI(req, r)
		if got := req.GetMessage().GetRequestUri().GetPort(); got != 0 {
			t.Errorf("port = %d", got)
		}
	})
}

func TestDecreaseMaxForwards(t *testing.T) {
	req := exampleRequest()
	DecreaseMaxForwards(req)
	if got := req.GetMessage().GetMaxForwards().GetMaxForwards(); got != 69 {
		t.Errorf("maxForwards = %d", got)
	}
	req.Message.MaxForwards = nil
	DecreaseMaxForwards(req)
	if req.GetMessage().GetMaxForwards() != nil {
		t.Error("a missing Max-Forwards was created")
	}
}

func expectTopVia(t *testing.T, req *MessageRequest, host string, port int32, transport string) {
	t.Helper()
	vias := req.GetMessage().GetVia()
	if len(vias) != 3 {
		t.Fatalf("via = %d entries, want 3", len(vias))
	}
	top := vias[0]
	if top.GetHost() != host || top.GetPort() != port || top.GetTransport() != transport || !top.GetRPortFlag() {
		t.Errorf("via[0] = %v", top)
	}
	if top.GetBranch() != "" || top.GetReceived() != "" || top.GetRPort() != 0 || top.GetTtl() != 0 {
		t.Errorf("via[0] carries more than the Node code set: %v", top)
	}
}

func TestAddSelfVia(t *testing.T) {
	t.Run("same edgeport", func(t *testing.T) {
		req := exampleRequest()
		if err := AddSelfVia(req, exampleRoute()); err != nil {
			t.Fatal(err)
		}
		expectTopVia(t, req, "127.0.0.1", 5060, "TCP")
	})
	t.Run("different edgeport", func(t *testing.T) {
		req := exampleRequest()
		if err := AddSelfVia(req, exampleRouteOnAnotherEdgePort()); err != nil {
			t.Fatal(err)
		}
		expectTopVia(t, req, "127.0.0.1", 5060, "TCP")
	})
	t.Run("different edgeport, endpoint outside the request's localnets", func(t *testing.T) {
		req := exampleRequest()
		r := exampleRouteOnAnotherEdgePort()
		r.Host = "203.0.113.9"
		if err := AddSelfVia(req, r); err != nil {
			t.Fatal(err)
		}
		// The request's external address, not the route's
		expectTopVia(t, req, "200.22.21.42", 5060, "TCP")
	})
	t.Run("no listening point for the route transport", func(t *testing.T) {
		req := exampleRequest()
		r := exampleRoute()
		r.Transport = common.Transport_TLS
		var nlp *noListeningPointError
		if err := AddSelfVia(req, r); !errors.As(err, &nlp) {
			t.Fatalf("error = %v", err)
		}
		if len(req.GetMessage().GetVia()) != 2 {
			t.Error("a failed alteration changed the request")
		}
	})
	t.Run("no interface toward the endpoint", func(t *testing.T) {
		req := exampleRequest()
		r := exampleRoute()
		r.Host = "203.0.113.9"
		r.ExternalAddrs = nil
		if err := AddSelfVia(req, r); !errors.Is(err, ErrNoInterface) {
			t.Fatalf("error = %v, want ErrNoInterface", err)
		}
	})
}

func TestAddSelfViaUsingTheRouteHeaders(t *testing.T) {
	t.Run("the second Route header when there are several", func(t *testing.T) {
		req := exampleRequest()
		if err := AddSelfViaUsingTheRouteHeaders(req); err != nil {
			t.Fatal(err)
		}
		expectTopVia(t, req, "10.100.42.128", 5060, "TCP")
	})
	t.Run("the only Route header, UDP when it names no transport", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Route = req.Message.Route[:1]
		req.Message.Route[0].Address.Uri.TransportParam = ""
		if err := AddSelfViaUsingTheRouteHeaders(req); err != nil {
			t.Fatal(err)
		}
		expectTopVia(t, req, "10.100.42.127", 5060, "UDP")
	})
	t.Run("a lowercase transport is written in uppercase", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Route[1].Address.Uri.TransportParam = "tls"
		if err := AddSelfViaUsingTheRouteHeaders(req); err != nil {
			t.Fatal(err)
		}
		expectTopVia(t, req, "10.100.42.128", 5060, "TLS")
	})
	t.Run("no Route headers", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Route = nil
		if err := AddSelfViaUsingTheRouteHeaders(req); err != nil {
			t.Fatal(err)
		}
		if len(req.GetMessage().GetVia()) != 2 {
			t.Error("a Via was added without a Route header")
		}
	})
	t.Run("a Route header without a URI", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Route[1].Address = nil
		if err := AddSelfViaUsingTheRouteHeaders(req); err == nil {
			t.Fatal("expected an error")
		}
		if len(req.GetMessage().GetVia()) != 2 {
			t.Error("a failed alteration changed the request")
		}
	})
}

func TestAddSelfViaUsingExternalAddrs(t *testing.T) {
	req := exampleRequest()
	if err := AddSelfViaUsingExternalAddrs(req); err != nil {
		t.Fatal(err)
	}
	// sip.local is in no localnet: the external address
	expectTopVia(t, req, "200.22.21.42", 5060, "TCP")

	local := exampleRequest()
	local.Message.GetRequestUri().Host = "10.100.42.5"
	local.Message.GetRequestUri().TransportParam = "udp"
	if err := AddSelfViaUsingExternalAddrs(local); err != nil {
		t.Fatal(err)
	}
	expectTopVia(t, local, "10.100.42.127", 5060, "UDP")

	noTransport := exampleRequest()
	noTransport.Message.GetRequestUri().TransportParam = ""
	if err := AddSelfViaUsingExternalAddrs(noTransport); err != nil {
		t.Fatal(err)
	}
	expectTopVia(t, noTransport, "200.22.21.42", 5060, "UDP")

	noExternal := exampleRequest()
	noExternal.ExternalAddrs = nil
	if err := AddSelfViaUsingExternalAddrs(noExternal); !errors.Is(err, ErrNoInterface) {
		t.Errorf("error = %v, want ErrNoInterface", err)
	}
}

func TestRemoveTopVia(t *testing.T) {
	req := exampleRequest()
	RemoveTopVia(req)
	if vias := req.GetMessage().GetVia(); len(vias) != 1 || vias[0].GetHost() != "127.0.0.1" {
		t.Errorf("via = %v", vias)
	}
	RemoveTopVia(req)
	RemoveTopVia(req)
	if len(req.GetMessage().GetVia()) != 0 {
		t.Error("removing past the last Via failed")
	}
}

func TestAddSelfRecordRoute(t *testing.T) {
	t.Run("uses the listening point from the request", func(t *testing.T) {
		req := exampleRequest()
		if err := AddSelfRecordRoute(req, exampleRoute(), nil); err != nil {
			t.Fatal(err)
		}
		rr := req.GetMessage().GetRecordRoute()
		if len(rr) != 2 {
			t.Fatalf("recordRoute = %d entries, want 2", len(rr))
		}
		u := rr[0].GetAddress().GetUri()
		if u.GetHost() != "127.0.0.1" || u.GetPort() != 5060 || u.GetTransportParam() != "TCP" || !u.GetLrParam() || u.GetUser() != "" {
			t.Errorf("recordRoute[0] = %v", u)
		}
		if len(rr[0].GetParameters()) != 0 {
			t.Errorf("parameters = %v, want none", rr[0].GetParameters())
		}
	})
	t.Run("double record-route when the endpoint is on another interface", func(t *testing.T) {
		req := exampleRequest()
		r := exampleRoute()
		r.AdvertisedHost = "203.0.113.9"
		if err := AddSelfRecordRoute(req, r, nil); err != nil {
			t.Fatal(err)
		}
		rr := req.GetMessage().GetRecordRoute()
		if len(rr) != 3 {
			t.Fatalf("recordRoute = %d entries, want 3", len(rr))
		}
		if rr[0].GetAddress().GetUri().GetHost() != "200.22.21.42" || rr[1].GetAddress().GetUri().GetHost() != "127.0.0.1" {
			t.Errorf("order = %s, %s", rr[0].GetAddress().GetUri().GetHost(), rr[1].GetAddress().GetUri().GetHost())
		}
		for _, e := range rr[:2] {
			if !reflect.DeepEqual(e.GetParameters(), map[string]string{"r2": "on"}) {
				t.Errorf("parameters = %v, want r2=on", e.GetParameters())
			}
		}
	})
	t.Run("writes the identity mapping in the URI user part", func(t *testing.T) {
		req := exampleRequest()
		params := map[string]string{"rfo": "MTAwMUBzaXAubG9jYWw", "rfn": "KzE4Mjk1ODYzMzE0QHNpcC5wcm92aWRlci5uZXQ"}
		if err := AddSelfRecordRoute(req, exampleRoute(), params); err != nil {
			t.Fatal(err)
		}
		rr := req.GetMessage().GetRecordRoute()[0]
		if u := rr.GetAddress().GetUri().GetUser(); u != "rfo.MTAwMUBzaXAubG9jYWw.rfn.KzE4Mjk1ODYzMzE0QHNpcC5wcm92aWRlci5uZXQ" {
			t.Errorf("user = %q", u)
		}
		if _, ok := rr.GetParameters()["rfo"]; ok {
			t.Error("the mapping is in the header parameters")
		}
	})
	t.Run("no listening point for the sender transport", func(t *testing.T) {
		req := exampleRequest()
		req.Sender.Transport = common.Transport_TLS
		if err := AddSelfRecordRoute(req, exampleRoute(), nil); err == nil {
			t.Fatal("expected an error")
		}
		if len(req.GetMessage().GetRecordRoute()) != 1 {
			t.Error("a failed alteration changed the request")
		}
	})
	t.Run("no interface toward the endpoint", func(t *testing.T) {
		req := exampleRequest()
		req.ExternalAddrs = nil
		r := exampleRoute()
		r.AdvertisedHost = "203.0.113.9"
		if err := AddSelfRecordRoute(req, r, nil); !errors.Is(err, ErrNoInterface) {
			t.Fatalf("error = %v, want ErrNoInterface", err)
		}
	})
}

func TestAddRouteToNextHop(t *testing.T) {
	req := exampleRequest()
	AddRouteToNextHop(req, exampleRoute())
	routes := req.GetMessage().GetRoute()
	if len(routes) != 3 {
		t.Fatalf("route = %d entries, want 3", len(routes))
	}
	u := routes[0].GetAddress().GetUri()
	if u.GetHost() != "127.0.0.1" || u.GetPort() != 5060 || u.GetTransportParam() != "TCP" || !u.GetLrParam() {
		t.Errorf("route[0] = %v", u)
	}

	same := exampleRequest()
	same.Message.GetRequestUri().Host = "127.0.0.1"
	AddRouteToNextHop(same, exampleRoute())
	if len(same.GetMessage().GetRoute()) != 2 {
		t.Error("a Route was added although the Request-URI names the host")
	}
}

func TestAddRouteToPeerEdgePort(t *testing.T) {
	t.Run("the peer's interface facing the endpoint", func(t *testing.T) {
		req := exampleRequest()
		if err := AddRouteToPeerEdgePort(req, exampleRoute()); err != nil {
			t.Fatal(err)
		}
		routes := req.GetMessage().GetRoute()
		if len(routes) != 3 {
			t.Fatalf("route = %d entries, want 3", len(routes))
		}
		u := routes[0].GetAddress().GetUri()
		if u.GetHost() != "127.0.0.1" || u.GetPort() != 5060 || u.GetTransportParam() != "TCP" || !u.GetLrParam() {
			t.Errorf("route[0] = %v", u)
		}
	})
	t.Run("the peer's external address for an endpoint outside its localnets", func(t *testing.T) {
		req := exampleRequest()
		r := exampleRouteOnAnotherEdgePort()
		r.Host = "203.0.113.9"
		if err := AddRouteToPeerEdgePort(req, r); err != nil {
			t.Fatal(err)
		}
		if host := req.GetMessage().GetRoute()[0].GetAddress().GetUri().GetHost(); host != "47.132.130.31" {
			t.Errorf("route[0] host = %q", host)
		}
	})
	t.Run("no interface toward the endpoint", func(t *testing.T) {
		req := exampleRequest()
		r := exampleRoute()
		r.Host = "203.0.113.9"
		r.ExternalAddrs = nil
		if err := AddRouteToPeerEdgePort(req, r); !errors.Is(err, ErrNoInterface) {
			t.Fatalf("error = %v, want ErrNoInterface", err)
		}
		if len(req.GetMessage().GetRoute()) != 2 {
			t.Error("a failed alteration changed the request")
		}
	})
}

func TestRemoveSelfRoutes(t *testing.T) {
	t.Run("removes the Route entries of this EdgePort", func(t *testing.T) {
		req := exampleRequest()
		RemoveSelfRoutes(req)
		routes := req.GetMessage().GetRoute()
		if len(routes) != 1 {
			t.Fatalf("route = %d entries, want 1", len(routes))
		}
		u := routes[0].GetAddress().GetUri()
		if u.GetHost() != "10.100.42.128" || u.GetPort() != 5060 {
			t.Errorf("route[0] = %v", u)
		}
	})
	t.Run("an external address and an alias are this EdgePort's", func(t *testing.T) {
		req := exampleRequest()
		req.Aliases = []string{"sip.example.com"}
		req.Message.Route[0].Address.Uri.Host = "200.22.21.42"
		req.Message.Route[1].Address.Uri.Host = "SIP.Example.com"
		RemoveSelfRoutes(req)
		if len(req.GetMessage().GetRoute()) != 0 {
			t.Errorf("route = %v", req.GetMessage().GetRoute())
		}
	})
	t.Run("another port is not this EdgePort", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Route[0].Address.Uri.Port = 5080
		RemoveSelfRoutes(req)
		if len(req.GetMessage().GetRoute()) != 2 {
			t.Errorf("route = %v", req.GetMessage().GetRoute())
		}
	})
	// The deviation from the Node twin, which throws NoListeningPointError
	// here: RFC 3261 section 16.4 strips a Route only when it names this proxy
	t.Run("keeps a Route on a transport this EdgePort doesn't listen on", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Route[0].Address.Uri.TransportParam = "TLS"
		RemoveSelfRoutes(req)
		routes := req.GetMessage().GetRoute()
		if len(routes) != 2 {
			t.Fatalf("route = %d entries, want 2", len(routes))
		}
		u := routes[0].GetAddress().GetUri()
		if u.GetHost() != "10.100.42.127" || u.GetTransportParam() != "TLS" {
			t.Errorf("route[0] = %v", u)
		}
	})
}

func TestApplyXHeaders(t *testing.T) {
	t.Run("applies the header modifiers", func(t *testing.T) {
		req := exampleRequest()
		ApplyXHeaders(req, exampleHeaders())
		if got := HeaderValue(req, "X-Gateway-Auth"); got != "dXNlcm5hbWU6cGFzc3dvcmQ=" {
			t.Errorf("X-Gateway-Auth = %q", got)
		}
		if got := HeaderValue(req, "user-agent"); got != "" {
			t.Errorf("User-Agent = %q, want it removed", got)
		}
		if HeaderValue(req, "CSeq") == "" {
			t.Error("a header no modifier names is gone")
		}
	})
	t.Run("replaces (not appends) a caller-supplied copy of an added header", func(t *testing.T) {
		req := exampleRequest()
		AddHeader(req, Header{Name: "x-room-id", Value: "spoofed"})
		ApplyXHeaders(req, []HeaderModifier{{Name: "X-Room-Id", Value: "jsa-shqm-iyo"}})
		var copies []string
		for _, ext := range req.GetMessage().GetExtensions() {
			if ext.GetName() == "X-Room-Id" || ext.GetName() == "x-room-id" {
				copies = append(copies, ext.GetValue())
			}
		}
		if !reflect.DeepEqual(copies, []string{"jsa-shqm-iyo"}) {
			t.Errorf("copies = %v", copies)
		}
	})
	t.Run("keeps every copy added under the same name", func(t *testing.T) {
		req := exampleRequest()
		ApplyXHeaders(req, []HeaderModifier{{Name: "X-Tag", Value: "a"}, {Name: "X-Tag", Value: "b"}})
		var values []string
		for _, ext := range req.GetMessage().GetExtensions() {
			if ext.GetName() == "X-Tag" {
				values = append(values, ext.GetValue())
			}
		}
		if !reflect.DeepEqual(values, []string{"a", "b"}) {
			t.Errorf("values = %v", values)
		}
	})
	t.Run("no modifiers", func(t *testing.T) {
		req := exampleRequest()
		ApplyXHeaders(req, nil)
		if !proto.Equal(req, exampleRequest()) {
			t.Error("the request changed")
		}
	})
}

func TestXEdgePortRef(t *testing.T) {
	req := exampleRequest()
	AddXEdgePortRef(req)
	if got := HeaderValue(req, "X-Edgeport-Ref"); got != "edgeport-01" {
		t.Errorf("X-Edgeport-Ref = %q", got)
	}
	if first := req.GetMessage().GetExtensions()[0]; first.GetName() != "X-Edgeport-Ref" {
		t.Errorf("the first extension is %q", first.GetName())
	}
	// Whatever the case of the header name
	AddHeader(req, Header{Name: "x-edgeport-ref", Value: "edgeport-01"})
	RemoveXEdgePortRef(req)
	if got := HeaderValue(req, "X-Edgeport-Ref"); got != "" {
		t.Errorf("X-Edgeport-Ref = %q after removing it", got)
	}
	if HeaderValue(req, "CSeq") == "" {
		t.Error("CSeq is gone")
	}
}

func TestRemoveHeaders(t *testing.T) {
	req := exampleRequest()
	AddHeader(req, Header{Name: "x-app-ref", Value: "app-01"})
	AddHeader(req, Header{Name: "X-ACCESS-KEY-ID", Value: "WO00000000"})
	RemoveHeaders(req, "X-App-Ref", "X-Access-Key-Id")
	if HeaderValue(req, "X-App-Ref") != "" || HeaderValue(req, "X-Access-Key-Id") != "" {
		t.Errorf("extensions = %v", req.GetMessage().GetExtensions())
	}
	if HeaderValue(req, "CSeq") == "" {
		t.Error("CSeq is gone")
	}
	// No names is a no-op
	before := proto.Clone(req)
	RemoveHeaders(req)
	if !proto.Equal(req, before) {
		t.Error("removing no headers changed the request")
	}
}

func TestRemoveAuthorization(t *testing.T) {
	req := exampleRequest()
	RemoveAuthorization(req)
	if req.GetMessage().GetAuthorization() != nil {
		t.Error("the Authorization is still there")
	}
}

func TestFixInvalidContact(t *testing.T) {
	t.Run("a .invalid Contact becomes the address the request came from", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Contact.Address.Uri.Host = "df7jal23ls0d.invalid"
		req.Message.Via[0] = &sipmessage.Via{Host: "192.0.2.4", Port: 5060, Transport: "wss", Received: "203.0.113.7", RPort: 51234}
		FixInvalidContact(req)
		u := req.GetMessage().GetContact().GetAddress().GetUri()
		if u.GetHost() != "203.0.113.7" || u.GetPort() != 51234 || u.GetTransportParam() != "WSS" {
			t.Errorf("contact = %v", u)
		}
	})
	t.Run("the Via host and port without received and rport", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Contact.Address.Uri.Host = "df7jal23ls0d.invalid"
		FixInvalidContact(req)
		u := req.GetMessage().GetContact().GetAddress().GetUri()
		if u.GetHost() != "proxy" || u.GetPort() != 5060 || u.GetTransportParam() != "TCP" {
			t.Errorf("contact = %v", u)
		}
	})
	t.Run("any other Contact stays", func(t *testing.T) {
		req := exampleRequest()
		FixInvalidContact(req)
		if !proto.Equal(req, exampleRequest()) {
			t.Error("the request changed")
		}
	})
	t.Run("no Contact", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Contact = nil
		FixInvalidContact(req)
		if req.GetMessage().GetContact() != nil {
			t.Error("a Contact was created")
		}
	})
}

func TestOverwriteContactWithSenderInfo(t *testing.T) {
	req := exampleRequest()
	req.Sender = &NetInterface{Host: "203.0.113.7", Port: 51234, Transport: common.Transport_WSS}
	OverwriteContactWithSenderInfo(req)
	u := req.GetMessage().GetContact().GetAddress().GetUri()
	if u.GetHost() != "203.0.113.7" || u.GetPort() != 51234 || u.GetTransportParam() != "WSS" || u.GetUser() != "1001" {
		t.Errorf("contact = %v", u)
	}

	noContact := exampleRequest()
	noContact.Message.Contact = nil
	OverwriteContactWithSenderInfo(noContact)
	if noContact.GetMessage().GetContact() != nil {
		t.Error("a Contact was created")
	}
}

// The chain Connect applies to a request routed to its final target, in its
// order (internal/connect/request.go).
func TestAlterationsChain(t *testing.T) {
	req := exampleRequest()
	route := exampleRoute()
	DecreaseMaxForwards(req)
	RemoveAuthorization(req)
	RemoveSelfRoutes(req)
	RemoveXEdgePortRef(req)
	FixInvalidContact(req)
	FixRequestURI(req, route)
	if err := AddSelfVia(req, route); err != nil {
		t.Fatal(err)
	}
	ApplyXHeaders(req, exampleHeaders())
	if err := AddSelfRecordRoute(req, route, nil); err != nil {
		t.Fatal(err)
	}
	AddRouteToNextHop(req, route)

	msg := req.GetMessage()
	if msg.GetMaxForwards().GetMaxForwards() != 69 || msg.GetAuthorization() != nil {
		t.Errorf("maxForwards = %v, authorization = %v", msg.GetMaxForwards(), msg.GetAuthorization())
	}
	if uri := msg.GetRequestUri(); uri.GetUser() != "1001" || uri.GetHost() != "127.0.0.1" {
		t.Errorf("requestUri = %v", uri)
	}
	expectTopVia(t, req, "127.0.0.1", 5060, "TCP")
	if len(msg.GetRecordRoute()) != 2 {
		t.Errorf("recordRoute = %v", msg.GetRecordRoute())
	}
	// The Request-URI names the route's host, so no Route is added; the one
	// left is the other EdgePort's
	if routes := msg.GetRoute(); len(routes) != 1 || routes[0].GetAddress().GetUri().GetHost() != "10.100.42.128" {
		t.Errorf("route = %v", routes)
	}
}
