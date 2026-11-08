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
	"net"
	"strings"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The alterations of mods/processor/src/alterations.ts. Each one changes the
// request in place: the processor works on its own copy of the message it
// received (ProcessMessage clones it once), so the copy the Node code made
// per step is not needed.

// fixRequestURI points the Request-URI at the route: host, port and
// transport, and the registered user when the route is a registration.
func fixRequestURI(req *ppb.MessageRequest, r *route) {
	uri := req.GetMessage().GetRequestUri()
	if uri == nil {
		uri = &spb.SipURI{}
		req.Message.MessageType = &spb.SIPMessage_RequestUri{RequestUri: uri}
	}
	if r.registeredOn != 0 && r.user != "" {
		uri.User = r.user
	}
	uri.Host = r.host
	uri.Port = r.port
	uri.TransportParam = r.transport
}

func prependVia(req *ppb.MessageRequest, intf *ppb.NetInterface) {
	via := &spb.Via{
		Host:      intf.GetHost(),
		Port:      intf.GetPort(),
		Transport: intf.GetTransport().String(),
		RPortFlag: true,
	}
	req.Message.Via = append([]*spb.Via{via}, req.Message.Via...)
}

// addSelfVia adds this EdgePort's Via toward the route's endpoint: on the
// interface facing it, from the route's networks when the route is on this
// EdgePort and the request's otherwise.
func addSelfVia(req *ppb.MessageRequest, r *route) error {
	nets := netsOfRequest(req)
	if req.GetEdgePortRef() == r.edgePortRef {
		nets = r.nets()
	}
	intf, err := getEdgeInterface(nets, r.host, r.transport)
	if err != nil {
		return err
	}
	prependVia(req, intf)
	return nil
}

// addSelfViaUsingExternalAddrs adds this EdgePort's Via toward the
// Request-URI, which an in-dialog request already points at the remote target.
// fromPeer says the request came from a trusted peer EdgePort.
func addSelfViaUsingExternalAddrs(req *ppb.MessageRequest, fromPeer bool) error {
	uri := req.GetMessage().GetRequestUri()
	transport := uri.GetTransportParam()
	if transport == "" {
		// No transport means UDP. A peer EdgePort sends the Request-URI with
		// no parameters, so a request from one goes on the transport it came
		// on, which its Via names; so does one on an EdgePort without UDP.
		if _, err := getListeningPoint(req.GetListeningPoints(), "UDP"); err != nil || fromPeer {
			transport = req.GetSender().GetTransport().String()
		}
	}
	intf, err := getEdgeInterface(netsOfRequest(req), uri.GetHost(), transport)
	if err != nil {
		return err
	}
	prependVia(req, intf)
	return nil
}

// addSelfViaTowardNextHop is addSelfViaUsingExternalAddrs, unless the next
// hop is a peer EdgePort's own address (a dialog that crossed EdgePorts): then
// the Via faces the peer, on the transport the request goes to it on.
func addSelfViaTowardNextHop(req *ppb.MessageRequest, fromPeer bool) error {
	if routes := req.GetMessage().GetRoute(); len(routes) > 0 && isPeerRoute(req, routes[0]) {
		uri := routes[0].GetAddress().GetUri()
		intf, err := getEdgeInterface(netsOfRequest(req), uri.GetHost(), uri.GetTransportParam())
		if err != nil {
			return err
		}
		prependVia(req, intf)
		return nil
	}
	return addSelfViaUsingExternalAddrs(req, fromPeer)
}

// isPeerRoute tells whether a Route entry looks like a peer EdgePort's own
// address: not this EdgePort, inside its localnets, on the port it listens on
// for that transport.
func isPeerRoute(req *ppb.MessageRequest, entry *spb.Route) bool {
	uri := entry.GetAddress().GetUri()
	lp, err := getListeningPoint(req.GetListeningPoints(), uri.GetTransportParam())
	if err != nil || lp.GetPort() != uri.GetPort() || isSelfRoute(req, entry) {
		return false
	}
	_, local := getLocalnetIP(req.GetLocalnets(), uri.GetHost())
	return local
}

