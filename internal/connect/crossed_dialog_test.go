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
	"reflect"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/common"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// A dialog that crosses EdgePorts: three EdgePorts behind one load balancer
// (200.22.21.42), the caller's TCP connection on B, the callee's UDP binding on
// A, and C holding neither.

const (
	loadBalancer = "200.22.21.42"
	edgePortA    = "10.244.0.11"
	edgePortB    = "10.244.0.12"
	edgePortC    = "10.244.0.13"
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
	req.Localnets = []string{ip + "/24"}
	req.ExternalAddrs = []string{loadBalancer}
	req.ListeningPoints = listeningPoints()
	req.Sender = sender
}

func crossedConfig() *testSettings {
	cfg := testConfig()
	cfg.Spec.TrustedEdgePortAddresses = []string{"10.244.0.0/24"}
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
		Localnets:       []string{edgePortA + "/24"},
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
	if responseTypeOf(res) != "" {
		t.Fatalf("B: response = %v, want the INVITE forwarded to A", res)
	}
	if extensionValue(res.GetMessage(), headerEdgePortRef) != "edgeport-b" {
		t.Fatalf("B did not forward the INVITE to its peer")
	}

	envA := newTestEnv(t, cfg)
	atA := &ppb.MessageRequest{Ref: invite.GetRef(), Method: ppb.Method_INVITE, Message: proto.Clone(res.GetMessage()).(*spb.SIPMessage)}
	onEdgePort(atA, "edgeport-a", edgePortA, &ppb.NetInterface{Host: edgePortB, Port: 5060, Transport: common.Transport_UDP})
	atA.Message.Via[0].Received = edgePortB
	res = envA.process(t, atA)
	if responseTypeOf(res) != "" {
		t.Fatalf("A: response = %v, want the INVITE forwarded to the callee", res)
	}
	if envA.location.findCalls != 0 {
		t.Fatal("A routed the INVITE instead of trusting its peer")
	}
	return res.GetMessage()
}

// routeSet is a dialog's route set as a user agent keeps it (RFC 3261 section
// 12.1.2): the Record-Route URIs, in order for the UAS and reversed for the
// UAC. Header parameters are not kept.
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

func epOf(t *testing.T, entry *spb.RecordRoute) string {
	t.Helper()
	value := decodeIdentityUser(entry.GetAddress().GetUri().GetUser())[edgePortAddressParameter]
	ep, ok := decodeEdgePortAddress(value)
	if !ok {
		return ""
	}
	return hops([]*spb.Route{{Address: &spb.Address{Uri: ep}}})[0] + "/" + ep.GetTransportParam()
}

