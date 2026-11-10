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
	"fmt"
	"reflect"
	"testing"
	"time"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/location"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The cases of internal/connect/crossed_dialog_test.go, on the SDK's
// cross-EdgePort functions: two EdgePorts behind one load balancer, each with
// its pod IP and the pod range as its localnet, the caller's TCP connection
// on B and the callee's UDP binding on A.

const (
	peerLB     = "200.22.21.42"
	peerA      = "10.244.1.11"
	peerB      = "10.244.2.12"
	peerCaller = "198.51.100.10"
	peerCallee = "198.51.100.20"
)

func peerListeningPoints() []*NetInterface {
	return []*NetInterface{
		{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP},
		{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_UDP},
	}
}

// onPeer makes the request one the EdgePort at ip received from sender.
func onPeer(req *MessageRequest, ref, ip string, sender *NetInterface) {
	req.EdgePortRef = ref
	req.Localnets = []string{ip + "/16"}
	req.ExternalAddrs = []string{peerLB}
	req.ListeningPoints = peerListeningPoints()
	req.Sender = sender
}

// calleeOnPeerA is the callee's binding, registered on EdgePort A over UDP.
func calleeOnPeerA() *location.Route {
	return &location.Route{
		User: "1002", Host: peerCallee, Port: "40000", AdvertisedHost: peerCallee, AdvertisedPort: "40000",
		Transport: common.Transport_UDP, SessionCount: -1, RegisteredOn: 1761255805000, EdgePortRef: "edgeport-a",
		ListeningPoints: peerListeningPoints(), Localnets: []string{peerA + "/16"}, ExternalAddrs: []string{peerLB},
	}
}

func peerInvite() *MessageRequest {
	req := &MessageRequest{
		Ref:    "crossed-call",
		Method: Method_INVITE,
		Message: &sipmessage.SIPMessage{
			MessageType: &sipmessage.SIPMessage_RequestUri{RequestUri: &sipmessage.SipURI{User: "1002", Host: "sip.local", TransportParam: "TCP"}},
			Via:         []*sipmessage.Via{{Host: peerCaller, Port: 50000, Transport: "TCP", RPort: -1}},
			From:        &sipmessage.From{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{User: "1001", Host: "sip.local"}}, Tag: "caller-tag"},
			To:          &sipmessage.To{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{User: "1002", Host: "sip.local"}}},
			MaxForwards: &sipmessage.MaxForwards{MaxForwards: 70},
		},
	}
	onPeer(req, "edgeport-b", peerB, &NetInterface{Host: peerCaller, Port: 50000, Transport: common.Transport_TCP})
	return req
}

func peerHops(routes []*sipmessage.Route) []string {
	var out []string
	for _, r := range routes {
		u := r.GetAddress().GetUri()
		out = append(out, fmt.Sprintf("%s:%d;%s", u.GetHost(), u.GetPort(), u.GetTransportParam()))
	}
	return out
}

// expectPeerVia checks the Via an alteration added on top of peerInvite's one.
func expectPeerVia(t *testing.T, req *MessageRequest, host string, port int32, transport string) {
	t.Helper()
	vias := req.GetMessage().GetVia()
	if len(vias) != 2 {
		t.Fatalf("via = %d entries, want 2", len(vias))
	}
	v := vias[0]
	if v.GetHost() != host || v.GetPort() != port || v.GetTransport() != transport || !v.GetRPortFlag() {
		t.Errorf("via = %v, want %s:%d %s with rport", v, host, port, transport)
	}
}

func peerRecordRouteHops(rr []*sipmessage.RecordRoute) []string {
	var out []string
	for _, r := range rr {
		u := r.GetAddress().GetUri()
		out = append(out, fmt.Sprintf("%s:%d;%s", u.GetHost(), u.GetPort(), u.GetTransportParam()))
	}
	return out
}

