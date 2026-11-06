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
	"strconv"
	"strings"
	"time"

	"github.com/fonoster/routr/internal/common/pb/common"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// headerModifier is a header a route adds to, or removes from, the request on
// its way out (mods/common/src/types.ts HeaderModifier).
type headerModifier struct {
	name   string
	value  string
	remove bool
}

// route is a Location route plus what Connect decides about it in process:
// the headers to apply and the metadata for the dispatcher (the Node Route
// type, mods/common/src/types.ts). Ports are numbers here; the Location
// proto carries them as strings.
type route struct {
	user            string
	host            string
	port            int32
	advertisedHost  string
	advertisedPort  int32
	transport       string
	registeredOn    int64
	sessionCount    int32
	expires         int32
	edgePortRef     string
	listeningPoints []*ppb.NetInterface
	localnets       []string
	externalAddrs   []string
	headers         []headerModifier
	metadata        map[string]string
}

func (r *route) nets() edgeNets {
	return edgeNets{r.listeningPoints, r.localnets, r.externalAddrs}
}

// portOf reads a port the Location proto carries as a string; the Node
// code coerced it the way protobufjs does, so anything else reads 0.
func portOf(s string) int32 {
	n, err := strconv.ParseInt(strings.TrimSpace(s), 10, 32)
	if err != nil {
		return 0
	}
	return int32(n)
}

// routeFromPB is the in-process view of a route the Location returned.
func routeFromPB(r *lpb.Route) *route {
	return &route{
		user:            r.GetUser(),
		host:            r.GetHost(),
		port:            portOf(r.GetPort()),
		advertisedHost:  r.GetAdvertisedHost(),
		advertisedPort:  portOf(r.GetAdvertisedPort()),
		transport:       r.GetTransport().String(),
		registeredOn:    r.GetRegisteredOn(),
		sessionCount:    r.GetSessionCount(),
		expires:         r.GetExpires(),
		edgePortRef:     r.GetEdgePortRef(),
		listeningPoints: r.GetListeningPoints(),
		localnets:       r.GetLocalnets(),
		externalAddrs:   r.GetExternalAddrs(),
	}
}

// transportOf maps a transport name to the enum, UDP when unknown.
func transportOf(name string) common.Transport {
	if v, ok := common.Transport_value[strings.ToUpper(name)]; ok {
		return common.Transport(v)
	}
	return common.Transport_UDP
}

// targetAOR is Target.getTargetAOR: the address of record the request's To
// names, sip:user@host (sips for a secure URI).
func targetAOR(req *ppb.MessageRequest) string {
	uri := req.GetMessage().GetTo().GetAddress().GetUri()
	scheme := "sip"
	if uri.GetSecure() {
		scheme = "sips"
	}
	if uri.GetUser() != "" {
		return scheme + ":" + uri.GetUser() + "@" + uri.GetHost()
	}
	return scheme + ":" + uri.GetHost()
}

// targetExpires is Target.getTargetExpires: the Contact's expires parameter
// takes precedence over the Expires header; the default when neither names
// one (RFC 3261 section 10.3, step 7).
func targetExpires(req *ppb.MessageRequest, defaultExpires int32) int32 {
	expires := int32(-1)
	if c := req.GetMessage().GetContact(); c != nil {
		expires = c.GetExpires()
	}
	if expires > -1 {
		return expires
	}
	if e := req.GetMessage().GetExpires(); e != nil && e.GetExpires() > -1 {
		return e.GetExpires()
	}
	return defaultExpires
}

// sessionCountOf reads X-Session-Count, which an endpoint reports on its
// REGISTER; -1 when absent.
func sessionCountOf(req *ppb.MessageRequest) int32 {
	value := getHeaderValue(req, headerSessionCount)
	if value == "" {
		return -1
	}
	n, err := strconv.ParseInt(strings.TrimSpace(value), 10, 32)
	if err != nil {
		return 0
	}
	return int32(n)
}

// buildRoute is the Location helper's buildRoute: a route to the given URI as
// seen from this request's EdgePort.
func buildRoute(req *ppb.MessageRequest, uri *spb.SipURI, defaultExpires int32, now func() time.Time) *lpb.Route {
	var via *spb.Via
	if vias := req.GetMessage().GetVia(); len(vias) > 0 {
		via = vias[0]
	}
	return &lpb.Route{
		EdgePortRef:     req.GetEdgePortRef(),
		User:            uri.GetUser(),
		Host:            uri.GetHost(),
		Port:            strconv.Itoa(int(uri.GetPort())),
		AdvertisedHost:  via.GetHost(),
		AdvertisedPort:  strconv.Itoa(int(via.GetPort())),
		Transport:       transportOf(uri.GetTransportParam()),
		RegisteredOn:    now().UnixMilli(),
		SessionCount:    sessionCountOf(req),
		Expires:         targetExpires(req, defaultExpires),
		ListeningPoints: req.GetListeningPoints(),
		Localnets:       req.GetLocalnets(),
		ExternalAddrs:   req.GetExternalAddrs(),
	}
}

// createRoute is the Location helper's createRoute: the route a REGISTER
// binds, to the address the request came from (the top Via's received and
// rport, RFC 3581) with the From user.
func createRoute(req *ppb.MessageRequest, defaultExpires int32, now func() time.Time) *lpb.Route {
	var via *spb.Via
	if vias := req.GetMessage().GetVia(); len(vias) > 0 {
		via = vias[0]
	}
	host := via.GetReceived()
	if host == "" {
		host = via.GetHost()
	}
	port := via.GetPort()
	if via.GetRPort() != -1 {
		port = via.GetRPort()
	}
	uri := &spb.SipURI{
		Host:           host,
		Port:           port,
		TransportParam: strings.ToUpper(via.GetTransport()),
		User:           req.GetMessage().GetFrom().GetAddress().GetUri().GetUser(),
	}
	return buildRoute(req, uri, defaultExpires, now)
}

// createRouteFromLastMessage is the Location helper's createRouteFromLastMessage:
// a request traversing a second EdgePort has its Request-URI updated, so the
// route is rebuilt from the request itself.
func createRouteFromLastMessage(req *ppb.MessageRequest, now func() time.Time) *lpb.Route {
	return buildRoute(req, req.GetMessage().GetRequestUri(), DefaultRegisterExpires, now)
}
