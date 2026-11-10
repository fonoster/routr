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
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/location"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The helpers of mods/processor/src/helper.ts. This file, alterations.go and
// identity.go mirror internal/connect's helper.go, alterations.go and
// identity.go: a fix in one goes to the other, with its case ported.

// headerEdgePortRef is the header an EdgePort marks a request it forwards to
// a peer EdgePort with.
const headerEdgePortRef = "X-Edgeport-Ref"

// The two errors of EdgeInterface, wrapped with the host and the transport
// they are about; errors.Is tells them apart.
var (
	// ErrNoInterface says the endpoint is in none of the localnets and the
	// EdgePort has no external address to reach it from.
	ErrNoInterface = errors.New("unable to find a valid interface")
	// ErrListeningPointHost says the listening point of the endpoint's
	// transport is bound to another address than the localnet's.
	ErrListeningPointHost = errors.New("listening point host does not match interface host")
)

// edgeInterfaceError is one of the two errors above with its full text.
type edgeInterfaceError struct {
	kind error
	text string
}

func (e *edgeInterfaceError) Error() string { return e.text }
func (e *edgeInterfaceError) Unwrap() error { return e.kind }

// noListeningPointError says a transport is wanted that the EdgePort does not
// listen on (mods/common/src/errors.ts NoListeningPointError).
type noListeningPointError struct {
	transport string
}

func (e *noListeningPointError) Error() string {
	return fmt.Sprintf("no listening point found for transport %s; add the transport to the EdgePort's spec.transport (and spec.securityContext for tls or wss)", e.transport)
}

// Nets are the networks an interface is chosen from: a request's or a
// route's listening points, localnets and external addresses.
type Nets struct {
	ListeningPoints []*NetInterface
	Localnets       []string
	ExternalAddrs   []string
}

// NetsOf are the networks of the EdgePort the request came through.
func NetsOf(req *MessageRequest) Nets {
	return Nets{req.GetListeningPoints(), req.GetLocalnets(), req.GetExternalAddrs()}
}

// NetsOfRoute are the networks of the EdgePort the route lives on.
func NetsOfRoute(route *location.Route) Nets {
	return Nets{route.GetListeningPoints(), route.GetLocalnets(), route.GetExternalAddrs()}
}

// EdgeInterface is the interface the EdgePort talks to an endpoint from: a
// local address when the endpoint is in one of the localnets, else the first
// external address, on the listening point of the endpoint's transport. It
// returns ErrNoInterface for an endpoint outside every localnet when there is
// no external address, and ErrListeningPointHost when the listening point is
// bound to another address than the localnet's.
func EdgeInterface(nets Nets, endpointHost string, transport common.Transport) (*NetInterface, error) {
	return edgeInterface(nets, endpointHost, transport.String())
}

// edgeInterface is EdgeInterface for a transport as a SIP URI names it: in
// any case, UDP when empty.
func edgeInterface(nets Nets, endpointHost, endpointTransport string) (*NetInterface, error) {
	localnetIP, local := getLocalnetIP(nets.Localnets, endpointHost)
	lp, err := getListeningPoint(nets.ListeningPoints, endpointTransport)
	if err != nil {
		return nil, err
	}
	host := localnetIP
	if !local {
		if len(nets.ExternalAddrs) == 0 {
			return nil, &edgeInterfaceError{ErrNoInterface, fmt.Sprintf("unable to find a valid interface for host %s and transport %s", endpointHost, lp.GetTransport())}
		}
		host = nets.ExternalAddrs[0]
	}
	if local && lp.GetHost() != "0.0.0.0" && lp.GetHost() != host {
		return nil, &edgeInterfaceError{ErrListeningPointHost, fmt.Sprintf("listening point host %s does not match interface host %s", lp.GetHost(), host)}
	}
	return &NetInterface{Host: host, Port: lp.GetPort(), Transport: lp.GetTransport()}, nil
}

// getListeningPoint is the listening point for a transport, UDP when none is
// named.
func getListeningPoint(listeningPoints []*NetInterface, transport string) (*NetInterface, error) {
	want := strings.ToUpper(transport)
	if want == "" {
		want = "UDP"
	}
	for _, lp := range listeningPoints {
		if lp.GetTransport().String() == want {
			return lp, nil
		}
	}
	return nil, &noListeningPointError{transport: want}
}

// parseNet reads a network: an address (a /32 or /128), a CIDR, or an address
// with a dotted IPv4 mask.
func parseNet(network string) (*net.IPNet, bool) {
	parts := strings.SplitN(network, "/", 2)
	if len(parts) == 1 {
		ip := net.ParseIP(network)
		if ip == nil {
			return nil, false
		}
		bits := 128
		if ip.To4() != nil {
			bits = 32
			ip = ip.To4()
		}
		return &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)}, true
	}
	if mask := net.ParseIP(parts[1]); mask != nil && mask.To4() != nil {
		ip := net.ParseIP(parts[0])
		if ip == nil || ip.To4() == nil {
			return nil, false
		}
		ones, bits := net.IPMask(mask.To4()).Size()
		if bits == 0 {
			return nil, false
		}
		return &net.IPNet{IP: ip.To4().Mask(net.CIDRMask(ones, bits)), Mask: net.CIDRMask(ones, bits)}, true
	}
	_, ipnet, err := net.ParseCIDR(network)
	if err != nil {
		return nil, false
	}
	return ipnet, true
}