func TestSourceAddress(t *testing.T) {
	req := &MessageRequest{Message: &sipmessage.SIPMessage{Via: []*sipmessage.Via{{Host: peerLB, Received: peerB}}}}
	if got := SourceAddress(req); got != peerB {
		t.Errorf("SourceAddress() = %q, want received", got)
	}
	req.Message.Via[0].Received = ""
	if got := SourceAddress(req); got != peerLB {
		t.Errorf("SourceAddress() = %q, want the Via host", got)
	}
	if got := SourceAddress(&MessageRequest{Message: &sipmessage.SIPMessage{}}); got != "" {
		t.Errorf("SourceAddress() = %q without a Via", got)
	}
}

func TestCreateRouteFromPeer(t *testing.T) {
	req := peerInvite()
	req.Message.GetRequestUri().Host = peerCallee
	req.Message.GetRequestUri().Port = 40000
	req.Message.GetRequestUri().TransportParam = ""
	req.Message.Via[0].Host = peerLB
	req.Sender = &NetInterface{Host: peerLB, Port: 5060, Transport: common.Transport_TCP}
	now := func() time.Time { return time.UnixMilli(1761255805000) }
	route := createRouteFromPeer(req, DefaultExpires, now)
	want := &location.Route{
		EdgePortRef: "edgeport-b", User: "1002", Host: peerCallee, Port: "40000", AdvertisedHost: peerLB, AdvertisedPort: "50000",
		Transport: common.Transport_TCP, RegisteredOn: 1761255805000, SessionCount: -1, Expires: DefaultExpires,
		ListeningPoints: req.GetListeningPoints(), Localnets: req.GetLocalnets(), ExternalAddrs: req.GetExternalAddrs(),
	}
	if !proto.Equal(route, want) {
		t.Errorf("route = %v, want %v", route, want)
	}
	// A transport on the Request-URI wins
	req.Message.GetRequestUri().TransportParam = "UDP"
	if got := CreateRouteFromPeer(req, DefaultExpires).GetTransport(); got != common.Transport_UDP {
		t.Errorf("transport = %v, want the Request-URI's", got)
	}
}

func TestAddRouteToPeerEdgePortOwnAddress(t *testing.T) {
	t.Run("the peer's own address on a shared localnet", func(t *testing.T) {
		req := peerInvite()
		if err := AddRouteToPeerEdgePortOwnAddress(req, calleeOnPeerA()); err != nil {
			t.Fatal(err)
		}
		if got := peerHops(req.GetMessage().GetRoute()); !reflect.DeepEqual(got, []string{peerA + ":5060;UDP"}) {
			t.Errorf("route = %v", got)
		}
		if !req.GetMessage().GetRoute()[0].GetAddress().GetUri().GetLrParam() {
			t.Error("the Route is not loose")
		}
	})
	t.Run("the peer's interface facing the endpoint without a shared localnet", func(t *testing.T) {
		for name, localnets := range map[string][]string{
			"another network": {"192.168.7.7/24"},
			"loopback only":   {"127.0.0.1/8"},
			"a network form":  {"10.244.0.0/16"},
		} {
			req := peerInvite()
			r := calleeOnPeerA()
			r.Localnets = localnets
			if err := AddRouteToPeerEdgePortOwnAddress(req, r); err != nil {
				t.Fatalf("%s: %v", name, err)
			}
			old := peerInvite()
			if err := AddRouteToPeerEdgePort(old, r); err != nil {
				t.Fatalf("%s: %v", name, err)
			}
			want := peerHops(old.GetMessage().GetRoute())
			if got := peerHops(req.GetMessage().GetRoute()); !reflect.DeepEqual(got, want) || got[0] != peerLB+":5060;UDP" {
				t.Errorf("%s: route = %v, want %v", name, got, want)
			}
		}
	})
	t.Run("a transport the peer doesn't listen on", func(t *testing.T) {
		req := peerInvite()
		r := calleeOnPeerA()
		r.Transport = common.Transport_TLS
		if err := AddRouteToPeerEdgePortOwnAddress(req, r); err == nil {
			t.Error("expected an error")
		}
		if len(req.GetMessage().GetRoute()) != 0 {
			t.Error("a failed alteration changed the request")
		}
	})
}

