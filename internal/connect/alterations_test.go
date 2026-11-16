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

	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The fixtures of mods/processor/test/examples.ts: a REGISTER and the route
// to Agent 1001, on this EdgePort and on another one.

func processorRequest() *ppb.MessageRequest {
	tcp := func(user, host string, port int32) *spb.SipURI {
		return &spb.SipURI{User: user, Host: host, TransportParam: "TCP", TtlParam: -1, Port: port}
	}
	return &ppb.MessageRequest{
		Ref:           "AynhXaFtbdXwHrUEzt_rUQ..",
		EdgePortRef:   "edgeport-01",
		Method:        ppb.Method_REGISTER,
		ExternalAddrs: []string{"200.22.21.42"},
		Localnets:     []string{"127.0.0.1/8", "10.100.42.127/24", "10.100.43.128/31"},
		ListeningPoints: []*ppb.NetInterface{
			{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP},
			{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_UDP},
		},
		Sender: &ppb.NetInterface{Host: "127.0.0.1", Port: 36214, Transport: common.Transport_TCP},
		Message: &spb.SIPMessage{
			MessageType: &spb.SIPMessage_RequestUri{RequestUri: tcp("", "sip.local", 5060)},
			Via: []*spb.Via{
				{Host: "proxy", Port: 5060, Branch: "z9hG4bK-524287-1---7315a24d84546819", Transport: "TCP", RPort: -1, Ttl: -1},
				{Host: "127.0.0.1", Port: 36214, Branch: "z9hG4bK-524287-1---7315a24d84546819", Transport: "TCP", RPort: -1, Ttl: -1},
			},
			Extensions: []*spb.Extension{
				{Name: "CSeq", Value: "14 REGISTER"},
				{Name: "Allow", Value: "INVITE"},
				{Name: "User-Agent", Value: "Z 5.4.12 v2.10.13.2"},
				{Name: "Allow-Events", Value: "presence"},
			},
			From: &spb.From{Address: &spb.Address{Uri: &spb.SipURI{User: "1001", Host: "sip.local", TransportParam: "UDP", TtlParam: -1, Port: 5060}, DisplayName: "John Doe"}, Tag: "9041462a"},
			To:   &spb.To{Address: &spb.Address{Uri: tcp("1001", "sip.local", 5060)}},
			Contact: &spb.Contact{
				Address: &spb.Address{Uri: tcp("1001", "127.0.0.1", 36214)},
				Expires: -1, QValue: -1,
			},
			CallId:        &spb.CallID{CallId: "AynhXaFtbdXwHrUEzt_rUQ.."},
			ContentLength: &spb.ContentLength{},
			MaxForwards:   &spb.MaxForwards{MaxForwards: 70},
			Expires:       &spb.Expires{Expires: 60},
			RecordRoute: []*spb.RecordRoute{
				{Parameters: map[string]string{"a": "1", "b": "2"}, Address: &spb.Address{Uri: tcp("", "sip.local", 5060)}},
			},
			Route: []*spb.Route{
				{Address: &spb.Address{Uri: tcp("", "10.100.42.127", 5060)}},
				{Address: &spb.Address{Uri: tcp("", "10.100.42.128", 5060)}},
			},
			Authorization: &spb.Authorization{Realm: "sip.local", Scheme: "Digest", Nonce: "b8fe2321cf489ac475c80c6e5cfa1c22", Username: "1001", Uri: "sip:sip.local;transport=TCP"},
		},
	}
}

func processorRoute() *route {
	return &route{
		user:            "1001",
		host:            "127.0.0.1",
		port:            5060,
		advertisedHost:  "127.0.0.1",
		advertisedPort:  5060,
		transport:       "TCP",
		registeredOn:    1761255805000,
		sessionCount:    -1,
		expires:         600,
		edgePortRef:     "edgeport-01",
		listeningPoints: []*ppb.NetInterface{{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP}},
		localnets:       []string{"127.0.0.1/8"},
		externalAddrs:   []string{"47.132.130.31"},
		headers: []headerModifier{
			{name: headerGatewayAuth, value: "dXNlcm5hbWU6cGFzc3dvcmQ="},
			{name: "user-agent", remove: true},
		},
	}
}

