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
	"fmt"
	"reflect"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/common"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// A dialog that crosses EdgePorts: two EdgePorts behind one load balancer
// (200.22.21.42), each with its pod IP and the cluster's pod range as its
// localnet, the caller's TCP connection on B and the callee's UDP binding on A.

const (
	loadBalancer = "200.22.21.42"
	edgePortA    = "10.244.1.11"
	edgePortB    = "10.244.2.12"
	callerHost   = "198.51.100.10"
	calleeHost   = "198.51.100.20"
)

func listeningPoints() []*ppb.NetInterface {
	return []*ppb.NetInterface{
		{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP},
		{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_UDP},
	}
}

// onEdgePort makes the request one that EdgePort received from sender.
func onEdgePort(req *ppb.MessageRequest, ref, ip string, sender *ppb.NetInterface) {
	req.EdgePortRef = ref
	req.Localnets = []string{ip + "/16"}
	req.ExternalAddrs = []string{loadBalancer}
	req.ListeningPoints = listeningPoints()
	req.Sender = sender
}

func crossedConfig() *testSettings {
	cfg := testConfig()
	cfg.Spec.TrustedEdgePortAddresses = []string{"10.244.0.0/16"}
	return cfg
}

// calleeOnA is the callee's binding, registered on EdgePort A over UDP.
func calleeOnA() *lpb.Route {
	return &lpb.Route{
		User:            "1002",
		Host:            calleeHost,
		Port:            "40000",
		AdvertisedHost:  calleeHost,
		AdvertisedPort:  "40000",
		Transport:       common.Transport_UDP,
		SessionCount:    -1,
		RegisteredOn:    1761255805000,
		EdgePortRef:     "edgeport-a",
		ListeningPoints: listeningPoints(),
		Localnets:       []string{edgePortA + "/16"},
		ExternalAddrs:   []string{loadBalancer},
	}
}

// crossedInvite runs the caller's INVITE through B, then the request B
// forwards through A, and returns the INVITE as it leaves A.
func crossedInvite(t *testing.T) *spb.SIPMessage {
	t.Helper()
	cfg := crossedConfig()
	envB := newTestEnv(t, cfg)
	envB.location.routes["sip:1002@sip.local"] = []*lpb.Route{calleeOnA()}
	invite := agentInvite(envB.now)
	invite.Message.Route = nil
	invite.Message.RecordRoute = nil
	onEdgePort(invite, "edgeport-b", edgePortB, &ppb.NetInterface{Host: callerHost, Port: 50000, Transport: common.Transport_TCP})
	res := envB.process(t, invite)
	if responseTypeOf(res) != "" || extensionValue(res.GetMessage(), headerEdgePortRef) != "edgeport-b" {
		t.Fatalf("B: response = %v, want the INVITE forwarded to A", res)
	}

	envA := newTestEnv(t, cfg)
	atA := &ppb.MessageRequest{Ref: invite.GetRef(), Method: ppb.Method_INVITE, Message: proto.Clone(res.GetMessage()).(*spb.SIPMessage)}
	// The EdgePort sends the Request-URI with no parameters (RequestURIFromDTO)
	atA.Message.GetRequestUri().TransportParam = ""
	// The EdgePort's Sender is the top Via's sent-by, B's interface facing the
	// callee; where the request came from is in received
	via := atA.Message.Via[0]
	onEdgePort(atA, "edgeport-a", edgePortA, &ppb.NetInterface{Host: via.GetHost(), Port: via.GetPort(), Transport: common.Transport_UDP})
	via.Received = edgePortB
	res = envA.process(t, atA)
	if responseTypeOf(res) != "" || envA.location.findCalls != 0 {
		t.Fatalf("A: response = %v, want the INVITE trusted and forwarded to the callee", res)
	}
	return res.GetMessage()
}

func recordRouteHops(rr []*spb.RecordRoute) []string {
	var out []string
	for _, entry := range rr {
		uri := entry.GetAddress().GetUri()
		out = append(out, fmt.Sprintf("%s:%d;%s", uri.GetHost(), uri.GetPort(), uri.GetTransportParam()))
	}
	return out
}