func prependRoute(req *ppb.MessageRequest, host string, port int32, transport string) {
	entry := &spb.Route{
		Address: &spb.Address{
			Uri: &spb.SipURI{Host: host, Port: port, TransportParam: transport, LrParam: true},
		},
	}
	req.Message.Route = append([]*spb.Route{entry}, req.Message.Route...)
}

// addRouteToNextHop puts the route's endpoint on top of the route set, unless
// the Request-URI already names its host.
func addRouteToNextHop(req *ppb.MessageRequest, r *route) {
	if req.GetMessage().GetRequestUri().GetHost() == r.host {
		return
	}
	prependRoute(req, r.host, r.port, r.transport)
}

// addRouteToPeerEdgePort puts the peer EdgePort the route lives on on top of
// the route set: at its own address when it is on one of this EdgePort's
// localnets, else on its interface facing the endpoint. That interface is the
// peer's external address for an endpoint outside its localnets, which behind
// a load balancer every EdgePort shares: the request could land on any of
// them, and only the peer holds the endpoint's connection.
func addRouteToPeerEdgePort(req *ppb.MessageRequest, r *route) error {
	if host, ok := peerOwnAddress(req, r); ok {
		lp, err := getListeningPoint(r.listeningPoints, r.transport)
		if err != nil {
			return err
		}
		prependRoute(req, host, lp.GetPort(), lp.GetTransport().String())
		return nil
	}
	intf, err := getEdgeInterface(r.nets(), r.host, r.transport)
	if err != nil {
		return err
	}
	prependRoute(req, intf.GetHost(), intf.GetPort(), intf.GetTransport().String())
	return nil
}

// applyXHeaders applies the route's header modifiers. An added header
// replaces any copy already in the request (case-insensitive), so a
// caller-supplied value can never sit next to the one Routr adds.
func applyXHeaders(req *ppb.MessageRequest, headers []headerModifier) {
	if len(headers) == 0 {
		return
	}
	var drop []string
	var add []headerModifier
	for _, h := range headers {
		drop = append(drop, h.name)
		if !h.remove {
			add = append(add, h)
		}
	}
	kept := req.Message.Extensions[:0:0]
	for _, ext := range req.Message.Extensions {
		if !containsFold(drop, ext.GetName()) {
			kept = append(kept, ext)
		}
	}
	for _, h := range add {
		kept = append(kept, &spb.Extension{Name: h.name, Value: h.value})
	}
	req.Message.Extensions = kept
}

func recordRouteEntry(user string, intf *ppb.NetInterface, params map[string]string) *spb.RecordRoute {
	return &spb.RecordRoute{
		Address: &spb.Address{
			Uri: &spb.SipURI{
				User:           user,
				Host:           intf.GetHost(),
				Port:           intf.GetPort(),
				TransportParam: intf.GetTransport().String(),
				LrParam:        true,
			},
		},
		Parameters: params,
	}
}

// addSelfRecordRoute adds this EdgePort to the Record-Route set: the
// interface the request came in on and, when the endpoint is reached through
// another one, that interface too, both marked r2=on (RFC 3261 section
// 16.6, double Record-Route). The parameters are the identity mapping, in
// the URI user part, which a user agent keeps (RFC 3261 section 12.1.2).
func addSelfRecordRoute(req *ppb.MessageRequest, r *route, parameters map[string]string) error {
	nets := netsOfRequest(req)
	sender := req.GetSender()
	originHost := sender.GetHost()
	if r.peerSource != "" {
		originHost = r.peerSource
	}
	origin, err := getEdgeInterface(nets, originHost, sender.GetTransport().String())
	if err != nil {
		return err
	}
	target, err := getEdgeInterface(nets, r.advertisedHost, r.transport)
	if err != nil {
		return err
	}
	recordRouteBetween(req, origin, target, parameters)
	return nil
}

// addSelfRecordRouteToPeer is addSelfRecordRoute for a request forwarded to the
// peer EdgePort the route lives on: the target interface is this EdgePort's
// internal one facing the peer (peerFacingInterface), so the dialog's route
// set names both EdgePorts by their own addresses (RFC 5658 double
// Record-Route) and a later in-dialog request reaches the one that holds each
// side's connection. Without such an interface it is addSelfRecordRoute.
func addSelfRecordRouteToPeer(req *ppb.MessageRequest, r *route, parameters map[string]string) error {
	target, ok := peerFacingInterface(req, r)
	if !ok {
		return addSelfRecordRoute(req, r, parameters)
	}
	sender := req.GetSender()
	origin, err := getEdgeInterface(netsOfRequest(req), sender.GetHost(), sender.GetTransport().String())
	if err != nil {
		return err
	}
	recordRouteBetween(req, origin, target, parameters)
	return nil
}

