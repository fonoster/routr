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

	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The cases of mods/processor/test/helper.unit.test.ts, and those of
// internal/connect/helper_test.go for the code copied from there.

func TestNets(t *testing.T) {
	req := exampleRequest()
	if got := NetsOf(req); !reflect.DeepEqual(got, Nets{req.ListeningPoints, req.Localnets, req.ExternalAddrs}) {
		t.Errorf("NetsOf() = %v", got)
	}
	route := exampleRoute()
	if got := NetsOfRoute(route); !reflect.DeepEqual(got, Nets{route.ListeningPoints, route.Localnets, route.ExternalAddrs}) {
		t.Errorf("NetsOfRoute() = %v", got)
	}
}

func TestEdgeInterfaceOfTheExampleRequest(t *testing.T) {
	t.Run("an address not in localnets", func(t *testing.T) {
		intf, err := EdgeInterface(NetsOf(exampleRequest()), "47.131.130.35", common.Transport_UDP)
		if err != nil {
			t.Fatal(err)
		}
		if intf.GetHost() != "200.22.21.42" || intf.GetPort() != 5060 || intf.GetTransport() != common.Transport_UDP {
			t.Errorf("interface = %v", intf)
		}
	})
	t.Run("an address in localnets", func(t *testing.T) {
		intf, err := EdgeInterface(NetsOf(exampleRequest()), "10.100.42.12", common.Transport_UDP)
		if err != nil {
			t.Fatal(err)
		}
		if intf.GetHost() != "10.100.42.127" {
			t.Errorf("interface = %v", intf)
		}
	})
	t.Run("routing to the internet without an external address", func(t *testing.T) {
		req := exampleRequest()
		req.ExternalAddrs = nil
		if _, err := EdgeInterface(NetsOf(req), "47.131.130.35", common.Transport_UDP); !errors.Is(err, ErrNoInterface) {
			t.Errorf("error = %v, want ErrNoInterface", err)
		}
	})
}

func TestEdgeInterface(t *testing.T) {
	lps := []*NetInterface{{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_UDP}}
	localnets := []string{"10.111.221.2/24"}
	tests := []struct {
		name      string
		nets      Nets
		host      string
		transport common.Transport
		wantHost  string
		wantIs    error
		wantErr   string
	}{
		{"a local endpoint gets the localnet address", Nets{lps, localnets, []string{"203.0.113.10"}}, "10.111.221.22", common.Transport_UDP, "10.111.221.2", nil, ""},
		{"a remote endpoint gets the external address", Nets{lps, localnets, []string{"203.0.113.10"}}, "198.51.100.7", common.Transport_UDP, "203.0.113.10", nil, ""},
		{"a host name is in no localnet", Nets{lps, localnets, []string{"203.0.113.10"}}, "sip.local", common.Transport_UDP, "203.0.113.10", nil, ""},
		{"a localnet written as a network names no interface", Nets{lps, []string{"10.111.221.0/24"}, []string{"203.0.113.10"}}, "10.111.221.22", common.Transport_UDP, "203.0.113.10", nil, ""},
		{"a transport without a listening point", Nets{lps, localnets, nil}, "10.111.221.22", common.Transport_TLS, "", nil,
			"no listening point found for transport TLS; add the transport to the EdgePort's spec.transport (and spec.securityContext for tls or wss)"},
		{"a remote endpoint without external addresses", Nets{lps, localnets, nil}, "198.51.100.7", common.Transport_UDP, "", ErrNoInterface,
			"unable to find a valid interface for host 198.51.100.7 and transport UDP"},
		{"a listening point bound elsewhere", Nets{[]*NetInterface{{Host: "10.0.0.9", Port: 5060, Transport: common.Transport_UDP}}, localnets, nil}, "10.111.221.22", common.Transport_UDP, "", ErrListeningPointHost,
			"listening point host 10.0.0.9 does not match interface host 10.111.221.2"},
		{"a listening point bound to the local address", Nets{[]*NetInterface{{Host: "10.111.221.2", Port: 5060, Transport: common.Transport_UDP}}, localnets, nil}, "10.111.221.22", common.Transport_UDP, "10.111.221.2", nil, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			intf, err := EdgeInterface(tt.nets, tt.host, tt.transport)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Fatalf("error = %v, want %q", err, tt.wantErr)
				}
				if tt.wantIs != nil && !errors.Is(err, tt.wantIs) {
					t.Errorf("errors.Is(%v, %v) = false", err, tt.wantIs)
				}
				if errors.Is(err, ErrNoInterface) && errors.Is(err, ErrListeningPointHost) {
					t.Error("the error is both sentinels")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if intf.GetHost() != tt.wantHost || intf.GetPort() != 5060 || intf.GetTransport() != common.Transport_UDP {
				t.Errorf("interface = %v", intf)
			}
		})
	}
}

func TestGetListeningPoint(t *testing.T) {
	lps := []*NetInterface{
		{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_TCP},
		{Host: "0.0.0.0", Port: 5061, Transport: common.Transport_UDP},
	}
	tests := []struct {
		transport string
		wantPort  int32
		wantErr   bool
	}{
		{"TCP", 5060, false},
		{"tcp", 5060, false},
		{"", 5061, false},
		{"udp", 5061, false},
		{"TLS", 0, true},
	}
	for _, tt := range tests {
		lp, err := getListeningPoint(lps, tt.transport)
		if tt.wantErr {
			var nlp *noListeningPointError
			if !errors.As(err, &nlp) || nlp.transport != "TLS" {
				t.Errorf("getListeningPoint(%q) error = %v, want a noListeningPointError", tt.transport, err)
			}
			continue
		}
		if err != nil || lp.GetPort() != tt.wantPort {
			t.Errorf("getListeningPoint(%q) = %v, %v", tt.transport, lp, err)
		}
	}
}