// bye is an in-dialog BYE with that route set and Request-URI, received by an
// EdgePort from the load balancer.
func bye(env *testEnv, routes []*spb.Route, target *spb.SipURI) *ppb.MessageRequest {
	req := newRequest(env.now, requestOpts{method: ppb.Method_BYE, fromUser: "1001", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local", noAuth: true})
	req.Message.To.Tag = "callee-tag"
	req.Message.Route = routes
	req.Message.RecordRoute = nil
	req.Message.MessageType = &spb.SIPMessage_RequestUri{RequestUri: target}
	return req
}

func TestCrossedDialogRecordRoute(t *testing.T) {
	msg := crossedInvite(t)
	var got []string
	for _, entry := range msg.GetRecordRoute() {
		got = append(got, epOf(t, entry))
	}
	// A's double Record-Route on top, then B's: each names its own address
	want := []string{edgePortA + ":5060/UDP", edgePortA + ":5060/UDP", edgePortB + ":5060/UDP", edgePortB + ":5060/UDP"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("record-route eps = %v, want %v", got, want)
	}
}

func TestCrossedDialogInDialogRequests(t *testing.T) {
	msg := crossedInvite(t)
	caller := &spb.SipURI{User: "1001", Host: callerHost, Port: 50000, TransportParam: "TCP"}
	callee := &spb.SipURI{User: "1002", Host: calleeHost, Port: 40000, TransportParam: "UDP"}
	cases := []struct {
		name      string
		uac       bool
		target    *spb.SipURI
		holder    string
		holderRef string
	}{
		{"caller to callee", true, callee, edgePortA, "edgeport-a"},
		{"callee to caller", false, caller, edgePortB, "edgeport-b"},
	}
	edgePorts := map[string]string{"edgeport-a": edgePortA, "edgeport-b": edgePortB, "edgeport-c": edgePortC}
	for _, tc := range cases {
		for ref, ip := range edgePorts {
			t.Run(tc.name+" landing on "+ref, func(t *testing.T) {
				env := newTestEnv(t, crossedConfig())
				req := bye(env, routeSet(msg.GetRecordRoute(), tc.uac), proto.Clone(tc.target).(*spb.SipURI))
				onEdgePort(req, ref, ip, &ppb.NetInterface{Host: "10.244.0.1", Port: 33000, Transport: common.Transport_TCP})
				res := env.process(t, req)
				if responseTypeOf(res) != "" {
					t.Fatalf("response = %v, want the BYE forwarded", res)
				}
				out := res.GetMessage()
				if out.GetRequestUri().GetHost() != tc.target.GetHost() {
					t.Errorf("requestUri = %v", out.GetRequestUri())
				}
				if ref == tc.holderRef {
					// The connection is here: straight to the Request-URI, as today
					if len(out.GetRoute()) != 0 {
						t.Errorf("route = %v, want none", hops(out.GetRoute()))
					}
					return
				}
				if got := hops(out.GetRoute()); !reflect.DeepEqual(got, []string{tc.holder + ":5060"}) {
					t.Fatalf("route = %v, want the EdgePort holding the connection only", got)
				}
				if out.GetRoute()[0].GetAddress().GetUri().GetTransportParam() != "UDP" {
					t.Errorf("route transport = %v", out.GetRoute()[0])
				}
				if via := out.GetVia()[0]; via.GetHost() != ip || via.GetTransport() != "UDP" {
					t.Errorf("via = %v, want this EdgePort's internal address", via)
				}

				// The holder receives it from the peer and sends it on
				envH := newTestEnv(t, crossedConfig())
				next := &ppb.MessageRequest{Ref: req.GetRef(), Method: ppb.Method_BYE, Message: proto.Clone(out).(*spb.SIPMessage)}
				onEdgePort(next, tc.holderRef, tc.holder, &ppb.NetInterface{Host: ip, Port: 5060, Transport: common.Transport_UDP})
				res = envH.process(t, next)
				if responseTypeOf(res) != "" || len(res.GetMessage().GetRoute()) != 0 || res.GetMessage().GetRequestUri().GetHost() != tc.target.GetHost() {
					t.Errorf("holder: message = %v, want the BYE sent to the Request-URI", res.GetMessage())
				}
			})
		}
	}
}

func TestCrossedDialogUntrustedAddress(t *testing.T) {
	selfRoute := func(ep string) []*spb.Route {
		return []*spb.Route{{Address: &spb.Address{Uri: &spb.SipURI{User: identityUser(map[string]string{edgePortAddressParameter: ep}), Host: loadBalancer, Port: 5060, TransportParam: "UDP", LrParam: true}}}}
	}
	target := &spb.SipURI{User: "1002", Host: calleeHost, Port: 40000, TransportParam: "UDP"}
	for name, ep := range map[string]string{
		"outside the localnets":     encodeTestAddress("192.168.7.7", 5060, "UDP"),
		"off the listening ports":   encodeTestAddress(edgePortA, 22, "UDP"),
		"on a transport not served": encodeTestAddress(edgePortA, 5060, "TLS"),
		"not an address":            "bm90LWFuLWFkZHJlc3M",
	} {
		t.Run("ignores an address "+name, func(t *testing.T) {
			env := newTestEnv(t, crossedConfig())
			req := bye(env, selfRoute(ep), proto.Clone(target).(*spb.SipURI))
			onEdgePort(req, "edgeport-c", edgePortC, &ppb.NetInterface{Host: "10.244.0.1", Port: 33000, Transport: common.Transport_TCP})
			res := env.process(t, req)
			if responseTypeOf(res) != "" || len(res.GetMessage().GetRoute()) != 0 {
				t.Errorf("message = %v, want the BYE sent to the Request-URI as today", res.GetMessage())
			}
			if res.GetMessage().GetVia()[0].GetHost() != loadBalancer {
				t.Errorf("via = %v", res.GetMessage().GetVia()[0])
			}
		})
	}
}

func encodeTestAddress(host string, port int32, transport string) string {
	req := &ppb.MessageRequest{
		Localnets:       []string{host + "/32"},
		ListeningPoints: []*ppb.NetInterface{{Host: "0.0.0.0", Port: port, Transport: common.Transport(common.Transport_value[transport])}},
	}
	return edgePortAddress(req, host, transport)
}

func TestEdgePortAddress(t *testing.T) {
	req := &ppb.MessageRequest{Localnets: []string{edgePortB + "/24"}, ListeningPoints: listeningPoints()}
	t.Run("is this EdgePort's localnet address on the transport's listening point", func(t *testing.T) {
		uri, ok := decodeEdgePortAddress(edgePortAddress(req, edgePortA, "udp"))
		if !ok || uri.GetHost() != edgePortB || uri.GetPort() != 5060 || uri.GetTransportParam() != "UDP" || !uri.GetLrParam() {
			t.Errorf("address = %v", uri)
		}
	})
	t.Run("is empty for a peer outside the localnets or a transport not served", func(t *testing.T) {
		if got := edgePortAddress(req, loadBalancer, "UDP"); got != "" {
			t.Errorf("address = %q", got)
		}
		if got := edgePortAddress(req, edgePortA, "TLS"); got != "" {
			t.Errorf("address = %q", got)
		}
	})
	t.Run("keeps an IPv6 address", func(t *testing.T) {
		v6 := &ppb.MessageRequest{Localnets: []string{"fd00::12/64"}, ListeningPoints: listeningPoints()}
		uri, ok := decodeEdgePortAddress(edgePortAddress(v6, "fd00::11", "TCP"))
		if !ok || uri.GetHost() != "fd00::12" || uri.GetPort() != 5060 {
			t.Errorf("address = %v", uri)
		}
	})
	t.Run("rejects what it did not write", func(t *testing.T) {
		for _, v := range []string{"", "!!", "bm90LWFuLWFkZHJlc3M", "MTAuMC4wLjE6NTA2MA", "aG9zdDo1MDYwO3RyYW5zcG9ydD1VRFA"} {
			if _, ok := decodeEdgePortAddress(v); ok {
				t.Errorf("decodeEdgePortAddress(%q) accepted", v)
			}
		}
	})
	t.Run("rides in the identity user part next to the mapping", func(t *testing.T) {
		ep := edgePortAddress(req, edgePortA, "UDP")
		user := identityUser(map[string]string{identityFromOriginal: "YQ", identityFromNew: "Yg", edgePortAddressParameter: ep})
		values := decodeIdentityUser(user)
		if values[edgePortAddressParameter] != ep || values[identityFromNew] != "Yg" {
			t.Errorf("decoded %v from %q", values, user)
		}
	})
}

func TestUncrossedDialogHasNoEdgePortAddress(t *testing.T) {
	env := newTestEnv(t, nil)
	env.withRoute(agentInvite(env.now), r1())
	res := env.process(t, agentInvite(env.now))
	if responseTypeOf(res) != "" {
		t.Fatalf("response = %v", res)
	}
	for _, entry := range res.GetMessage().GetRecordRoute() {
		if entry.GetAddress().GetUri().GetUser() != "" {
			t.Errorf("record-route %v carries a user part", entry)
		}
	}
}
