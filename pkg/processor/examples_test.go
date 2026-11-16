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
	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/location"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The fixtures of mods/processor/test/examples.ts: a REGISTER and the route
// to Agent 1001, on this EdgePort and on another one. The Go tests of
// internal/connect run on the same ones (alterations_test.go), so a case
// ported between the two reads the same.

func exampleRequest() *MessageRequest {
	tcp := func(user, host string, port int32) *sipmessage.SipURI {
		return &sipmessage.SipURI{User: user, Host: host, TransportParam: "TCP", TtlParam: -1, Port: port}
	}
	return &MessageRequest{
		Ref:           "AynhXaFtbdXwHrUEzt_rUQ..",
		EdgePortRef:   "edgeport-01",
		Method:        Method_REGISTER,
		ExternalAddrs: []string{"200.22.21.42"},
		Localnets:     []string{"127.0.0.1/8", "10.100.42.127/24", "10.100.43.128/31"},
		ListeningPoints: []*NetInterface{
			{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP},
			{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_UDP},
		},
		Sender: &NetInterface{Host: "127.0.0.1", Port: 36214, Transport: common.Transport_TCP},
		Message: &sipmessage.SIPMessage{
			MessageType: &sipmessage.SIPMessage_RequestUri{RequestUri: tcp("", "sip.local", 5060)},
			Via: []*sipmessage.Via{
				{Host: "proxy", Port: 5060, Branch: "z9hG4bK-524287-1---7315a24d84546819", Transport: "TCP", RPort: -1, Ttl: -1},
				{Host: "127.0.0.1", Port: 36214, Branch: "z9hG4bK-524287-1---7315a24d84546819", Transport: "TCP", RPort: -1, Ttl: -1},
			},
			Extensions: []*sipmessage.Extension{
				{Name: "CSeq", Value: "14 REGISTER"},
				{Name: "Allow", Value: "INVITE"},
				{Name: "User-Agent", Value: "Z 5.4.12 v2.10.13.2"},
				{Name: "Allow-Events", Value: "presence"},
			},
			From: &sipmessage.From{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{User: "1001", Host: "sip.local", TransportParam: "UDP", TtlParam: -1, Port: 5060}, DisplayName: "John Doe"}, Tag: "9041462a"},
			To:   &sipmessage.To{Address: &sipmessage.Address{Uri: tcp("1001", "sip.local", 5060)}},
			Contact: &sipmessage.Contact{
				Address: &sipmessage.Address{Uri: tcp("1001", "127.0.0.1", 36214)},
				Expires: -1, QValue: -1,
			},
			CallId:        &sipmessage.CallID{CallId: "AynhXaFtbdXwHrUEzt_rUQ.."},
			ContentLength: &sipmessage.ContentLength{},
			MaxForwards:   &sipmessage.MaxForwards{MaxForwards: 70},
			Expires:       &sipmessage.Expires{Expires: 60},
			RecordRoute: []*sipmessage.RecordRoute{
				{Parameters: map[string]string{"a": "1", "b": "2"}, Address: &sipmessage.Address{Uri: tcp("", "sip.local", 5060)}},
			},
			Route: []*sipmessage.Route{
				{Address: &sipmessage.Address{Uri: tcp("", "10.100.42.127", 5060)}},
				{Address: &sipmessage.Address{Uri: tcp("", "10.100.42.128", 5060)}},
			},
			Authorization: &sipmessage.Authorization{Realm: "sip.local", Scheme: "Digest", Nonce: "b8fe2321cf489ac475c80c6e5cfa1c22", Username: "1001", Uri: "sip:sip.local;transport=TCP"},
		},
	}
}

// exampleRoute is the route as Location returns it: its ports are strings.
func exampleRoute() *location.Route {
	return &location.Route{
		User:            "1001",
		Host:            "127.0.0.1",
		Port:            "5060",
		AdvertisedHost:  "127.0.0.1",
		AdvertisedPort:  "5060",
		Transport:       common.Transport_TCP,
		RegisteredOn:    1761255805000,
		SessionCount:    -1,
		Expires:         600,
		EdgePortRef:     "edgeport-01",
		ListeningPoints: []*NetInterface{{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP}},
		Localnets:       []string{"127.0.0.1/8"},
		ExternalAddrs:   []string{"47.132.130.31"},
	}
}

// exampleHeaders are the header modifiers examples.ts carries on its route.
func exampleHeaders() []HeaderModifier {
	return []HeaderModifier{
		{Name: "X-Gateway-Auth", Value: "dXNlcm5hbWU6cGFzc3dvcmQ="},
		{Name: "user-agent", Remove: true},
	}
}

func exampleRouteOnAnotherEdgePort() *location.Route {
	r := exampleRoute()
	r.AdvertisedHost = "127.0.0.0"
	r.EdgePortRef = "edgeport-02"
	r.Localnets = []string{"127.0.0.1/8", "10.100.42.128/24"}
	return r
}

// pstnMessage is examples.ts createPSTNMessage: the example request as a call
// from one number to another through a provider.
func pstnMessage(from, to string) *MessageRequest {
	req := exampleRequest()
	req.Message.MessageType = &sipmessage.SIPMessage_RequestUri{
		RequestUri: &sipmessage.SipURI{User: to, Host: "someprovider.net", Port: 5060, TransportParam: "TCP"},
	}
	req.Message.To.Address.Uri.User = to
	req.Message.From.Address.Uri.User = from
	return req
}