func TestHasIP(t *testing.T) {
	tests := []struct {
		network, addr string
		want          bool
	}{
		{"10.0.0.0/24", "10.0.0.5", true},
		{"10.0.0.0/24", "10.0.1.5", false},
		{"10.0.0.5", "10.0.0.5", true},
		{"10.0.0.5", "10.0.0.6", false},
		{"10.0.0.0/255.255.255.0", "10.0.0.7", true},
		{"10.0.0.0/255.255.255.0", "10.0.1.7", false},
		{"127.0.0.1/8", "127.0.0.1", true},
		{"10.100.42.127/31", "10.100.42.127", true},
		{"::1", "::1", true},
		{"not-an-ip", "10.0.0.5", false},
		{"10.0.0.0/24", "sip.local", false},
		{"10.0.0.0/99", "10.0.0.5", false},
	}
	for _, tt := range tests {
		if got := hasIP(tt.network, tt.addr); got != tt.want {
			t.Errorf("hasIP(%q, %q) = %v, want %v", tt.network, tt.addr, got, tt.want)
		}
	}
}

func TestGetLocalnetIP(t *testing.T) {
	nets := []string{"127.0.0.1/8", "10.111.221.2/24"}
	if ip, ok := getLocalnetIP(nets, "10.111.221.22"); !ok || ip != "10.111.221.2" {
		t.Errorf("getLocalnetIP() = %q, %v", ip, ok)
	}
	if _, ok := getLocalnetIP(nets, "203.0.113.7"); ok {
		t.Error("an address outside every localnet was found")
	}
	if _, ok := getLocalnetIP(nil, "10.111.221.22"); ok {
		t.Error("an address was found without localnets")
	}
}

func TestPortOf(t *testing.T) {
	for in, want := range map[string]int32{"5060": 5060, " 5061 ": 5061, "": 0, "sip": 0, "-1": -1} {
		if got := portOf(in); got != want {
			t.Errorf("portOf(%q) = %d, want %d", in, got, want)
		}
	}
}

func TestMessagePredicates(t *testing.T) {
	request := func(method Method, body string) *MessageRequest {
		req := exampleRequest()
		req.Method = method
		req.Message.Body = body
		return req
	}
	response := func(code sipmessage.ResponseType, body string) *MessageRequest {
		req := exampleRequest()
		req.Method = Method_INVITE
		req.Message.MessageType = &sipmessage.SIPMessage_ResponseType{ResponseType: code}
		req.Message.Body = body
		return req
	}
	const sdp = "v=0\r\n"
	predicates := []struct {
		name string
		is   func(*MessageRequest) bool
	}{
		{"IsTypeRequest", IsTypeRequest},
		{"IsTypeResponse", IsTypeResponse},
		{"HasSDP", HasSDP},
		{"IsOK", IsOK},
		{"IsRinging", IsRinging},
		{"IsInviteWithSDP", IsInviteWithSDP},
		{"IsAckWithSDP", IsAckWithSDP},
		{"IsInviteOrAckWithSDP", IsInviteOrAckWithSDP},
		{"IsResponseWithSDP", IsResponseWithSDP},
		{"IsOKOrRingingWithSDP", IsOKOrRingingWithSDP},
		{"IsBye", IsBye},
	}
	tests := []struct {
		name string
		msg  *MessageRequest
		want []string
	}{
		{"an INVITE with SDP", request(Method_INVITE, sdp), []string{"IsTypeRequest", "HasSDP", "IsInviteWithSDP", "IsInviteOrAckWithSDP"}},
		{"an INVITE without SDP", request(Method_INVITE, ""), []string{"IsTypeRequest"}},
		{"an ACK with SDP", request(Method_ACK, sdp), []string{"IsTypeRequest", "HasSDP", "IsAckWithSDP", "IsInviteOrAckWithSDP"}},
		{"a BYE", request(Method_BYE, ""), []string{"IsTypeRequest", "IsBye"}},
		{"a REGISTER", request(Method_REGISTER, ""), []string{"IsTypeRequest"}},
		{"a 200 with SDP", response(sipmessage.ResponseType_OK, sdp), []string{"IsTypeResponse", "HasSDP", "IsOK", "IsResponseWithSDP", "IsOKOrRingingWithSDP"}},
		{"a 180 with SDP", response(sipmessage.ResponseType_RINGING, sdp), []string{"IsTypeResponse", "HasSDP", "IsRinging", "IsResponseWithSDP", "IsOKOrRingingWithSDP"}},
		{"a 200 without SDP", response(sipmessage.ResponseType_OK, ""), []string{"IsTypeResponse", "IsOK"}},
		{"a 183 with SDP", response(sipmessage.ResponseType_SESSION_PROGRESS, sdp), []string{"IsTypeResponse", "HasSDP", "IsResponseWithSDP"}},
		// The method of a response is its request's: a 200 to a BYE is no BYE
		{"a 200 to a BYE", func() *MessageRequest { r := response(sipmessage.ResponseType_OK, ""); r.Method = Method_BYE; return r }(), []string{"IsTypeResponse", "IsOK"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, p := range predicates {
				if got, want := p.is(tt.msg), contains(tt.want, p.name); got != want {
					t.Errorf("%s = %v, want %v", p.name, got, want)
				}
			}
		})
	}
}

func TestIsWebRTC(t *testing.T) {
	for transport, want := range map[common.Transport]bool{
		common.Transport_WS: true, common.Transport_WSS: true,
		common.Transport_UDP: false, common.Transport_TCP: false, common.Transport_TLS: false, common.Transport_SCTP: false,
	} {
		if got := IsWebRTC(transport); got != want {
			t.Errorf("IsWebRTC(%v) = %v", transport, got)
		}
	}
}