// peerFacingInterface is this EdgePort's address on the localnet that the peer
// EdgePort the route lives on is in, on the listening point of the route's
// transport. The peer is looked for at the interface this request goes to and,
// when that one is its external address (an endpoint outside its localnets),
// at its own localnet addresses. False when the peer is in none of this
// EdgePort's localnets.
func peerFacingInterface(req *ppb.MessageRequest, r *route) (*ppb.NetInterface, bool) {
	lp, err := getListeningPoint(req.GetListeningPoints(), r.transport)
	if err != nil {
		return nil, false
	}
	hosts := make([]string, 0, len(r.localnets)+1)
	if intf, err := getEdgeInterface(r.nets(), r.host, r.transport); err == nil {
		hosts = append(hosts, intf.GetHost())
	}
	for _, network := range r.localnets {
		if host, ok := localnetHost(network); ok {
			hosts = append(hosts, host)
		}
	}
	for _, host := range hosts {
		if isLoopback(host) {
			continue
		}
		if ip, ok := getLocalnetIP(req.GetLocalnets(), host); ok && !isLoopback(ip) {
			return &ppb.NetInterface{Host: ip, Port: lp.GetPort(), Transport: lp.GetTransport()}, true
		}
	}
	return nil, false
}

// peerOwnAddress is the address of the peer EdgePort the route lives on, on
// the first of its localnets that is in one of this EdgePort's localnets;
// false when they share none.
func peerOwnAddress(req *ppb.MessageRequest, r *route) (string, bool) {
	for _, network := range r.localnets {
		host, ok := localnetHost(network)
		if !ok || isLoopback(host) {
			continue
		}
		if _, shared := getLocalnetIP(req.GetLocalnets(), host); shared {
			return host, true
		}
	}
	return "", false
}

