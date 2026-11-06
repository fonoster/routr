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
	"strings"
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func TestGetListeningPoint(t *testing.T) {
	lps := []*ppb.NetInterface{
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

func TestGetEdgeInterface(t *testing.T) {
	lps := []*ppb.NetInterface{{Host: "0.0.0.0", Port: 5060, Transport: common.Transport_UDP}}
	tests := []struct {
		name      string
		nets      edgeNets
		host      string
		transport string
		wantHost  string
		wantErr   string
	}{
		{"a local endpoint gets the localnet address", edgeNets{lps, []string{"10.111.221.2/24"}, []string{"203.0.113.10"}}, "10.111.221.22", "udp", "10.111.221.2", ""},
		{"a remote endpoint gets the external address", edgeNets{lps, []string{"10.111.221.2/24"}, []string{"203.0.113.10"}}, "198.51.100.7", "UDP", "203.0.113.10", ""},
		{"no transport is UDP", edgeNets{lps, []string{"10.111.221.2/24"}, nil}, "10.111.221.22", "", "10.111.221.2", ""},
		{"a transport without a listening point", edgeNets{lps, []string{"10.111.221.2/24"}, nil}, "10.111.221.22", "TLS", "", "no listening point found for transport TLS"},
		{"a remote endpoint without external addresses", edgeNets{lps, []string{"10.111.221.2/24"}, nil}, "198.51.100.7", "UDP", "", "unable to find a valid interface for host 198.51.100.7 and transport UDP"},
		{"a listening point bound elsewhere", edgeNets{[]*ppb.NetInterface{{Host: "10.0.0.9", Port: 5060, Transport: common.Transport_UDP}}, []string{"10.111.221.2/24"}, nil}, "10.111.221.22", "UDP", "", "listening point host 10.0.0.9 does not match interface host 10.111.221.2"},
		{"a listening point bound to the local address", edgeNets{[]*ppb.NetInterface{{Host: "10.111.221.2", Port: 5060, Transport: common.Transport_UDP}}, []string{"10.111.221.2/24"}, nil}, "10.111.221.22", "UDP", "10.111.221.2", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			intf, err := getEdgeInterface(tt.nets, tt.host, tt.transport)
			if tt.wantErr != "" {
				if err == nil || !strings.HasPrefix(err.Error(), tt.wantErr) {
					t.Fatalf("error = %v, want %q", err, tt.wantErr)
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

func TestGetHeaderValue(t *testing.T) {
	req := &ppb.MessageRequest{Message: &spb.SIPMessage{Extensions: []*spb.Extension{
		{Name: "X-Edgeport-Ref", Value: "edgeport-01"},
		{Name: "x-empty", Value: ""},
	}}}
	if got := getHeaderValue(req, "x-edgeport-ref"); got != "edgeport-01" {
		t.Errorf("case-insensitive lookup = %q", got)
	}
	if got := getHeaderValue(req, "X-Missing"); got != "" {
		t.Errorf("missing header = %q", got)
	}
	if getHeaderValue(nil, "X-Edgeport-Ref") != "" {
		t.Error("a nil request has headers")
	}
}

func TestIsResponseAndIsInDialog(t *testing.T) {
	now := time.Now()
	req := agentInvite(now)
	if isResponse(req) {
		t.Error("a request is a response")
	}
	if isInDialog(req) {
		t.Error("an initial INVITE is in a dialog")
	}
	req.Message.To.Tag = "callee-tag"
	if !isInDialog(req) {
		t.Error("a request with a To tag is not in a dialog")
	}
	res := &ppb.MessageRequest{Message: &spb.SIPMessage{MessageType: &spb.SIPMessage_ResponseType{ResponseType: spb.ResponseType_OK}}}
	if !isResponse(res) {
		t.Error("a response is a request")
	}
	if isResponse(nil) || isInDialog(nil) {
		t.Error("a nil request is a response or in a dialog")
	}
}

func TestSourceAddress(t *testing.T) {
	req := agentInvite(time.Now())
	if got := sourceAddress(req); got != "127.0.0.1" {
		t.Errorf("received = %q", got)
	}
	req.Message.Via[0].Received = ""
	if got := sourceAddress(req); got != "proxy" {
		t.Errorf("via host = %q", got)
	}
	if sourceAddress(&ppb.MessageRequest{Message: &spb.SIPMessage{}}) != "" {
		t.Error("no Via has a source")
	}
}

func TestIsFromTrustedEdgePort(t *testing.T) {
	trust := edgePortTrust{refs: []string{"edgeport-02"}, addresses: []string{"10.0.0.0/24"}}
	withRef := func(ref, received string) *ppb.MessageRequest {
		req := agentInvite(time.Now())
		req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: headerEdgePortRef, Value: ref})
		req.Message.Via[0].Received = received
		return req
	}
	base := withRef("edgeport-02", "10.0.0.5")
	tests := []struct {
		name  string
		req   *ppb.MessageRequest
		trust edgePortTrust
		want  bool
	}{
		{"ref and address trusted", base, trust, true},
		{"no refs means any ref from a trusted address", base, edgePortTrust{addresses: []string{"10.0.0.5"}}, true},
		{"default trusts nothing", base, edgePortTrust{}, false},
		{"refs alone are not enough", base, edgePortTrust{refs: []string{"edgeport-02"}}, false},
		{"unknown ref from a trusted address", withRef("edgeport-99", "10.0.0.5"), trust, false},
		{"untrusted address", withRef("edgeport-02", "10.0.1.5"), trust, false},
		{"no header", func() *ppb.MessageRequest {
			r := agentInvite(time.Now())
			r.Message.Via[0].Received = "10.0.0.5"
			return r
		}(), trust, false},
		{"a hostname source does not match a CIDR", func() *ppb.MessageRequest { r := withRef("edgeport-02", ""); return r }(), trust, false},
		{"a Via host spoofed to a trusted address", func() *ppb.MessageRequest {
			r := withRef("edgeport-02", "203.0.113.7")
			r.Message.Via[0].Host = "10.0.0.5"
			return r
		}(), trust, false},
		{"an invalid entry is skipped", base, edgePortTrust{addresses: []string{"not-an-ip", "10.0.0.0/24"}}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isFromTrustedEdgePort(tt.req, tt.trust); got != tt.want {
				t.Errorf("isFromTrustedEdgePort() = %v, want %v", got, tt.want)
			}
		})
	}
}
