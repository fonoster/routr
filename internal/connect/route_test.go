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
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func TestPortOf(t *testing.T) {
	for in, want := range map[string]int32{"5060": 5060, " 7060 ": 7060, "": 0, "abc": 0, "-1": -1} {
		if got := portOf(in); got != want {
			t.Errorf("portOf(%q) = %d, want %d", in, got, want)
		}
	}
}

func TestRouteFromPB(t *testing.T) {
	r := routeFromPB(r1())
	if r.user != "1002" || r.host != "192.168.1.3" || r.port != 5060 || r.advertisedPort != 5060 || r.transport != "TCP" || r.edgePortRef != "edgeport-01" || r.registeredOn != 1761255805000 || r.sessionCount != -1 {
		t.Errorf("route = %+v", r)
	}
	if len(r.listeningPoints) != 1 {
		t.Error("listening points were not kept")
	}
	if r.headers != nil || r.metadata != nil {
		t.Error("a Location route carries headers or metadata")
	}
}

func TestTransportOf(t *testing.T) {
	for in, want := range map[string]common.Transport{"udp": common.Transport_UDP, "TLS": common.Transport_TLS, "Wss": common.Transport_WSS, "": common.Transport_UDP, "sctp": common.Transport_SCTP, "nope": common.Transport_UDP} {
		if got := transportOf(in); got != want {
			t.Errorf("transportOf(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestTargetAOR(t *testing.T) {
	req := agentInvite(time.Now())
	if got := targetAOR(req); got != "sip:1002@sip.local" {
		t.Errorf("targetAOR() = %q", got)
	}
	req.Message.To.GetAddress().GetUri().Secure = true
	if got := targetAOR(req); got != "sips:1002@sip.local" {
		t.Errorf("targetAOR() = %q", got)
	}
	req.Message.To.GetAddress().GetUri().User = ""
	if got := targetAOR(req); got != "sips:sip.local" {
		t.Errorf("targetAOR() = %q", got)
	}
}

func TestTargetExpires(t *testing.T) {
	tests := []struct {
		name    string
		contact int32
		header  *spb.Expires
		want    int32
	}{
		{"the Contact parameter wins", 120, &spb.Expires{Expires: 60}, 120},
		{"a Contact expires of 0 is an unregistration", 0, &spb.Expires{Expires: 60}, 0},
		{"then the Expires header", -1, &spb.Expires{Expires: 60}, 60},
		{"then the default", -1, nil, 3600},
		{"an Expires header of -1 is none", -1, &spb.Expires{Expires: -1}, 3600},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := agentInvite(time.Now())
			req.Message.Contact.Expires = tt.contact
			req.Message.Expires = tt.header
			if got := targetExpires(req, 3600); got != tt.want {
				t.Errorf("targetExpires() = %d, want %d", got, tt.want)
			}
		})
	}
	noContact := agentInvite(time.Now())
	noContact.Message.Contact = nil
	if got := targetExpires(noContact, 3600); got != 60 {
		t.Errorf("without a Contact = %d, want 60", got)
	}
}

func TestSessionCountOf(t *testing.T) {
	req := agentInvite(time.Now())
	if got := sessionCountOf(req); got != -1 {
		t.Errorf("absent = %d, want -1", got)
	}
	req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "x-session-count", Value: " 3 "})
	if got := sessionCountOf(req); got != 3 {
		t.Errorf("present = %d, want 3", got)
	}
	req.Message.Extensions[len(req.Message.Extensions)-1].Value = "many"
	if got := sessionCountOf(req); got != 0 {
		t.Errorf("unparsable = %d, want 0", got)
	}
}

func TestCreateRoute(t *testing.T) {
	now := time.Date(2026, 10, 23, 21, 43, 25, 0, time.UTC)
	clock := func() time.Time { return now }
	req := newRequest(now, requestOpts{method: ppb.Method_REGISTER, fromUser: "1002", fromDomain: "sip.local", toUser: "1002", toDomain: "sip.local"})
	req.Message.Via[0] = &spb.Via{Host: "10.111.221.22", Port: 7060, Branch: "z9hG4bK-25-1-3", Transport: "udp", RPortFlag: true, RPort: 7060, Received: "10.111.221.22", Ttl: -1}
	req.Message.Extensions = append(req.Message.Extensions, &spb.Extension{Name: "X-Session-Count", Value: "0"})

	r := createRoute(req, 3600, clock)
	if r.GetUser() != "1002" || r.GetHost() != "10.111.221.22" || r.GetPort() != "7060" || r.GetTransport() != common.Transport_UDP {
		t.Errorf("route = %v", r)
	}
	if r.GetAdvertisedHost() != "10.111.221.22" || r.GetAdvertisedPort() != "7060" || r.GetEdgePortRef() != "edgeport-01" {
		t.Errorf("advertised = %s:%s on %s", r.GetAdvertisedHost(), r.GetAdvertisedPort(), r.GetEdgePortRef())
	}
	if r.GetRegisteredOn() != now.UnixMilli() || r.GetExpires() != 60 || r.GetSessionCount() != 0 {
		t.Errorf("registeredOn %d expires %d sessions %d", r.GetRegisteredOn(), r.GetExpires(), r.GetSessionCount())
	}
	if len(r.GetListeningPoints()) != 2 || len(r.GetLocalnets()) != 2 || len(r.GetExternalAddrs()) != 1 {
		t.Error("the EdgePort's networks were not kept")
	}

	t.Run("the Via host and port when received and rport are absent", func(t *testing.T) {
		req.Message.Via[0] = &spb.Via{Host: "proxy", Port: 5060, Transport: "TCP", RPort: -1, Ttl: -1}
		r := createRoute(req, 3600, clock)
		if r.GetHost() != "proxy" || r.GetPort() != "5060" || r.GetTransport() != common.Transport_TCP {
			t.Errorf("route = %v", r)
		}
	})
	t.Run("the default expiry when the request names none", func(t *testing.T) {
		req.Message.Expires = nil
		if r := createRoute(req, 600, clock); r.GetExpires() != 600 {
			t.Errorf("expires = %d, want 600", r.GetExpires())
		}
	})
	t.Run("no Via", func(t *testing.T) {
		req.Message.Via = nil
		if r := createRoute(req, 600, clock); r.GetHost() != "" || r.GetPort() != "0" {
			t.Errorf("route = %v", r)
		}
	})
}

func TestCreateRouteFromLastMessage(t *testing.T) {
	now := time.Now()
	req := agentInvite(now)
	req.Message.GetRequestUri().Host = "10.111.221.22"
	req.Message.GetRequestUri().Port = 7060
	req.Message.GetRequestUri().TransportParam = "udp"
	r := createRouteFromLastMessage(req, func() time.Time { return now })
	if r.GetUser() != "1002" || r.GetHost() != "10.111.221.22" || r.GetPort() != "7060" || r.GetTransport() != common.Transport_UDP {
		t.Errorf("route = %v", r)
	}
	if r.GetAdvertisedHost() != "proxy" || r.GetAdvertisedPort() != "5060" {
		t.Errorf("advertised = %s:%s", r.GetAdvertisedHost(), r.GetAdvertisedPort())
	}
	if r.GetExpires() != 60 {
		t.Errorf("expires = %d", r.GetExpires())
	}
}