func TestAddSelfViaTowardNextHop(t *testing.T) {
	inDialog := func(listening []*NetInterface) *MessageRequest {
		req := peerInvite()
		req.Method = Method_BYE
		req.Message.GetRequestUri().Host = peerCallee
		req.Message.GetRequestUri().TransportParam = ""
		req.ListeningPoints = listening
		return req
	}
	t.Run("a request from a peer goes on the sender's transport", func(t *testing.T) {
		req := inDialog(peerListeningPoints())
		if err := AddSelfViaTowardNextHop(req, true); err != nil {
			t.Fatal(err)
		}
		expectPeerVia(t, req, peerLB, 5060, "TCP")
	})
	t.Run("not from a peer, UDP as before", func(t *testing.T) {
		req := inDialog(peerListeningPoints())
		if err := AddSelfViaTowardNextHop(req, false); err != nil {
			t.Fatal(err)
		}
		expectPeerVia(t, req, peerLB, 5060, "UDP")
		old := inDialog(peerListeningPoints())
		if err := AddSelfViaUsingExternalAddrs(old); err != nil {
			t.Fatal(err)
		}
		if !proto.Equal(req, old) {
			t.Error("the result differs from AddSelfViaUsingExternalAddrs'")
		}
	})
	t.Run("an EdgePort without UDP goes on the sender's transport", func(t *testing.T) {
		tcpOnly := []*NetInterface{{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP}}
		req := inDialog(tcpOnly)
		if err := AddSelfViaTowardNextHop(req, false); err != nil {
			t.Fatal(err)
		}
		expectPeerVia(t, req, peerLB, 5060, "TCP")
		if err := AddSelfViaUsingExternalAddrs(inDialog(tcpOnly)); err == nil {
			t.Error("AddSelfViaUsingExternalAddrs changed: it errs here in v0.1.0")
		}
	})
	t.Run("faces a peer's own address on top of the route set", func(t *testing.T) {
		req := inDialog(peerListeningPoints())
		req.Message.Route = []*sipmessage.Route{{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{Host: peerA, Port: 5060, TransportParam: "UDP", LrParam: true}}}}
		if err := AddSelfViaTowardNextHop(req, false); err != nil {
			t.Fatal(err)
		}
		expectPeerVia(t, req, peerB, 5060, "UDP")
	})
	t.Run("a Route on another port is not a peer", func(t *testing.T) {
		req := inDialog(peerListeningPoints())
		req.Message.Route = []*sipmessage.Route{{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{Host: peerA, Port: 5070, TransportParam: "UDP", LrParam: true}}}}
		if err := AddSelfViaTowardNextHop(req, false); err != nil {
			t.Fatal(err)
		}
		expectPeerVia(t, req, peerLB, 5060, "UDP")
	})
	t.Run("no interface toward the Request-URI", func(t *testing.T) {
		req := inDialog(peerListeningPoints())
		req.ExternalAddrs = nil
		if err := AddSelfViaTowardNextHop(req, true); err == nil {
			t.Error("expected an error")
		}
		if len(req.GetMessage().GetVia()) != 1 {
			t.Error("a failed alteration changed the request")
		}
	})
}

func TestAddSelfRecordRouteFromPeer(t *testing.T) {
	// At A: the peer's Via names its interface facing the callee (the load
	// balancer); the request came from B's own address
	atA := func() *MessageRequest {
		req := peerInvite()
		onPeer(req, "edgeport-a", peerA, &NetInterface{Host: peerLB, Port: 5060, Transport: common.Transport_UDP})
		return req
	}
	route := calleeOnPeerA()
	route.AdvertisedHost = peerLB
	t.Run("the origin faces the peer", func(t *testing.T) {
		req := atA()
		if err := AddSelfRecordRouteFromPeer(req, route, nil, peerB); err != nil {
			t.Fatal(err)
		}
		want := []string{peerLB + ":5060;UDP", peerA + ":5060;UDP"}
		if got := peerRecordRouteHops(req.GetMessage().GetRecordRoute()); !reflect.DeepEqual(got, want) {
			t.Errorf("record-route = %v, want %v", got, want)
		}
	})
	t.Run("no peerSource is AddSelfRecordRoute", func(t *testing.T) {
		params := map[string]string{"rfo": "MTAwMUBzaXAubG9jYWw", "rfn": "KzE4Mjk1ODYzMzE0QHNpcC5wcm92aWRlci5uZXQ"}
		for _, r := range []*location.Route{route, calleeOnPeerA(), exampleRoute()} {
			req, old := atA(), atA()
			if err := AddSelfRecordRouteFromPeer(req, r, params, ""); err != nil {
				t.Fatal(err)
			}
			if err := AddSelfRecordRoute(old, r, params); err != nil {
				t.Fatal(err)
			}
			if !proto.Equal(req, old) {
				t.Errorf("record-route = %v, want %v", peerRecordRouteHops(req.GetMessage().GetRecordRoute()), peerRecordRouteHops(old.GetMessage().GetRecordRoute()))
			}
		}
	})
	t.Run("no listening point for the sender transport", func(t *testing.T) {
		req := atA()
		req.Sender.Transport = common.Transport_TLS
		if err := AddSelfRecordRouteFromPeer(req, route, nil, peerB); err == nil {
			t.Error("expected an error")
		}
	})
}

