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
	"net"
	"strings"

	"github.com/fonoster/routr/pkg/processor/pb/location"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The alterations of mods/processor/src/alterations.ts. Each one changes the
// request in place: the processor owns the copy of the message it received,
// so the copy the Node code makes per step is not needed. Where the Node twin
// threw, the alteration returns an error and leaves the request as it was.
//
// The route is Location's own *location.Route, what FindRoutes returns; its
// ports, which the proto carries as strings, are parsed here.

// FixRequestURI points the Request-URI at the route: host, port and
// transport, and the registered user when the route is a registration.
func FixRequestURI(req *MessageRequest, route *location.Route) {
	uri := req.GetMessage().GetRequestUri()
	if uri == nil {
		uri = &sipmessage.SipURI{}
		req.Message.MessageType = &sipmessage.SIPMessage_RequestUri{RequestUri: uri}
	}
	if route.GetRegisteredOn() != 0 && route.GetUser() != "" {
		uri.User = route.GetUser()
	}
	uri.Host = route.GetHost()
	uri.Port = portOf(route.GetPort())
	uri.TransportParam = route.GetTransport().String()
}

func prependVia(req *MessageRequest, host string, port int32, transport string) {
	via := &sipmessage.Via{Host: host, Port: port, Transport: transport, RPortFlag: true}
	req.Message.Via = append([]*sipmessage.Via{via}, req.Message.Via...)
}

// AddSelfVia adds this EdgePort's Via, with the rport flag, toward the
// route's endpoint: on the interface facing it, from the route's networks
// when the route is on this EdgePort and the request's otherwise. It returns
// EdgeInterface's errors.
func AddSelfVia(req *MessageRequest, route *location.Route) error {
	nets := NetsOf(req)
	if req.GetEdgePortRef() == route.GetEdgePortRef() {
		nets = NetsOfRoute(route)
	}
	intf, err := EdgeInterface(nets, route.GetHost(), route.GetTransport())
	if err != nil {
		return err
	}
	prependVia(req, intf.GetHost(), intf.GetPort(), intf.GetTransport().String())
	return nil
}

// AddSelfViaUsingTheRouteHeaders adds a top Via built from the request's
// Route headers: the only one, or the second when there are several. The
// transport is UDP when the entry names none. A request without Route headers
// stays as it is. An entry without a URI is an error.
func AddSelfViaUsingTheRouteHeaders(req *MessageRequest) error {
	routes := req.GetMessage().GetRoute()
	if len(routes) == 0 {
		return nil
	}
	egress := routes[0]
	if len(routes) > 1 {
		egress = routes[1]
	}
	uri := egress.GetAddress().GetUri()
	if uri == nil {
		return errors.New("the egress Route header has no URI")
	}
	transport := strings.ToUpper(uri.GetTransportParam())
	if transport == "" {
		transport = "UDP"
	}
	prependVia(req, uri.GetHost(), uri.GetPort(), transport)
	return nil
}

// AddSelfViaUsingExternalAddrs adds this EdgePort's Via toward the
// Request-URI, which an in-dialog request already points at the remote
// target: on the interface facing its host, on its transport parameter (UDP
// when it names none). It returns EdgeInterface's errors.
func AddSelfViaUsingExternalAddrs(req *MessageRequest) error {
	uri := req.GetMessage().GetRequestUri()
	intf, err := edgeInterface(NetsOf(req), uri.GetHost(), uri.GetTransportParam())
	if err != nil {
		return err
	}
	prependVia(req, intf.GetHost(), intf.GetPort(), intf.GetTransport().String())
	return nil
}

func prependRoute(req *MessageRequest, host string, port int32, transport string) {
	entry := &sipmessage.Route{
		Address: &sipmessage.Address{
			Uri: &sipmessage.SipURI{Host: host, Port: port, TransportParam: transport, LrParam: true},
		},
	}
	req.Message.Route = append([]*sipmessage.Route{entry}, req.Message.Route...)
}

// AddRouteToNextHop puts the route's endpoint on top of the route set, as a
// loose route, unless the Request-URI already names its host.
func AddRouteToNextHop(req *MessageRequest, route *location.Route) {
	if req.GetMessage().GetRequestUri().GetHost() == route.GetHost() {
		return
	}
	prependRoute(req, route.GetHost(), portOf(route.GetPort()), route.GetTransport().String())
}

