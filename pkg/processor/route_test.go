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
	"testing"
	"time"

	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The cases of internal/connect's route_test.go (TestCreateRoute,
// TestSessionCountOf, TestTransportOf), on the SDK's example request.

func TestCreateRoute(t *testing.T) {
	now := time.Date(2026, 10, 23, 21, 43, 25, 0, time.UTC)
	clock := func() time.Time { return now }
	req := exampleRequest()
	req.Message.From.Address.Uri.User = "1002"
	req.Message.Via[0] = &sipmessage.Via{Host: "192.168.1.3", Port: 5080, Branch: "z9hG4bK-25-1-3", Transport: "udp", RPortFlag: true, RPort: 7060, Received: "10.111.221.22", Ttl: -1}
	req.Message.Extensions = append(req.Message.Extensions, &sipmessage.Extension{Name: "X-Session-Count", Value: "3"})

	r := createRoute(req, 3600, clock)
	if r.GetUser() != "1002" || r.GetHost() != "10.111.221.22" || r.GetPort() != "7060" || r.GetTransport() != common.Transport_UDP {
		t.Errorf("route = %v, want 1002 at the Via's received and rport over UDP", r)
	}
	if r.GetAdvertisedHost() != "192.168.1.3" || r.GetAdvertisedPort() != "5080" {
		t.Errorf("advertised = %s:%s, want the Via's own host and port", r.GetAdvertisedHost(), r.GetAdvertisedPort())
	}
	if r.GetRegisteredOn() != now.UnixMilli() || r.GetSessionCount() != 3 {
		t.Errorf("registeredOn %d sessions %d", r.GetRegisteredOn(), r.GetSessionCount())
	}
	// The example's Contact names no expires, so the Expires header (60) counts
	if r.GetExpires() != 60 {
		t.Errorf("expires = %d, want the Expires header's 60", r.GetExpires())
	}
	if r.GetEdgePortRef() != "edgeport-01" || len(r.GetListeningPoints()) != 2 || len(r.GetLocalnets()) != 3 || len(r.GetExternalAddrs()) != 1 {
		t.Errorf("the EdgePort and its networks were not kept: %v", r)
	}

	t.Run("the Via host and port when received and rport are absent", func(t *testing.T) {
		req.Message.Via[0] = &sipmessage.Via{Host: "proxy", Port: 5060, Transport: "tcp", RPort: -1, Ttl: -1}
		r := createRoute(req, 3600, clock)
		if r.GetHost() != "proxy" || r.GetPort() != "5060" || r.GetTransport() != common.Transport_TCP {
			t.Errorf("route = %v", r)
		}
	})
	t.Run("UDP when the Via names no known transport", func(t *testing.T) {
		req.Message.Via[0].Transport = "nope"
		if r := createRoute(req, 3600, clock); r.GetTransport() != common.Transport_UDP {
			t.Errorf("transport = %v, want UDP", r.GetTransport())
		}
	})
	t.Run("the Contact's expires before the Expires header", func(t *testing.T) {
		req.Message.Contact.Expires = 120
		if r := createRoute(req, 3600, clock); r.GetExpires() != 120 {
			t.Errorf("expires = %d, want 120", r.GetExpires())
		}
	})
	t.Run("the default expiry when the request names none", func(t *testing.T) {
		req.Message.Contact.Expires = -1
		req.Message.Expires = nil
		if r := createRoute(req, 600, clock); r.GetExpires() != 600 {
			t.Errorf("expires = %d, want 600", r.GetExpires())
		}
	})
	t.Run("no Via", func(t *testing.T) {
		req.Message.Via = nil
		if r := createRoute(req, 600, clock); r == nil || r.GetHost() != "" || r.GetPort() != "0" {
			t.Errorf("route = %v, want an empty host and port 0", r)
		}
	})
}

func TestCreateRouteStampsTheTime(t *testing.T) {
	before := time.Now().UnixMilli()
	r := CreateRoute(exampleRequest(), DefaultExpires)
	if got := r.GetRegisteredOn(); got < before || got > time.Now().UnixMilli() {
		t.Errorf("registeredOn = %d, want now", got)
	}
	if r.GetUser() != "1001" || r.GetHost() != "proxy" || r.GetSessionCount() != -1 {
		t.Errorf("route = %v", r)
	}
}

func TestSessionCountOf(t *testing.T) {
	req := exampleRequest()
	if got := sessionCountOf(req); got != -1 {
		t.Errorf("absent = %d, want -1", got)
	}
	req.Message.Extensions = append(req.Message.Extensions, &sipmessage.Extension{Name: "x-session-count", Value: " 3 "})
	if got := sessionCountOf(req); got != 3 {
		t.Errorf("present = %d, want 3", got)
	}
	req.Message.Extensions[len(req.Message.Extensions)-1].Value = "abc"
	if got := sessionCountOf(req); got != 0 {
		t.Errorf("unparsable = %d, want 0", got)
	}
}

func TestTransportOf(t *testing.T) {
	for in, want := range map[string]common.Transport{"udp": common.Transport_UDP, "TLS": common.Transport_TLS, "Wss": common.Transport_WSS, "": common.Transport_UDP, "sctp": common.Transport_SCTP, "nope": common.Transport_UDP} {
		if got := transportOf(in); got != want {
			t.Errorf("transportOf(%q) = %v, want %v", in, got, want)
		}
	}
}