func routeOnAnotherEdgePort() *route {
	r := processorRoute()
	r.advertisedHost = "127.0.0.0"
	r.edgePortRef = "edgeport-02"
	r.localnets = []string{"127.0.0.1/8", "10.100.42.128/24"}
	r.headers = nil
	return r
}

func TestFixRequestURI(t *testing.T) {
	dialed := "17853178070"
	tests := []struct {
		name     string
		route    func() *route
		wantUser string
	}{
		{"rewrites the user with the route user for a registered route", processorRoute, "1001"},
		{"keeps the user when the route has none (outbound trunk)", func() *route { r := processorRoute(); r.user = ""; return r }, dialed},
		{"keeps the user when the route is not registered", func() *route { r := processorRoute(); r.registeredOn = 0; return r }, dialed},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := processorRequest()
			req.Message.GetRequestUri().User = dialed
			r := tt.route()
			fixRequestURI(req, r)
			uri := req.GetMessage().GetRequestUri()
			if uri.GetHost() != r.host || uri.GetPort() != r.port || uri.GetTransportParam() != r.transport {
				t.Errorf("requestUri = %v", uri)
			}
			if uri.GetUser() != tt.wantUser {
				t.Errorf("user = %q, want %q", uri.GetUser(), tt.wantUser)
			}
		})
	}
}

func TestDecreaseMaxForwards(t *testing.T) {
	req := processorRequest()
	decreaseMaxForwards(req)
	if req.GetMessage().GetMaxForwards().GetMaxForwards() != 69 {
		t.Errorf("maxForwards = %d", req.GetMessage().GetMaxForwards().GetMaxForwards())
	}
	req.Message.MaxForwards = nil
	decreaseMaxForwards(req)
	if req.GetMessage().GetMaxForwards() != nil {
		t.Error("a missing Max-Forwards was created")
	}
}

func expectTopVia(t *testing.T, req *ppb.MessageRequest, host string, port int32, transport string) {
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
		req := processorRequest()
		if err := addSelfVia(req, processorRoute()); err != nil {
			t.Fatal(err)
		}
		expectTopVia(t, req, "127.0.0.1", 5060, "TCP")
	})
	t.Run("different edgeport", func(t *testing.T) {
		req := processorRequest()
		if err := addSelfVia(req, routeOnAnotherEdgePort()); err != nil {
			t.Fatal(err)
		}
		expectTopVia(t, req, "127.0.0.1", 5060, "TCP")
	})
	t.Run("no listening point for the route transport", func(t *testing.T) {
		req := processorRequest()
		r := processorRoute()
		r.transport = "TLS"
		var nlp *noListeningPointError
		if err := addSelfVia(req, r); !errors.As(err, &nlp) {
			t.Fatalf("error = %v", err)
		}
	})
}

func TestAddSelfViaUsingExternalAddrs(t *testing.T) {
	req := processorRequest()
	if err := addSelfViaUsingExternalAddrs(req, false); err != nil {
		t.Fatal(err)
	}
	// sip.local is in no localnet: the external address
	expectTopVia(t, req, "200.22.21.42", 5060, "TCP")

	local := processorRequest()
	local.Message.GetRequestUri().Host = "10.100.42.5"
	local.Message.GetRequestUri().TransportParam = "udp"
	if err := addSelfViaUsingExternalAddrs(local, false); err != nil {
		t.Fatal(err)
	}
	expectTopVia(t, local, "10.100.42.127", 5060, "UDP")

	noExternal := processorRequest()
	noExternal.ExternalAddrs = nil
	if err := addSelfViaUsingExternalAddrs(noExternal, false); err == nil {
		t.Error("expected an error without an interface toward sip.local")
	}
}

func TestRemoveTopVia(t *testing.T) {
	req := processorRequest()
	removeTopVia(req)
	if vias := req.GetMessage().GetVia(); len(vias) != 1 || vias[0].GetHost() != "127.0.0.1" {
		t.Errorf("via = %v", vias)
	}
	removeTopVia(req)
	removeTopVia(req)
	if len(req.GetMessage().GetVia()) != 0 {
		t.Error("removing past the last Via failed")
	}
}