// AddRouteToPeerEdgePort puts the peer EdgePort the route lives on on top of
// the route set, as a loose route: its interface facing the endpoint, from
// the route's own networks. Use it with AddXEdgePortRef when the target is
// connected to another EdgePort. It returns EdgeInterface's errors.
func AddRouteToPeerEdgePort(req *MessageRequest, route *location.Route) error {
	intf, err := EdgeInterface(NetsOfRoute(route), route.GetHost(), route.GetTransport())
	if err != nil {
		return err
	}
	prependRoute(req, intf.GetHost(), intf.GetPort(), intf.GetTransport().String())
	return nil
}

// HeaderModifier is a header ApplyXHeaders adds to the request, or removes
// from it when Remove is set.
type HeaderModifier struct {
	Name, Value string
	Remove      bool
}

// ApplyXHeaders applies the header modifiers. A removed header goes, whatever
// its case; an added header replaces any copy already in the request
// (case-insensitive), so a caller-supplied value can never sit next to the
// one the processor adds.
//
// In the Node twin the modifiers are the route's headers, a decision Connect
// makes, not Location data; here they are an argument.
func ApplyXHeaders(req *MessageRequest, mods []HeaderModifier) {
	if len(mods) == 0 {
		return
	}
	var drop []string
	var add []HeaderModifier
	for _, h := range mods {
		drop = append(drop, h.Name)
		if !h.Remove {
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
		kept = append(kept, &sipmessage.Extension{Name: h.Name, Value: h.Value})
	}
	req.Message.Extensions = kept
}

func recordRouteEntry(user string, intf *NetInterface, params map[string]string) *sipmessage.RecordRoute {
	return &sipmessage.RecordRoute{
		Address: &sipmessage.Address{
			Uri: &sipmessage.SipURI{
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

// AddSelfRecordRoute adds this EdgePort to the Record-Route set, so the
// dialog's later requests pass through it: the interface the request came in
// on and, when the endpoint is reached through another one, that interface
// too, both marked r2=on (RFC 3261 section 16.6, double Record-Route).
//
// params is the identity mapping from IdentityRewriteParameters, nil when
// there is none. It goes in the URI user part of every entry this adds, which
// a user agent keeps (RFC 3261 section 12.1.2), and not as header parameters,
// which it may drop. It returns EdgeInterface's errors.
func AddSelfRecordRoute(req *MessageRequest, route *location.Route, params map[string]string) error {
	nets := NetsOf(req)
	sender := req.GetSender()
	origin, err := EdgeInterface(nets, sender.GetHost(), sender.GetTransport())
	if err != nil {
		return err
	}
	target, err := EdgeInterface(nets, route.GetAdvertisedHost(), route.GetTransport())
	if err != nil {
		return err
	}
	user := identityUser(params)
	if origin.GetHost() != target.GetHost() || origin.GetPort() != target.GetPort() || origin.GetTransport() != target.GetTransport() {
		req.Message.RecordRoute = append([]*sipmessage.RecordRoute{
			recordRouteEntry(user, target, map[string]string{"r2": "on"}),
			recordRouteEntry(user, origin, map[string]string{"r2": "on"}),
		}, req.Message.RecordRoute...)
		return nil
	}
	req.Message.RecordRoute = append([]*sipmessage.RecordRoute{recordRouteEntry(user, origin, nil)}, req.Message.RecordRoute...)
	return nil
}

// AddXEdgePortRef marks the request as forwarded by this EdgePort: an
// X-Edgeport-Ref header with the request's EdgePort, on top of the extension
// headers.
func AddXEdgePortRef(req *MessageRequest) {
	ext := &sipmessage.Extension{Name: headerEdgePortRef, Value: req.GetEdgePortRef()}
	req.Message.Extensions = append([]*sipmessage.Extension{ext}, req.Message.Extensions...)
}

// RemoveXEdgePortRef removes every X-Edgeport-Ref, whatever its case.
func RemoveXEdgePortRef(req *MessageRequest) {
	RemoveHeaders(req, headerEdgePortRef)
}

// RemoveHeaders removes every extension header whose name is one of the
// given names (case-insensitive).
func RemoveHeaders(req *MessageRequest, names ...string) {
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

// RemoveAuthorization drops the credentials before the request leaves.
func RemoveAuthorization(req *MessageRequest) {
	req.Message.Authorization = nil
}

// isSelfRoute tells whether a Route entry points at this EdgePort: one of its
// local or external addresses or aliases, on the port of the matching
// listening point. Aliases compare case-insensitively (RFC 3261 section
// 19.1.4). A Route on a transport this EdgePort does not listen on is not
// this EdgePort's: it stays for the next hop, as in Connect and the Node
// SDK.
func isSelfRoute(req *MessageRequest, entry *sipmessage.Route) bool {
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

// RemoveSelfRoutes consumes the Route entries that point at this EdgePort:
// those whose host is one of its localnet addresses, external addresses or
// aliases, on the port it listens on for the entry's transport.
//
// An entry on a transport this EdgePort does not listen on is kept, as
// Connect and the Node SDK do: RFC 3261 section 16.4 strips a Route only when
// it names this proxy.
func RemoveSelfRoutes(req *MessageRequest) {
	kept := req.Message.Route[:0:0]
	for _, entry := range req.Message.Route {
		if !isSelfRoute(req, entry) {
			kept = append(kept, entry)
		}
	}
	req.Message.Route = kept
}

// RemoveTopVia drops the first Via, the one this EdgePort added, on a
// response's way back.
func RemoveTopVia(req *MessageRequest) {
	if len(req.GetMessage().GetVia()) > 0 {
		req.Message.Via = req.Message.Via[1:]
	}
}

// DecreaseMaxForwards counts this hop (RFC 3261 section 16.6, step 3), when
// the header is present.
func DecreaseMaxForwards(req *MessageRequest) {
	if mf := req.GetMessage().GetMaxForwards(); mf != nil {
		mf.MaxForwards--
	}
}

// FixInvalidContact rewrites a Contact at a .invalid host (a WebRTC client,
// RFC 7118) to the address the request came from: the top Via's received
// value (or host), rport value (or port) and transport.
func FixInvalidContact(req *MessageRequest) {
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

// OverwriteContactWithSenderInfo sets the Contact's host, port and transport
// to the sender's, when the request has a Contact.
func OverwriteContactWithSenderInfo(req *MessageRequest) {
	uri := req.GetMessage().GetContact().GetAddress().GetUri()
	if uri == nil {
		return
	}
	sender := req.GetSender()
	uri.Host = sender.GetHost()
	uri.Port = sender.GetPort()
	uri.TransportParam = sender.GetTransport().String()
}

// Dialogs that cross EdgePorts. The functions below are Connect's own, for a
// processor that forwards a request to the peer EdgePort holding the
// endpoint's connection when the EdgePorts share one external address (behind
// a load balancer): AddRouteToPeerEdgePort and AddSelfRecordRoute name that
// shared address, so the request, or the dialog's later ones, can land on an
// EdgePort that doesn't hold the connection. These name each EdgePort by its
// own localnet address where it faces the other. AddSelfViaUsingExternalAddrs,
// AddRouteToPeerEdgePort, AddSelfRecordRoute and RemoveSelfRoutes are
// unchanged.
//
// fromPeer and peerSource are what the processor's own trust check decides:
// set them only for a request whose SourceAddress is a peer EdgePort the
// processor trusts. The SDK doesn't decide who is a peer.

// AddSelfViaTowardNextHop adds this EdgePort's Via, with the rport flag, for
// an in-dialog request. When the top Route is a peer EdgePort's own address
// (in one of this EdgePort's localnets, on the port it listens on for the
// entry's transport, and not this EdgePort), the Via faces that peer, on that
// transport. Otherwise it faces the Request-URI as AddSelfViaUsingExternalAddrs
// does, except that a Request-URI with no transport goes on the transport the
// request came on when fromPeer is set (a peer EdgePort sends the Request-URI
// without parameters) or when this EdgePort doesn't listen on UDP. It returns
// EdgeInterface's errors.
func AddSelfViaTowardNextHop(req *MessageRequest, fromPeer bool) error {
	if routes := req.GetMessage().GetRoute(); len(routes) > 0 && isPeerRoute(req, routes[0]) {
		uri := routes[0].GetAddress().GetUri()
		intf, err := edgeInterface(NetsOf(req), uri.GetHost(), uri.GetTransportParam())
		if err != nil {
			return err
		}
		prependVia(req, intf.GetHost(), intf.GetPort(), intf.GetTransport().String())
		return nil
	}
	return addSelfViaUsingExternalAddrsFromPeer(req, fromPeer)
}

// addSelfViaUsingExternalAddrsFromPeer is AddSelfViaUsingExternalAddrs with
// the fallback to the sender's transport AddSelfViaTowardNextHop describes.
func addSelfViaUsingExternalAddrsFromPeer(req *MessageRequest, fromPeer bool) error {
	uri := req.GetMessage().GetRequestUri()
	transport := uri.GetTransportParam()
	if transport == "" {
		if _, err := getListeningPoint(req.GetListeningPoints(), "UDP"); err != nil || fromPeer {
			transport = req.GetSender().GetTransport().String()
		}
	}
	intf, err := edgeInterface(NetsOf(req), uri.GetHost(), transport)
	if err != nil {
		return err
	}
	prependVia(req, intf.GetHost(), intf.GetPort(), intf.GetTransport().String())
	return nil
}

// isPeerRoute tells whether a Route entry looks like a peer EdgePort's own
// address: not this EdgePort, inside its localnets, on the port it listens on
// for that transport.
func isPeerRoute(req *MessageRequest, entry *sipmessage.Route) bool {
	uri := entry.GetAddress().GetUri()
	lp, err := getListeningPoint(req.GetListeningPoints(), uri.GetTransportParam())
	if err != nil || lp.GetPort() != uri.GetPort() || isSelfRoute(req, entry) {
		return false
	}
	_, local := getLocalnetIP(req.GetLocalnets(), uri.GetHost())
	return local
}

// AddRouteToPeerEdgePortOwnAddress puts the peer EdgePort the route lives on
// on top of the route set, as a loose route: at the peer's own address, on
// its listening port for the route's transport, when the peer is on one of
// this EdgePort's localnets (loopback and network-form localnets such as
// 10.244.0.0/16 never count); else on its interface facing the endpoint, as
// AddRouteToPeerEdgePort does. Use it with AddXEdgePortRef. It returns
// EdgeInterface's errors, or an error naming a transport the peer doesn't
// listen on.
func AddRouteToPeerEdgePortOwnAddress(req *MessageRequest, route *location.Route) error {
	if host, ok := peerOwnAddress(req, route); ok {
		lp, err := getListeningPoint(route.GetListeningPoints(), route.GetTransport().String())
		if err != nil {
			return err
		}
		prependRoute(req, host, lp.GetPort(), lp.GetTransport().String())
		return nil
	}
	intf, err := edgeInterface(NetsOfRoute(route), route.GetHost(), route.GetTransport().String())
	if err != nil {
		return err
	}
	prependRoute(req, intf.GetHost(), intf.GetPort(), intf.GetTransport().String())
	return nil
}

// peerOwnAddress is the address of the peer EdgePort the route lives on, on
// the first of its localnets that is in one of this EdgePort's localnets;
// false when they share none.
func peerOwnAddress(req *MessageRequest, route *location.Route) (string, bool) {
	for _, network := range route.GetLocalnets() {
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

// AddSelfRecordRouteFromPeer is AddSelfRecordRoute for a request a trusted
// peer EdgePort forwarded: peerSource is the address it came from (its
// SourceAddress), and the origin entry is the interface facing it instead of
// the sender, whose host is the peer's interface facing the endpoint. An empty
// peerSource gives AddSelfRecordRoute's result. It returns EdgeInterface's
// errors.
func AddSelfRecordRouteFromPeer(req *MessageRequest, route *location.Route, params map[string]string, peerSource string) error {
	nets := NetsOf(req)
	sender := req.GetSender()
	originHost := sender.GetHost()
	if peerSource != "" {
		originHost = peerSource
	}
	origin, err := edgeInterface(nets, originHost, sender.GetTransport().String())
	if err != nil {
		return err
	}
	target, err := edgeInterface(nets, route.GetAdvertisedHost(), route.GetTransport().String())
	if err != nil {
		return err
	}
	recordRouteBetween(req, origin, target, params)
	return nil
}

// AddSelfRecordRouteToPeer is AddSelfRecordRoute for a request forwarded to
// the peer EdgePort the route lives on: the target entry is this EdgePort's
// own localnet address facing the peer, so the dialog's route set names both
// EdgePorts by their own addresses (RFC 5658, double Record-Route) and each
// later in-dialog request reaches the one that holds its target's connection.
// When the peer is in none of this EdgePort's localnets, or this EdgePort
// doesn't listen on the route's transport, it is AddSelfRecordRoute. It
// returns EdgeInterface's errors.
func AddSelfRecordRouteToPeer(req *MessageRequest, route *location.Route, params map[string]string) error {
	target, ok := peerFacingInterface(req, route)
	if !ok {
		return AddSelfRecordRouteFromPeer(req, route, params, "")
	}
	sender := req.GetSender()
	origin, err := edgeInterface(NetsOf(req), sender.GetHost(), sender.GetTransport().String())
	if err != nil {
		return err
	}
	recordRouteBetween(req, origin, target, params)
	return nil
}

// peerFacingInterface is this EdgePort's address on the localnet that the peer
// EdgePort the route lives on is in, on the listening point of the route's
// transport. The peer is looked for at the interface this request goes to and,
// when that one is its external address (an endpoint outside its localnets),
// at its own localnet addresses. False when the peer is in none of this
// EdgePort's localnets.
func peerFacingInterface(req *MessageRequest, route *location.Route) (*NetInterface, bool) {
	lp, err := getListeningPoint(req.GetListeningPoints(), route.GetTransport().String())
	if err != nil {
		return nil, false
	}
	hosts := make([]string, 0, len(route.GetLocalnets())+1)
	if intf, err := edgeInterface(NetsOfRoute(route), route.GetHost(), route.GetTransport().String()); err == nil {
		hosts = append(hosts, intf.GetHost())
	}
	for _, network := range route.GetLocalnets() {
		if host, ok := localnetHost(network); ok {
			hosts = append(hosts, host)
		}
	}
	for _, host := range hosts {
		if isLoopback(host) {
			continue
		}
		if ip, ok := getLocalnetIP(req.GetLocalnets(), host); ok && !isLoopback(ip) {
			return &NetInterface{Host: ip, Port: lp.GetPort(), Transport: lp.GetTransport()}, true
		}
	}
	return nil, false
}

// recordRouteBetween puts this EdgePort on top of the Record-Route set: the
// origin interface and, when the target interface differs, that one too, both
// marked r2=on.
func recordRouteBetween(req *MessageRequest, origin, target *NetInterface, parameters map[string]string) {
	user := identityUser(parameters)
	if origin.GetHost() != target.GetHost() || origin.GetPort() != target.GetPort() || origin.GetTransport() != target.GetTransport() {
		r2 := map[string]string{"r2": "on"}
		req.Message.RecordRoute = append([]*sipmessage.RecordRoute{
			recordRouteEntry(user, target, map[string]string{"r2": "on"}),
			recordRouteEntry(user, origin, r2),
		}, req.Message.RecordRoute...)
		return
	}
	req.Message.RecordRoute = append([]*sipmessage.RecordRoute{recordRouteEntry(user, origin, nil)}, req.Message.RecordRoute...)
}

// isOwnRoute tells whether a Route entry points at this EdgePort by its own
// address, one of its localnet addresses: no peer EdgePort has it, which an
// external address or an alias shared behind a load balancer can't tell.
func isOwnRoute(req *MessageRequest, entry *sipmessage.Route) bool {
	host := entry.GetAddress().GetUri().GetHost()
	for _, network := range req.GetLocalnets() {
		if own, ok := localnetHost(network); ok && own == host {
			return isSelfRoute(req, entry)
		}
	}
	return false
}

// RemoveRoutesUpToOwn consumes, in a dialog that crossed EdgePorts, every
// Route entry up to the last one that names this EdgePort by its own address
// (a localnet address, never a network-form localnet). In route-set order
// (RFC 3261 section 12.1.2: the UAC reverses Record-Route, the UAS keeps it)
// that entry is this EdgePort's toward the target; the ones before it are
// this EdgePort's and its peers' toward the sender, where the request has
// already been. Left in, a peer's entry would send the request back to the
// peer. Without such an entry, nothing changes. Run it before
// RemoveSelfRoutes and AddSelfViaTowardNextHop.
func RemoveRoutesUpToOwn(req *MessageRequest) {
	routes := req.GetMessage().GetRoute()
	for i := len(routes) - 1; i >= 0; i-- {
		if isOwnRoute(req, routes[i]) {
			req.Message.Route = routes[i+1:]
			return
		}
	}
}