// routeSet is a dialog's route set as a user agent keeps it (RFC 3261 section
// 12.1.2): the Record-Route URIs, in order for the UAS and reversed for the
// UAC.
func routeSet(rr []*spb.RecordRoute, uac bool) []*spb.Route {
	out := make([]*spb.Route, 0, len(rr))
	for _, entry := range rr {
		out = append(out, &spb.Route{Address: &spb.Address{Uri: proto.Clone(entry.GetAddress().GetUri()).(*spb.SipURI)}})
	}
	if uac {
		for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
			out[i], out[j] = out[j], out[i]
		}
	}
	return out
}

// bye is an in-dialog BYE with that route set and Request-URI.
func bye(env *testEnv, routes []*spb.Route, target *spb.SipURI) *ppb.MessageRequest {
	req := newRequest(env.now, requestOpts{method: ppb.Method_BYE, fromUser: "1001", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local", noAuth: true})
	req.Message.To.Tag = "callee-tag"
	req.Message.Route = routes
	req.Message.RecordRoute = nil
	req.Message.MessageType = &spb.SIPMessage_RequestUri{RequestUri: target}
	return req
}

func TestCrossedDialogRecordRoute(t *testing.T) {
	got := recordRouteHops(crossedInvite(t).GetRecordRoute())
	// A toward the callee and toward B, then B toward A and toward the caller:
	// each EdgePort is named by its own address where it faces the other
	want := []string{
		loadBalancer + ":5060;UDP", edgePortA + ":5060;UDP",
		edgePortB + ":5060;UDP", loadBalancer + ":5060;TCP",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("record-route = %v, want %v", got, want)
	}
}

func TestCrossedDialogInDialogRequests(t *testing.T) {
	rr := crossedInvite(t).GetRecordRoute()
	caller := &spb.SipURI{User: "1001", Host: callerHost, Port: 50000, TransportParam: "TCP"}
	callee := &spb.SipURI{User: "1002", Host: calleeHost, Port: 40000, TransportParam: "UDP"}
	edgePorts := map[string]string{"edgeport-a": edgePortA, "edgeport-b": edgePortB}
	cases := []struct {
		name   string
		uac    bool
		target *spb.SipURI
		holder string
	}{
		{"caller to callee", true, callee, "edgeport-a"},
		{"callee to caller", false, caller, "edgeport-b"},
	}
	for _, tc := range cases {
		for ref, ip := range edgePorts {
			t.Run(tc.name+" landing on "+ref, func(t *testing.T) {
				env := newTestEnv(t, crossedConfig())
				req := bye(env, routeSet(rr, tc.uac), proto.Clone(tc.target).(*spb.SipURI))
				onEdgePort(req, ref, ip, &ppb.NetInterface{Host: "10.244.0.1", Port: 33000, Transport: common.Transport_TCP})
				res := env.process(t, req)
				if responseTypeOf(res) != "" {
					t.Fatalf("response = %v, want the BYE forwarded", res)
				}
				out := res.GetMessage()
				if out.GetRequestUri().GetHost() != tc.target.GetHost() {
					t.Errorf("requestUri = %v", out.GetRequestUri())
				}
				if ref == tc.holder {
					// The connection is here: to the Request-URI, as in a dialog
					// that never crossed EdgePorts
					if len(out.GetRoute()) != 0 || out.GetVia()[0].GetHost() != loadBalancer {
						t.Errorf("route = %v, via = %v, want none and the external address", hops(out.GetRoute()), out.GetVia()[0])
					}
					return
				}
				holderIP := edgePorts[tc.holder]
				if got := hops(out.GetRoute()); !reflect.DeepEqual(got, []string{holderIP + ":5060"}) {
					t.Fatalf("route = %v, want the peer that holds the connection only", got)
				}
				if via := out.GetVia()[0]; via.GetHost() != ip || via.GetTransport() != "UDP" {
					t.Errorf("via = %v, want this EdgePort's own address, toward the peer", via)
				}

				// The holder receives it from the peer and sends it on
				envH := newTestEnv(t, crossedConfig())
				next := &ppb.MessageRequest{Ref: req.GetRef(), Method: ppb.Method_BYE, Message: proto.Clone(out).(*spb.SIPMessage)}
				onEdgePort(next, tc.holder, holderIP, &ppb.NetInterface{Host: ip, Port: 5060, Transport: common.Transport_UDP})
				res = envH.process(t, next)
				msg := res.GetMessage()
				if responseTypeOf(res) != "" || len(msg.GetRoute()) != 0 || msg.GetRequestUri().GetHost() != tc.target.GetHost() {
					t.Errorf("holder: message = %v, want the BYE sent to the Request-URI", msg)
				}
			})
		}
	}
}

func TestPeerFacingInterface(t *testing.T) {
	req := &ppb.MessageRequest{Localnets: []string{edgePortB + "/16"}, ListeningPoints: listeningPoints()}
	t.Run("is this EdgePort's own address facing the peer's localnet address", func(t *testing.T) {
		intf, ok := peerFacingInterface(req, routeFromPB(calleeOnA()))
		if !ok || intf.GetHost() != edgePortB || intf.GetPort() != 5060 || intf.GetTransport() != common.Transport_UDP {
			t.Errorf("interface = %v, %v", intf, ok)
		}
	})
	t.Run("is none for a peer outside the localnets", func(t *testing.T) {
		r := routeFromPB(calleeOnA())
		r.localnets = []string{"192.168.7.7/24"}
		if intf, ok := peerFacingInterface(req, r); ok {
			t.Errorf("interface = %v", intf)
		}
	})
	t.Run("is none for a transport this EdgePort doesn't serve", func(t *testing.T) {
		r := routeFromPB(calleeOnA())
		r.transport = "TLS"
		if intf, ok := peerFacingInterface(req, r); ok {
			t.Errorf("interface = %v", intf)
		}
	})
	t.Run("falls back to the record-route toward the callee", func(t *testing.T) {
		env := newTestEnv(t, nil)
		invite := agentInvite(env.now)
		r := routeFromPB(calleeOnA())
		r.localnets = []string{"192.168.7.7/24"}
		r.advertisedHost = "10.100.42.9"
		if err := addSelfRecordRouteToPeer(invite, r, nil); err != nil {
			t.Fatal(err)
		}
		want := recordRouteHops(invite.GetMessage().GetRecordRoute())
		other := agentInvite(env.now)
		if err := addSelfRecordRoute(other, r, nil); err != nil {
			t.Fatal(err)
		}
		if got := recordRouteHops(other.GetMessage().GetRecordRoute()); !reflect.DeepEqual(got, want) {
			t.Errorf("record-route = %v, want %v", got, want)
		}
	})
}

func TestRemoveRoutesUpToOwn(t *testing.T) {
	route := func(host string) *spb.Route {
		return &spb.Route{Address: &spb.Address{Uri: &spb.SipURI{Host: host, Port: 5060, TransportParam: "UDP", LrParam: true}}}
	}
	req := &ppb.MessageRequest{Localnets: []string{edgePortA + "/16"}, ExternalAddrs: []string{loadBalancer}, ListeningPoints: listeningPoints()}
	t.Run("drops everything up to the last entry with this EdgePort's own address", func(t *testing.T) {
		req.Message = &spb.SIPMessage{Route: []*spb.Route{route(loadBalancer), route(edgePortB), route(edgePortA), route(loadBalancer), route("203.0.113.9")}}
		removeRoutesUpToOwn(req)
		if got := hops(req.GetMessage().GetRoute()); !reflect.DeepEqual(got, []string{loadBalancer + ":5060", "203.0.113.9:5060"}) {
			t.Errorf("route = %v", got)
		}
	})
	t.Run("leaves a route set without one alone", func(t *testing.T) {
		req.Message = &spb.SIPMessage{Route: []*spb.Route{route(loadBalancer), route(edgePortB)}}
		removeRoutesUpToOwn(req)
		if got := hops(req.GetMessage().GetRoute()); len(got) != 2 {
			t.Errorf("route = %v", got)
		}
	})
	t.Run("doesn't take a network-form localnet for this EdgePort's address", func(t *testing.T) {
		netReq := &ppb.MessageRequest{Localnets: []string{"10.244.0.0/16"}, ListeningPoints: listeningPoints()}
		netReq.Message = &spb.SIPMessage{Route: []*spb.Route{route("10.244.0.0"), route(edgePortB)}}
		removeRoutesUpToOwn(netReq)
		if got := hops(netReq.GetMessage().GetRoute()); len(got) != 2 {
			t.Errorf("route = %v", got)
		}
	})
}

func TestLocalnetHost(t *testing.T) {
	for network, want := range map[string]string{
		"10.244.1.11/16":   "10.244.1.11",
		"127.0.0.1/8":      "127.0.0.1",
		"10.100.42.127/31": "10.100.42.127",
		"192.168.1.0/32":   "192.168.1.0",
		"10.1.2.3":         "10.1.2.3",
		"fd00::12/64":      "fd00::12",
		"10.244.0.0/16":    "",
		"10.0.0.0/8":       "",
		"fd00::/64":        "",
		"not-a-network":    "",
	} {
		got, ok := localnetHost(network)
		if got != want || ok != (want != "") {
			t.Errorf("localnetHost(%q) = %q, %v; want %q", network, got, ok, want)
		}
	}
}

func TestUncrossedDialogRecordRouteIsUnchanged(t *testing.T) {
	env := newTestEnv(t, nil)
	invite := agentInvite(env.now)
	env.withRoute(invite, r1())
	res := env.process(t, agentInvite(env.now))
	if responseTypeOf(res) != "" {
		t.Fatalf("response = %v", res)
	}
	// One entry, on the interface the call came in on, as before
	if got := recordRouteHops(res.GetMessage().GetRecordRoute()); len(got) != 2 || got[0] != "200.22.21.42:5060;TCP" {
		t.Errorf("record-route = %v", got)
	}
}

// The DigitalOcean and kind runs of 3.0.0-alpha.1: TCP-only EdgePorts behind a
// load balancer, localnets "${POD_IP}/8", peers trusted across 10.0.0.0/8, a
// callee registered from outside the localnets and a caller whose
// Request-URI names no transport. The crossed INVITE got 502: the peer rebuilt
// its route from that Request-URI as UDP. It also reached the peer through the
// load balancer, and the peer record-routed only the external address.
func TestCrossedInviteOnTCPOnlyEdgePorts(t *testing.T) {
	cfg := testConfig()
	cfg.Spec.TrustedEdgePortAddresses = []string{"10.0.0.0/8"}
	tcpOnly := []*ppb.NetInterface{{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP}}
	on := func(req *ppb.MessageRequest, ref, ip string, sender *ppb.NetInterface) {
		req.EdgePortRef = ref
		req.Localnets = []string{ip + "/8"}
		req.ExternalAddrs = []string{loadBalancer}
		req.ListeningPoints = tcpOnly
		req.Sender = sender
	}
	const podA, podB = "10.244.1.10", "10.244.2.8"
	envB := newTestEnv(t, cfg)
	envB.location.routes["sip:1002@sip.local"] = []*lpb.Route{{
		User: "1002", Host: "172.18.0.5", Port: "32779", AdvertisedHost: "172.18.0.5", AdvertisedPort: "32779",
		Transport: common.Transport_TCP, SessionCount: -1, RegisteredOn: 1761255805000, EdgePortRef: "edgeport-0",
		ListeningPoints: tcpOnly, Localnets: []string{podA + "/8"}, ExternalAddrs: []string{loadBalancer},
	}}
	invite := agentInvite(envB.now)
	invite.Message.Route = nil
	invite.Message.RecordRoute = nil
	invite.Message.GetRequestUri().TransportParam = ""
	on(invite, "edgeport-1", podB, &ppb.NetInterface{Host: "172.18.0.6", Port: 39789, Transport: common.Transport_TCP})
	res := envB.process(t, invite)
	if responseTypeOf(res) != "" {
		t.Fatalf("B: response = %v, want the INVITE forwarded to A", res)
	}
	// To A's own address, not the load balancer every EdgePort shares, with
	// the callee's binding, transport included, in the Request-URI
	if got := hops(res.GetMessage().GetRoute()); !reflect.DeepEqual(got, []string{podA + ":5060"}) {
		t.Errorf("B: route = %v, want A's own address", got)
	}
	if uri := res.GetMessage().GetRequestUri(); uri.GetHost() != "172.18.0.5" || uri.GetPort() != 32779 || uri.GetTransportParam() != "TCP" {
		t.Errorf("B: requestUri = %v, want the callee's binding", uri)
	}

	envA := newTestEnv(t, cfg)
	atA := &ppb.MessageRequest{Ref: invite.GetRef(), Method: ppb.Method_INVITE, Message: proto.Clone(res.GetMessage()).(*spb.SIPMessage)}
	// The EdgePort sends the Request-URI with no parameters (RequestURIFromDTO)
	atA.Message.GetRequestUri().TransportParam = ""
	via := atA.Message.Via[0]
	on(atA, "edgeport-0", podA, &ppb.NetInterface{Host: via.GetHost(), Port: via.GetPort(), Transport: common.Transport_TCP})
	via.Received = podB
	res = envA.process(t, atA)
	if responseTypeOf(res) != "" {
		t.Fatalf("A: response = %v, want the INVITE forwarded to the callee", res)
	}
	msg := res.GetMessage()
	if uri := msg.GetRequestUri(); len(msg.GetRoute()) != 0 || uri.GetHost() != "172.18.0.5" || uri.GetPort() != 32779 || uri.GetTransportParam() != "TCP" {
		t.Errorf("A: route = %v, requestUri = %v, want the callee's binding over TCP", msg.GetRoute(), uri)
	}
	want := []string{loadBalancer + ":5060;TCP", podA + ":5060;TCP", podB + ":5060;TCP", loadBalancer + ":5060;TCP"}
	if got := recordRouteHops(msg.GetRecordRoute()); !reflect.DeepEqual(got, want) {
		t.Errorf("record-route = %v, want %v", got, want)
	}

	// The BYEs, each landing on the EdgePort that doesn't hold its target's
	// connection, then sent on by the one that does
	caller := &spb.SipURI{User: "1001", Host: "172.18.0.6", Port: 39789, TransportParam: "TCP"}
	callee := &spb.SipURI{User: "1002", Host: "172.18.0.5", Port: 32779, TransportParam: "TCP"}
	edgePorts := map[string]string{"edgeport-0": podA, "edgeport-1": podB}
	for _, tc := range []struct {
		name          string
		uac           bool
		target        *spb.SipURI
		landing, held string
	}{
		{"caller to callee", true, callee, "edgeport-1", "edgeport-0"},
		{"callee to caller", false, caller, "edgeport-0", "edgeport-1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := newTestEnv(t, cfg)
			req := bye(env, routeSet(msg.GetRecordRoute(), tc.uac), proto.Clone(tc.target).(*spb.SipURI))
			on(req, tc.landing, edgePorts[tc.landing], &ppb.NetInterface{Host: tc.target.GetHost(), Port: 40000, Transport: common.Transport_TCP})
			res := env.process(t, req)
			if got := hops(res.GetMessage().GetRoute()); responseTypeOf(res) != "" || !reflect.DeepEqual(got, []string{edgePorts[tc.held] + ":5060"}) {
				t.Fatalf("landing: route = %v, response = %v, want the EdgePort that holds the connection", got, res)
			}
			next := &ppb.MessageRequest{Ref: req.GetRef(), Method: ppb.Method_BYE, Message: proto.Clone(res.GetMessage()).(*spb.SIPMessage)}
			next.Message.GetRequestUri().TransportParam = ""
			via := next.Message.Via[0]
			on(next, tc.held, edgePorts[tc.held], &ppb.NetInterface{Host: via.GetHost(), Port: via.GetPort(), Transport: common.Transport_TCP})
			res = newTestEnv(t, cfg).process(t, next)
			out := res.GetMessage()
			if responseTypeOf(res) != "" || len(out.GetRoute()) != 0 || out.GetRequestUri().GetHost() != tc.target.GetHost() || out.GetVia()[0].GetTransport() != "TCP" {
				t.Errorf("holder: message = %v, want the BYE sent to the Request-URI over TCP", out)
			}
		})
	}
}