// hasIP tells whether the address is in the network. An address that is not
// an IP is in no network.
func hasIP(network, addr string) bool {
	ipnet, ok := parseNet(network)
	if !ok {
		return false
	}
	ip := net.ParseIP(addr)
	if ip == nil {
		return false
	}
	return ipnet.Contains(ip)
}

// getLocalnetIP is the address part of the first localnet the host belongs
// to. A localnet written as a network (its host bits zero, 10.0.0.0/8) names
// no interface and is passed over: its address would be the same on every
// EdgePort.
func getLocalnetIP(localnets []string, host string) (string, bool) {
	for _, network := range localnets {
		if own, ok := localnetHost(network); ok && hasIP(network, host) {
			return own, true
		}
	}
	return "", false
}

// localnetHost is the address part of a localnet, the EdgePort's address on
// it; false when the localnet is written as a network address (host bits zero
// with a shorter prefix than the address) or doesn't parse.
func localnetHost(network string) (string, bool) {
	address := strings.SplitN(network, "/", 2)[0]
	ipnet, ok := parseNet(network)
	if !ok {
		return "", false
	}
	ip := net.ParseIP(address)
	if ip == nil {
		return "", false
	}
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}
	ones, bits := ipnet.Mask.Size()
	if ones < bits && ip.Equal(ipnet.IP) {
		return "", false
	}
	return address, true
}

// portOf reads a port the Location proto carries as a string; anything that
// is not a number reads 0.
func portOf(s string) int32 {
	n, err := strconv.ParseInt(strings.TrimSpace(s), 10, 32)
	if err != nil {
		return 0
	}
	return int32(n)
}

// IsTypeResponse tells whether the message is a SIP response.
func IsTypeResponse(req *MessageRequest) bool {
	_, ok := req.GetMessage().GetMessageType().(*sipmessage.SIPMessage_ResponseType)
	return ok
}

// IsTypeRequest tells whether the message is a SIP request.
func IsTypeRequest(req *MessageRequest) bool {
	return !IsTypeResponse(req)
}

// HasSDP tells whether the message has a body.
func HasSDP(req *MessageRequest) bool {
	return len(req.GetMessage().GetBody()) > 0
}

// IsOK tells whether the message is a 200 response.
func IsOK(req *MessageRequest) bool {
	return req.GetMessage().GetResponseType() == sipmessage.ResponseType_OK
}

// IsRinging tells whether the message is a 180 response.
func IsRinging(req *MessageRequest) bool {
	return req.GetMessage().GetResponseType() == sipmessage.ResponseType_RINGING
}

// IsWebRTC tells whether the transport is a WebSocket one, WS or WSS.
func IsWebRTC(t common.Transport) bool {
	return t == common.Transport_WS || t == common.Transport_WSS
}

// IsInviteWithSDP tells whether the message is an INVITE with a body.
func IsInviteWithSDP(req *MessageRequest) bool {
	return IsTypeRequest(req) && HasSDP(req) && req.GetMethod() == Method_INVITE
}

// IsAckWithSDP tells whether the message is an ACK with a body.
func IsAckWithSDP(req *MessageRequest) bool {
	return IsTypeRequest(req) && HasSDP(req) && req.GetMethod() == Method_ACK
}

// IsInviteOrAckWithSDP tells whether the message is an INVITE or an ACK with
// a body.
func IsInviteOrAckWithSDP(req *MessageRequest) bool {
	return IsInviteWithSDP(req) || IsAckWithSDP(req)
}

// IsResponseWithSDP tells whether the message is a response with a body.
func IsResponseWithSDP(req *MessageRequest) bool {
	return IsTypeResponse(req) && HasSDP(req)
}

// IsOKOrRingingWithSDP tells whether the message is a 200 or a 180 response
// with a body.
func IsOKOrRingingWithSDP(req *MessageRequest) bool {
	return IsResponseWithSDP(req) && (IsOK(req) || IsRinging(req))
}

// IsBye tells whether the message is a BYE request.
func IsBye(req *MessageRequest) bool {
	return IsTypeRequest(req) && req.GetMethod() == Method_BYE
}

func contains(list []string, value string) bool {
	for _, v := range list {
		if v == value {
			return true
		}
	}
	return false
}

func containsFold(list []string, value string) bool {
	for _, v := range list {
		if strings.EqualFold(v, value) {
			return true
		}
	}
	return false
}