func TestAddSelfRecordRouteToPeer(t *testing.T) {
	t.Run("the target is this EdgePort's own address facing the peer", func(t *testing.T) {
		req := peerInvite()
		if err := AddSelfRecordRouteToPeer(req, calleeOnPeerA(), nil); err != nil {
			t.Fatal(err)
		}
		want := []string{peerB + ":5060;UDP", peerLB + ":5060;TCP"}
		if got := peerRecordRouteHops(req.GetMessage().GetRecordRoute()); !reflect.DeepEqual(got, want) {
			t.Errorf("record-route = %v, want %v", got, want)
		}
		for _, e := range req.GetMessage().GetRecordRoute() {
			if e.GetParameters()["r2"] != "on" {
				t.Errorf("parameters = %v, want r2=on", e.GetParameters())
			}
		}
	})
	t.Run("without a peer on a shared localnet it is AddSelfRecordRoute", func(t *testing.T) {
		r := calleeOnPeerA()
		r.Localnets = []string{"192.168.7.7/24"}
		r.AdvertisedHost = "10.244.42.9"
		req, old := peerInvite(), peerInvite()
		if err := AddSelfRecordRouteToPeer(req, r, nil); err != nil {
			t.Fatal(err)
		}
		if err := AddSelfRecordRoute(old, r, nil); err != nil {
			t.Fatal(err)
		}
		if !proto.Equal(req, old) {
			t.Errorf("record-route = %v, want %v", peerRecordRouteHops(req.GetMessage().GetRecordRoute()), peerRecordRouteHops(old.GetMessage().GetRecordRoute()))
		}
	})
	t.Run("loopback shares nothing", func(t *testing.T) {
		req := peerInvite()
		req.Localnets = []string{"127.0.0.1/8"}
		r := calleeOnPeerA()
		r.Localnets = []string{"127.0.0.1/8"}
		if _, ok := peerFacingInterface(req, r); ok {
			t.Error("a loopback localnet faced the peer")
		}
		if _, ok := peerOwnAddress(req, r); ok {
			t.Error("a loopback localnet named the peer")
		}
	})
}

func TestRemoveRoutesUpToOwn(t *testing.T) {
	route := func(host string) *sipmessage.Route {
		return &sipmessage.Route{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{Host: host, Port: 5060, TransportParam: "UDP", LrParam: true}}}
	}
	req := &MessageRequest{Localnets: []string{peerA + "/16"}, ExternalAddrs: []string{peerLB}, ListeningPoints: peerListeningPoints()}
	t.Run("drops everything up to the last entry with this EdgePort's own address", func(t *testing.T) {
		req.Message = &sipmessage.SIPMessage{Route: []*sipmessage.Route{route(peerLB), route(peerB), route(peerA), route(peerLB), route("203.0.113.9")}}
		RemoveRoutesUpToOwn(req)
		if got := peerHops(req.GetMessage().GetRoute()); !reflect.DeepEqual(got, []string{peerLB + ":5060;UDP", "203.0.113.9:5060;UDP"}) {
			t.Errorf("route = %v", got)
		}
	})
	t.Run("leaves a route set without one alone", func(t *testing.T) {
		req.Message = &sipmessage.SIPMessage{Route: []*sipmessage.Route{route(peerLB), route(peerB)}}
		RemoveRoutesUpToOwn(req)
		if got := peerHops(req.GetMessage().GetRoute()); len(got) != 2 {
			t.Errorf("route = %v", got)
		}
	})
	t.Run("doesn't take a network-form localnet for this EdgePort's address", func(t *testing.T) {
		netReq := &MessageRequest{Localnets: []string{"10.244.0.0/16"}, ListeningPoints: peerListeningPoints()}
		netReq.Message = &sipmessage.SIPMessage{Route: []*sipmessage.Route{route("10.244.0.0"), route(peerB)}}
		RemoveRoutesUpToOwn(netReq)
		if got := peerHops(netReq.GetMessage().GetRoute()); len(got) != 2 {
			t.Errorf("route = %v", got)
		}
	})
}