func TestAddSelfRecordRoute(t *testing.T) {
	t.Run("uses the listening point from the request", func(t *testing.T) {
		req := processorRequest()
		if err := addSelfRecordRoute(req, processorRoute(), nil); err != nil {
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
		req := processorRequest()
		r := processorRoute()
		r.advertisedHost = "203.0.113.9"
		if err := addSelfRecordRoute(req, r, nil); err != nil {
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
			if e.GetParameters()["r2"] != "on" {
				t.Errorf("parameters = %v, want r2=on", e.GetParameters())
			}
		}
	})
	t.Run("writes the identity mapping in the URI user part", func(t *testing.T) {
		req := processorRequest()
		params := map[string]string{"rfo": "MTAwMUBzaXAubG9jYWw", "rfn": "KzE4Mjk1ODYzMzE0QHNpcC5wcm92aWRlci5uZXQ"}
		if err := addSelfRecordRoute(req, processorRoute(), params); err != nil {
			t.Fatal(err)
		}
		if u := req.GetMessage().GetRecordRoute()[0].GetAddress().GetUri().GetUser(); u != "rfo.MTAwMUBzaXAubG9jYWw.rfn.KzE4Mjk1ODYzMzE0QHNpcC5wcm92aWRlci5uZXQ" {
			t.Errorf("user = %q", u)
		}
	})
	t.Run("no listening point for the sender transport", func(t *testing.T) {
		req := processorRequest()
		req.Sender.Transport = common.Transport_TLS
		if err := addSelfRecordRoute(req, processorRoute(), nil); err == nil {
			t.Error("expected an error")
		}
	})
}

// TestRecordRouteForAPhoneOutsideTheCluster is a phone behind a home router at
// 192.168.1.10 calling through an EdgePort pod at 192.168.112.69 on Calico's
// default pool (192.168.0.0/16). With the chart's default values the EdgePort's
// localnet is the pod's own /32, read from its interface, and the phone gets
// externalAddrs in its Record-Route. With edgeport.podCIDR set to the pool, the
// localnet is ${POD_IP}/16, the phone looks local and gets the pod IP, which it
// can't reach: why podCIDR is off by default.
func TestRecordRouteForAPhoneOutsideTheCluster(t *testing.T) {
	const pod, external = "192.168.112.69", "203.0.113.10"
	hosts := func(t *testing.T, localnets []string) []string {
		t.Helper()
		req := processorRequest()
		req.Localnets = localnets
		req.ExternalAddrs = []string{external}
		req.Sender = &ppb.NetInterface{Host: "192.168.1.10", Port: 5060, Transport: common.Transport_UDP}
		r := processorRoute()
		r.advertisedHost, r.transport = "198.51.100.20", "UDP"
		before := len(req.GetMessage().GetRecordRoute())
		if err := addSelfRecordRoute(req, r, nil); err != nil {
			t.Fatal(err)
		}
		// Ours go on top of any the request carried
		var got []string
		added := len(req.GetMessage().GetRecordRoute()) - before
		for _, rr := range req.GetMessage().GetRecordRoute()[:added] {
			got = append(got, rr.GetAddress().GetUri().GetHost())
		}
		return got
	}
	if got := hosts(t, []string{pod + "/32"}); !reflect.DeepEqual(got, []string{external}) {
		t.Errorf("chart defaults: Record-Route = %v, want the external address only", got)
	}
	if got := hosts(t, []string{pod + "/16"}); !reflect.DeepEqual(got, []string{external, pod}) {
		t.Errorf("podCIDR 192.168.0.0/16: Record-Route = %v, want the pod IP facing the phone", got)
	}
}

func TestIdentityUser(t *testing.T) {
	if got := identityUser(nil); got != "" {
		t.Errorf("identityUser(nil) = %q", got)
	}
	got := identityUser(map[string]string{"rcn": "d", "rfo": "a", "rco": "c", "rfn": "b", "x": "ignored"})
	if got != "rfo.a.rfn.b.rco.c.rcn.d" {
		t.Errorf("identityUser() = %q", got)
	}
}

func TestAddRouteToNextHop(t *testing.T) {
	req := processorRequest()
	addRouteToNextHop(req, processorRoute())
	routes := req.GetMessage().GetRoute()
	if len(routes) != 3 {
		t.Fatalf("route = %d entries, want 3", len(routes))
	}
	u := routes[0].GetAddress().GetUri()
	if u.GetHost() != "127.0.0.1" || u.GetPort() != 5060 || u.GetTransportParam() != "TCP" || !u.GetLrParam() {
		t.Errorf("route[0] = %v", u)
	}

	same := processorRequest()
	same.Message.GetRequestUri().Host = "127.0.0.1"
	addRouteToNextHop(same, processorRoute())
	if len(same.GetMessage().GetRoute()) != 2 {
		t.Error("a Route was added although the Request-URI names the host")
	}
}

func TestAddRouteToPeerEdgePort(t *testing.T) {
	req := processorRequest()
	if err := addRouteToPeerEdgePort(req, processorRoute()); err != nil {
		t.Fatal(err)
	}
	routes := req.GetMessage().GetRoute()
	if len(routes) != 3 {
		t.Fatalf("route = %d entries, want 3", len(routes))
	}
	u := routes[0].GetAddress().GetUri()
	if u.GetHost() != "127.0.0.1" || u.GetPort() != 5060 || u.GetTransportParam() != "TCP" {
		t.Errorf("route[0] = %v", u)
	}
	r := processorRoute()
	r.transport = "WSS"
	if err := addRouteToPeerEdgePort(processorRequest(), r); err == nil {
		t.Error("expected an error for a transport without a listening point")
	}
}

func TestRemoveSelfRoutes(t *testing.T) {
	req := processorRequest()
	removeSelfRoutes(req)
	routes := req.GetMessage().GetRoute()
	if len(routes) != 1 || routes[0].GetAddress().GetUri().GetHost() != "10.100.42.128" {
		t.Errorf("route = %v", hops(routes))
	}

	t.Run("by external address and alias, on the listening port only", func(t *testing.T) {
		req := processorRequest()
		req.Aliases = []string{"SIP.Example.COM"}
		req.Message.Route = []*spb.Route{
			{Address: &spb.Address{Uri: &spb.SipURI{Host: "200.22.21.42", Port: 5060, TransportParam: "TCP"}}},
			{Address: &spb.Address{Uri: &spb.SipURI{Host: "sip.example.com", Port: 5060, TransportParam: "UDP"}}},
			{Address: &spb.Address{Uri: &spb.SipURI{Host: "200.22.21.42", Port: 5061, TransportParam: "TCP"}}},
		}
		removeSelfRoutes(req)
		if got := hops(req.GetMessage().GetRoute()); !reflect.DeepEqual(got, []string{"200.22.21.42:5061"}) {
			t.Errorf("route = %v", got)
		}
	})
	t.Run("a Route on a transport without a listening point is not ours", func(t *testing.T) {
		req := processorRequest()
		req.Message.Route[0].GetAddress().GetUri().TransportParam = "TLS"
		if isSelfRoute(req, req.Message.Route[0]) {
			t.Error("a Route this EdgePort cannot serve is not its own")
		}
		removeSelfRoutes(req)
		routes := req.GetMessage().GetRoute()
		if len(routes) != 2 || routes[0].GetAddress().GetUri().GetTransportParam() != "TLS" {
			t.Errorf("route = %v, want the TLS Route kept for the next hop", hops(routes))
		}
	})
}

func TestApplyXHeaders(t *testing.T) {
	req := processorRequest()
	applyXHeaders(req, processorRoute().headers)
	if getHeaderValue(req, headerGatewayAuth) != "dXNlcm5hbWU6cGFzc3dvcmQ=" {
		t.Error("X-Gateway-Auth was not added")
	}
	if getHeaderValue(req, "user-agent") != "" {
		t.Error("User-Agent was not removed")
	}
	if last := req.GetMessage().GetExtensions()[len(req.GetMessage().GetExtensions())-1]; last.GetName() != headerGatewayAuth {
		t.Errorf("the added header is not last: %v", last)
	}

	t.Run("replaces a caller-supplied copy of an added header", func(t *testing.T) {
		req := processorRequest()
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "x-room-id", Value: "spoofed"})
		applyXHeaders(req, []headerModifier{{name: "X-Room-Id", value: "jsa-shqm-iyo"}})
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
	t.Run("keeps every copy Routr itself adds under the same name", func(t *testing.T) {
		req := processorRequest()
		applyXHeaders(req, []headerModifier{{name: "X-Tag", value: "a"}, {name: "X-Tag", value: "b"}})
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
	t.Run("no headers is a no-op", func(t *testing.T) {
		req := processorRequest()
		before := len(req.GetMessage().GetExtensions())
		applyXHeaders(req, nil)
		if len(req.GetMessage().GetExtensions()) != before {
			t.Error("extensions changed")
		}
	})
}

func TestXEdgePortRef(t *testing.T) {
	req := processorRequest()
	addXEdgePortRef(req)
	if getHeaderValue(req, headerEdgePortRef) != "edgeport-01" {
		t.Fatal("X-Edgeport-Ref was not added")
	}
	if req.GetMessage().GetExtensions()[0].GetName() != headerEdgePortRef {
		t.Error("X-Edgeport-Ref is not first")
	}
	removeXEdgePortRef(req)
	if getHeaderValue(req, headerEdgePortRef) != "" {
		t.Error("X-Edgeport-Ref was not removed")
	}
	if getHeaderValue(req, "CSeq") == "" {
		t.Error("CSeq was removed")
	}

	lower := processorRequest()
	lower.Message.Extensions = append(lower.Message.Extensions, &spb.Extension{Name: "x-edgeport-ref", Value: "edgeport-01"})
	removeXEdgePortRef(lower)
	if getHeaderValue(lower, headerEdgePortRef) != "" {
		t.Error("a lower-case X-Edgeport-Ref survived")
	}
}

func TestRemoveHeaders(t *testing.T) {
	req := processorRequest()
	req.Message.Extensions = append(req.Message.Extensions,
		&spb.Extension{Name: "x-app-ref", Value: "app-01"},
		&spb.Extension{Name: "X-ACCESS-KEY-ID", Value: "WO00000000"})
	removeHeaders(req, []string{"X-App-Ref", "X-Access-Key-Id"})
	if getHeaderValue(req, "X-App-Ref") != "" || getHeaderValue(req, "X-Access-Key-Id") != "" {
		t.Error("headers survived")
	}
	if getHeaderValue(req, "CSeq") == "" {
		t.Error("CSeq was removed")
	}
	before := len(req.GetMessage().GetExtensions())
	removeHeaders(req, nil)
	if len(req.GetMessage().GetExtensions()) != before {
		t.Error("an empty list changed the extensions")
	}
}

func TestRemoveAuthorization(t *testing.T) {
	req := processorRequest()
	removeAuthorization(req)
	if req.GetMessage().GetAuthorization() != nil {
		t.Error("Authorization survived")
	}
}

func TestFixInvalidContact(t *testing.T) {
	req := processorRequest()
	req.Message.Contact.GetAddress().GetUri().Host = "abc.invalid"
	req.Message.Via[0].Received = "203.0.113.7"
	req.Message.Via[0].RPort = 40000
	req.Message.Via[0].Transport = "wss"
	fixInvalidContact(req)
	u := req.GetMessage().GetContact().GetAddress().GetUri()
	if u.GetHost() != "203.0.113.7" || u.GetPort() != 40000 || u.GetTransportParam() != "WSS" {
		t.Errorf("contact = %v", u)
	}

	noReceived := processorRequest()
	noReceived.Message.Contact.GetAddress().GetUri().Host = "abc.invalid"
	fixInvalidContact(noReceived)
	u = noReceived.GetMessage().GetContact().GetAddress().GetUri()
	if u.GetHost() != "proxy" || u.GetPort() != 5060 {
		t.Errorf("contact without received = %v", u)
	}

	valid := processorRequest()
	fixInvalidContact(valid)
	if valid.GetMessage().GetContact().GetAddress().GetUri().GetHost() != "127.0.0.1" {
		t.Error("a valid Contact was changed")
	}
	fixInvalidContact(&ppb.MessageRequest{Message: &spb.SIPMessage{}})
}
