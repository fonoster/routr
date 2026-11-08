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
	headerDODNumber     = "X-DOD-Number"
	headerDODPrivacy    = "X-DOD-Privacy"
	headerAccessKeyID   = "X-Access-Key-Id"
	headerAppRef        = "X-App-Ref"
)

// defaultUntrustedHeaders are the platform headers a caller must never be
// able to set (mods/connect/src/envs.ts DEFAULT_UNTRUSTED_HEADERS_TO_STRIP).
var defaultUntrustedHeaders = []string{
	"X-App-Ref",
	"X-Call-Ref",
	"X-Call-Direction",
	"X-DOD-Number",
	"X-DOD-Privacy",
	"X-Access-Key-Id",
	"X-Is-Api-Originated-Type",
	"X-Edgeport-Ref",
	"X-Gateway-Auth",
	"X-Request-Uri",
	"X-Session-Count",
}

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
// localnet the host belongs to. A localnet written as a network (its host bits
// zero, 10.0.0.0/8) names no interface and is passed over: its address would
// be the same on every EdgePort.
func getLocalnetIP(localnets []string, host string) (string, bool) {
	for _, network := range localnets {
		if own, ok := localnetHost(network); ok && hasIP(network, host) {
			return own, true
		}
	}
	return "", false
}

// localnetHost is the address part of a localnet, this EdgePort's address on
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

// untrustedHeadersToStrip is utils.getUntrustedHeadersToStrip: the headers to
// remove from a request before it is forwarded. Requests from authenticated
// Agents and Peers keep theirs. Requests from the PSTN, and requests
// authorized only by a Connect Token, do not, so a caller can't spoof them;
// a client with a verified Connect Token keeps its X-App-Ref.
func untrustedHeadersToStrip(dir direction, withConnectToken bool, headers []string) []string {
	if withConnectToken {
		kept := make([]string, 0, len(headers))
		for _, h := range headers {
			if !strings.EqualFold(h, headerAppRef) {
				kept = append(kept, h)
			}
		}
		return kept
	}
	if dir == directionFromPSTN || dir == directionUnknown {
		return headers
	}
	return nil
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

// edgePortTrust names the peer EdgePorts whose forwarded requests are honored,
// and, apart from them, the Requesters whose X-Gateway-Auth is.
type edgePortTrust struct {
	refs       []string
	addresses  []string
	registries []string
	// registryNames are the Requesters known by name; nil when none is
	registryNames *registryNames
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
	return isFromAddresses(req, trust.addresses)
}

// isFromRegistry tells whether a request came from a Requester the Registry
// sends through, which is what X-Gateway-Auth needs and all it grants.
func isFromRegistry(req *ppb.MessageRequest, trust edgePortTrust) bool {
	return isFromAddresses(req, trust.registries) || trust.registryNames.contains(sourceAddress(req))
}

// isFromAddresses tells whether a request's source is in the networks, whatever
// headers it carries. No networks trust no source.
func isFromAddresses(req *ppb.MessageRequest, networks []string) bool {
	addr := sourceAddress(req)
	if addr == "" {
		return false
	}
	for _, network := range networks {
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