// isTrustedPeer is the processor's own trust check: the pod range.
func isTrustedPeer(req *MessageRequest) bool {
	return hasIP("10.244.0.0/16", SourceAddress(req))
}

// toPeer is Connect's toPeerEdgePort on the SDK.
func toPeer(t *testing.T, req *MessageRequest, route *location.Route) {
	t.Helper()
	RemoveSelfRoutes(req)
	FixRequestURI(req, route)
	if err := AddSelfVia(req, route); err != nil {
		t.Fatal(err)
	}
	if err := AddSelfRecordRouteToPeer(req, route, nil); err != nil {
		t.Fatal(err)
	}
	AddRouteToNextHop(req, route)
	if err := AddRouteToPeerEdgePortOwnAddress(req, route); err != nil {
		t.Fatal(err)
	}
	AddXEdgePortRef(req)
	DecreaseMaxForwards(req)
}

// fromPeer is Connect's handling of a request from a trusted peer: the route
// from the message, then the tailor with the peer's source.
func fromPeer(t *testing.T, req *MessageRequest) {
	t.Helper()
	if !isTrustedPeer(req) {
		t.Fatalf("source %s is not a trusted peer", SourceAddress(req))
	}
	// Before AddSelfVia, whose Via becomes the top one
	source := SourceAddress(req)
	route := CreateRouteFromPeer(req, DefaultExpires)
	DecreaseMaxForwards(req)
	RemoveAuthorization(req)
	RemoveSelfRoutes(req)
	RemoveXEdgePortRef(req)
	FixInvalidContact(req)
	FixRequestURI(req, route)
	if err := AddSelfVia(req, route); err != nil {
		t.Fatal(err)
	}
	if err := AddSelfRecordRouteFromPeer(req, route, nil, source); err != nil {
		t.Fatal(err)
	}
	AddRouteToNextHop(req, route)
}

// inDialog is Connect's forwardInDialog on the SDK.
func inDialog(t *testing.T, req *MessageRequest) {
	t.Helper()
	DecreaseMaxForwards(req)
	RemoveRoutesUpToOwn(req)
	RemoveSelfRoutes(req)
	if err := AddSelfViaTowardNextHop(req, isTrustedPeer(req)); err != nil {
		t.Fatal(err)
	}
}

