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
// this EdgePort's: it stays for the next hop, which is what the Node
// alteration throws NoListeningPointError at.
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
// Connect does: RFC 3261 section 16.4 strips a Route only when it names this
// proxy. The Node twin throws NoListeningPointError there.
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