// isLoopback tells whether a host is a loopback address, which every
// EdgePort has and none can reach another on.
func isLoopback(host string) bool {
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// recordRouteBetween puts this EdgePort on top of the Record-Route set: the
// origin interface and, when the target interface differs, that one too, both
// marked r2=on.
func recordRouteBetween(req *ppb.MessageRequest, origin, target *ppb.NetInterface, parameters map[string]string) {
	user := identityUser(parameters)
	if origin.GetHost() != target.GetHost() || origin.GetPort() != target.GetPort() || origin.GetTransport() != target.GetTransport() {
		r2 := map[string]string{"r2": "on"}
		req.Message.RecordRoute = append([]*spb.RecordRoute{
			recordRouteEntry(user, target, map[string]string{"r2": "on"}),
			recordRouteEntry(user, origin, r2),
		}, req.Message.RecordRoute...)
		return
	}
	req.Message.RecordRoute = append([]*spb.RecordRoute{recordRouteEntry(user, origin, nil)}, req.Message.RecordRoute...)
}

// addXEdgePortRef marks the request as forwarded by this EdgePort.
func addXEdgePortRef(req *ppb.MessageRequest) {
	ext := &spb.Extension{Name: headerEdgePortRef, Value: req.GetEdgePortRef()}
	req.Message.Extensions = append([]*spb.Extension{ext}, req.Message.Extensions...)
}

// removeXEdgePortRef removes every X-Edgeport-Ref, whatever its case.
func removeXEdgePortRef(req *ppb.MessageRequest) {
	removeHeaders(req, []string{headerEdgePortRef})
}

// removeHeaders removes every extension whose name is one of the given
// names (case-insensitive).
func removeHeaders(req *ppb.MessageRequest, names []string) {
	if len(names) == 0 {
		return
	}
	kept := req.Message.Extensions[:0:0]
	for _, ext := range req.Message.Extensions {
		if !containsFold(names, ext.GetName()) {
			kept = append(kept, ext)
		}
	}
	req.Message.Extensions = kept
}

// removeAuthorization drops the credentials before the request leaves.
func removeAuthorization(req *ppb.MessageRequest) {
	req.Message.Authorization = nil
}

// isSelfRoute tells whether a Route entry points at this EdgePort: one of its
// local or external addresses or aliases, on the port of the matching
// listening point. Aliases compare case-insensitively (RFC 3261 section
// 19.1.4). A Route on a transport this EdgePort does not listen on is not
// this EdgePort's: it stays for the next hop, which is what the Node
// alteration threw NoListeningPointError at.
func isSelfRoute(req *ppb.MessageRequest, entry *spb.Route) bool {
	uri := entry.GetAddress().GetUri()
	lp, err := getListeningPoint(req.GetListeningPoints(), uri.GetTransportParam())
	if err != nil {
		return false
	}
	host := uri.GetHost()
	local := false
	for _, network := range req.GetLocalnets() {
		if strings.SplitN(network, "/", 2)[0] == host {
			local = true
			break
		}
	}
	ours := local || contains(req.GetExternalAddrs(), host) || containsFold(req.GetAliases(), host)
	return ours && uri.GetPort() == lp.GetPort()
}

// isOwnRoute tells whether a Route entry points at this EdgePort by its own
// address, one of its localnet addresses: no peer EdgePort has it, which an
// external address or an alias shared behind a load balancer can't tell.
func isOwnRoute(req *ppb.MessageRequest, entry *spb.Route) bool {
	host := entry.GetAddress().GetUri().GetHost()
	for _, network := range req.GetLocalnets() {
		if own, ok := localnetHost(network); ok && own == host {
			return isSelfRoute(req, entry)
		}
	}
	return false
}

// removeRoutesUpToOwn consumes, in a dialog that crossed EdgePorts, every
// Route entry up to the last one that names this EdgePort by its own address.
// In route-set order (RFC 3261 section 12.1.2: the UAC reverses Record-Route,
// the UAS keeps it) that entry is this EdgePort's toward the Request-URI's
// target; the ones before it are this EdgePort's and its peers' toward the
// sender, where the request has already been. Left in, a peer's internal entry
// would send the request back to the peer, and from there to a target whose
// connection it does not hold. Without such an entry, nothing changes.
func removeRoutesUpToOwn(req *ppb.MessageRequest) {
	routes := req.GetMessage().GetRoute()
	for i := len(routes) - 1; i >= 0; i-- {
		if isOwnRoute(req, routes[i]) {
			req.Message.Route = routes[i+1:]
			return
		}
	}
}

// removeSelfRoutes consumes the Route entries that point at this EdgePort.
func removeSelfRoutes(req *ppb.MessageRequest) {
	kept := req.Message.Route[:0:0]
	for _, entry := range req.Message.Route {
		if !isSelfRoute(req, entry) {
			kept = append(kept, entry)
		}
	}
	req.Message.Route = kept
}

// removeTopVia drops the Via this EdgePort added, on a response's way back.
func removeTopVia(req *ppb.MessageRequest) {
	if len(req.GetMessage().GetVia()) > 0 {
		req.Message.Via = req.Message.Via[1:]
	}
}

// decreaseMaxForwards counts this hop (RFC 3261 section 16.6, step 3).
func decreaseMaxForwards(req *ppb.MessageRequest) {
	if mf := req.GetMessage().GetMaxForwards(); mf != nil {
		mf.MaxForwards--
	}
}

// fixInvalidContact rewrites a Contact at a .invalid host (a WebRTC client,
// RFC 7118) to the address the request came from.
func fixInvalidContact(req *ppb.MessageRequest) {
	contact := req.GetMessage().GetContact()
	if contact == nil || !strings.Contains(contact.GetAddress().GetUri().GetHost(), ".invalid") {
		return
	}
	vias := req.GetMessage().GetVia()
	if len(vias) == 0 {
		return
	}
	via := vias[0]
	uri := contact.GetAddress().GetUri()
	uri.Host = via.GetReceived()
	if uri.Host == "" {
		uri.Host = via.GetHost()
	}
	uri.Port = via.GetPort()
	if via.GetRPort() != -1 {
		uri.Port = via.GetRPort()
	}
	uri.TransportParam = strings.ToUpper(via.GetTransport())
}