// The headers internal/connect's TestCrossedDialogRecordRoute and
// TestCrossedDialogInDialogRequests expect, from a processor on the SDK.
func TestCrossedDialogOnTheSDK(t *testing.T) {
	invite := peerInvite()
	toPeer(t, invite, calleeOnPeerA())
	if got := peerHops(invite.GetMessage().GetRoute()); !reflect.DeepEqual(got, []string{peerA + ":5060;UDP"}) {
		t.Fatalf("B: route = %v, want A's own address", got)
	}

	atA := &MessageRequest{Ref: invite.GetRef(), Method: Method_INVITE, Message: proto.Clone(invite.GetMessage()).(*sipmessage.SIPMessage)}
	// The EdgePort sends the Request-URI with no parameters
	atA.Message.GetRequestUri().TransportParam = ""
	via := atA.Message.Via[0]
	onPeer(atA, "edgeport-a", peerA, &NetInterface{Host: via.GetHost(), Port: via.GetPort(), Transport: common.Transport_UDP})
	via.Received = peerB
	fromPeer(t, atA)
	msg := atA.GetMessage()
	if uri := msg.GetRequestUri(); len(msg.GetRoute()) != 0 || uri.GetHost() != peerCallee || uri.GetTransportParam() != "UDP" {
		t.Fatalf("A: route = %v, requestUri = %v, want the callee's binding", msg.GetRoute(), uri)
	}
	want := []string{peerLB + ":5060;UDP", peerA + ":5060;UDP", peerB + ":5060;UDP", peerLB + ":5060;TCP"}
	rr := msg.GetRecordRoute()
	if got := peerRecordRouteHops(rr); !reflect.DeepEqual(got, want) {
		t.Fatalf("record-route = %v, want %v", got, want)
	}

	caller := &sipmessage.SipURI{User: "1001", Host: peerCaller, Port: 50000, TransportParam: "TCP"}
	callee := &sipmessage.SipURI{User: "1002", Host: peerCallee, Port: 40000, TransportParam: "UDP"}
	edgePorts := map[string]string{"edgeport-a": peerA, "edgeport-b": peerB}
	for _, tc := range []struct {
		name   string
		uac    bool
		target *sipmessage.SipURI
		holder string
	}{
		{"caller to callee", true, callee, "edgeport-a"},
		{"callee to caller", false, caller, "edgeport-b"},
	} {
		for ref, ip := range edgePorts {
			t.Run(tc.name+" landing on "+ref, func(t *testing.T) {
				routes := make([]*sipmessage.Route, 0, len(rr))
				for _, e := range rr {
					routes = append(routes, &sipmessage.Route{Address: &sipmessage.Address{Uri: proto.Clone(e.GetAddress().GetUri()).(*sipmessage.SipURI)}})
				}
				if tc.uac {
					for i, j := 0, len(routes)-1; i < j; i, j = i+1, j-1 {
						routes[i], routes[j] = routes[j], routes[i]
					}
				}
				bye := &MessageRequest{Ref: "bye", Method: Method_BYE, Message: &sipmessage.SIPMessage{
					MessageType: &sipmessage.SIPMessage_RequestUri{RequestUri: proto.Clone(tc.target).(*sipmessage.SipURI)},
					Via:         []*sipmessage.Via{{Host: "10.244.0.1", Port: 33000, Transport: "TCP", RPort: -1}},
					Route:       routes,
					MaxForwards: &sipmessage.MaxForwards{MaxForwards: 70},
				}}
				onPeer(bye, ref, ip, &NetInterface{Host: "198.51.100.99", Port: 33000, Transport: common.Transport_TCP})
				bye.Message.Via[0].Host = "198.51.100.99"
				inDialog(t, bye)
				out := bye.GetMessage()
				if ref == tc.holder {
					if len(out.GetRoute()) != 0 || out.GetVia()[0].GetHost() != peerLB {
						t.Errorf("route = %v, via = %v, want none and the external address", peerHops(out.GetRoute()), out.GetVia()[0])
					}
					return
				}
				holderIP := edgePorts[tc.holder]
				if got := peerHops(out.GetRoute()); !reflect.DeepEqual(got, []string{holderIP + ":5060;UDP"}) {
					t.Fatalf("route = %v, want the peer that holds the connection only", got)
				}
				if v := out.GetVia()[0]; v.GetHost() != ip || v.GetTransport() != "UDP" {
					t.Errorf("via = %v, want this EdgePort's own address, toward the peer", v)
				}

				// The holder receives it from the peer and sends it on
				next := &MessageRequest{Ref: bye.GetRef(), Method: Method_BYE, Message: proto.Clone(out).(*sipmessage.SIPMessage)}
				onPeer(next, tc.holder, holderIP, &NetInterface{Host: ip, Port: 5060, Transport: common.Transport_UDP})
				inDialog(t, next)
				if m := next.GetMessage(); len(m.GetRoute()) != 0 || m.GetRequestUri().GetHost() != tc.target.GetHost() {
					t.Errorf("holder: route = %v, want the BYE sent to the Request-URI", peerHops(m.GetRoute()))
				}
			})
		}
	}
}
