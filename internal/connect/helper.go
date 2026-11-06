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
	"net"
	"strings"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The platform headers Routr adds or reads (mods/common/src/types.ts ExtraHeader)
const (
	headerGatewayAuth   = "X-Gateway-Auth"
	headerEdgePortRef   = "X-Edgeport-Ref"
	headerSessionCount  = "X-Session-Count"
	headerConnectToken  = "X-Connect-Token"
	headerCallDirection = "X-Call-Direction"
)

// noListeningPointError says a route wants a transport this EdgePort does not
// listen on (mods/common/src/errors.ts NoListeningPointError).
type noListeningPointError struct {
	transport string
}

func (e *noListeningPointError) Error() string {
	return fmt.Sprintf("no listening point found for transport %s; add the transport to the EdgePort's spec.transport (and spec.securityContext for tls or wss)", e.transport)
}

// getListeningPoint is Helper.getListeningPoint: the listening point for a
// transport, UDP when none is named.
func getListeningPoint(listeningPoints []*ppb.NetInterface, transport string) (*ppb.NetInterface, error) {
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

// parseNet reads a network as IpUtils.formatNet accepts it: an address (a
// /32 or /128), a CIDR, or an address with a dotted IPv4 mask.
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

// hasIP is IpUtils.hasIp: whether the address is in the network. An address
// that is not an IP is in no network.
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

// getLocalnetIP is IpUtils.getLocalnetIp: the address part of the first
// localnet the host belongs to.
func getLocalnetIP(localnets []string, host string) (string, bool) {
	for _, network := range localnets {
		if hasIP(network, host) {
			return strings.SplitN(network, "/", 2)[0], true
		}
	}
	return "", false
}

// edgeNets are the networks an interface is chosen from: a request's or a
// route's listening points, localnets and external addresses.
type edgeNets struct {
	listeningPoints []*ppb.NetInterface
	localnets       []string
	externalAddrs   []string
}

func netsOfRequest(req *ppb.MessageRequest) edgeNets {
	return edgeNets{req.GetListeningPoints(), req.GetLocalnets(), req.GetExternalAddrs()}
}

// getEdgeInterface is Helper.getEdgeInterface: the interface this EdgePort
// talks to an endpoint from. A local address when the endpoint is in one of
// the localnets, else the first external address, on the listening point of
// the endpoint's transport.
func getEdgeInterface(nets edgeNets, endpointHost, endpointTransport string) (*ppb.NetInterface, error) {
	localnetIP, local := getLocalnetIP(nets.localnets, endpointHost)
	lp, err := getListeningPoint(nets.listeningPoints, endpointTransport)
	if err != nil {
		return nil, err
	}
	host := localnetIP
	if !local {
		if len(nets.externalAddrs) == 0 {
			return nil, fmt.Errorf("unable to find a valid interface for host %s and transport %s", endpointHost, lp.GetTransport())
		}
		host = nets.externalAddrs[0]
	}
	if local && lp.GetHost() != "0.0.0.0" && lp.GetHost() != host {
		return nil, fmt.Errorf("listening point host %s does not match interface host %s", lp.GetHost(), host)
	}
	return &ppb.NetInterface{Host: host, Port: lp.GetPort(), Transport: lp.GetTransport()}, nil
}

// getHeaderValue is Extensions.getHeaderValue: the value of the first
// extension header of that name, ignoring case; empty when absent.
func getHeaderValue(req *ppb.MessageRequest, name string) string {
	for _, ext := range req.GetMessage().GetExtensions() {
		if strings.EqualFold(ext.GetName(), name) {
			return ext.GetValue()
		}
	}
	return ""
}

// isResponse is Helper.isTypeResponse: the message is a SIP response.
func isResponse(req *ppb.MessageRequest) bool {
	_, ok := req.GetMessage().GetMessageType().(*spb.SIPMessage_ResponseType)
	return ok
}

// isInDialog tells whether a request belongs to an existing dialog: RFC 3261
// section 12.2, a request inside a dialog carries the To tag the dialog was
// established with.
func isInDialog(req *ppb.MessageRequest) bool {
	return req.GetMessage().GetTo().GetTag() != ""
}

// hasConnectToken tells whether the request carries an X-Connect-Token.
func hasConnectToken(req *ppb.MessageRequest) bool {
	return getHeaderValue(req, headerConnectToken) != ""
}

// sourceAddress is the address the request came from: the top Via's
// "received" value, which the SIP stack sets when the packet's source differs
// from the Via host (RFC 3261 section 18.2.1), or the Via host otherwise.
func sourceAddress(req *ppb.MessageRequest) string {
	vias := req.GetMessage().GetVia()
	if len(vias) == 0 {
		return ""
	}
	if r := vias[0].GetReceived(); r != "" {
		return r
	}
	return vias[0].GetHost()
}

// edgePortTrust names the peer EdgePorts whose forwarded requests are honored.
type edgePortTrust struct {
	refs      []string
	addresses []string
}

// isFromTrustedEdgePort tells whether a request carrying X-Edgeport-Ref was
// forwarded by a trusted peer EdgePort. The header value alone proves nothing
// (anyone can set it), so the source address must be in the trusted
// addresses; when refs are listed, the header value must be one of them.
func isFromTrustedEdgePort(req *ppb.MessageRequest, trust edgePortTrust) bool {
	ref := getHeaderValue(req, headerEdgePortRef)
	if ref == "" {
		return false
	}
	if len(trust.refs) > 0 && !contains(trust.refs, ref) {
		return false
	}
	return isFromTrustedAddress(req, trust)
}

// isFromTrustedAddress tells whether a request came from one of the trusted
// EdgePort addresses, whatever headers it carries: the check for a request
// one of Routr's own senders makes without an X-Edgeport-Ref, such as the
// Registry's REGISTER through the Requester. The default, no addresses,
// trusts no source.
func isFromTrustedAddress(req *ppb.MessageRequest, trust edgePortTrust) bool {
	addr := sourceAddress(req)
	if addr == "" {
		return false
	}
	for _, network := range trust.addresses {
		if hasIP(network, addr) {
			return true
		}
	}
	return false
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
