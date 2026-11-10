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
	"strconv"
	"strings"
	"time"

	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/location"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The route functions of @routr/location's helper. The unexported ones mirror
// internal/connect's route.go: a fix in one goes to the other, with its case
// ported.

// headerSessionCount is the header an endpoint reports its sessions with on a
// REGISTER.
const headerSessionCount = "X-Session-Count"

// CreateRoute is the route a REGISTER binds: to the address the request came
// from (the top Via's received and rport, RFC 3581) with the From user, as
// seen from the request's EdgePort. Its expiry is TargetExpires(req,
// defaultExpires), which a caller usually passes DefaultExpires for, and its
// session count is the request's X-Session-Count, -1 when absent.
//
// It is what a REGISTER handler hands to Location's AddRoute. A request
// without a Via gives a route with an empty host; the Node twin throws there.
func CreateRoute(req *MessageRequest, defaultExpires int32) *location.Route {
	return createRoute(req, defaultExpires, time.Now)
}

// transportOf maps a transport name to the enum, UDP when unknown.
func transportOf(name string) common.Transport {
	if v, ok := common.Transport_value[strings.ToUpper(name)]; ok {
		return common.Transport(v)
	}
	return common.Transport_UDP
}

// sessionCountOf reads X-Session-Count, which an endpoint reports on its
// REGISTER; -1 when absent.
func sessionCountOf(req *MessageRequest) int32 {
	value := HeaderValue(req, headerSessionCount)
	if value == "" {
		return -1
	}
	n, err := strconv.ParseInt(strings.TrimSpace(value), 10, 32)
	if err != nil {
		return 0
	}
	return int32(n)
}

// buildRoute is a route to the given URI as seen from this request's
// EdgePort.
func buildRoute(req *MessageRequest, uri *sipmessage.SipURI, defaultExpires int32, now func() time.Time) *location.Route {
	var via *sipmessage.Via
	if vias := req.GetMessage().GetVia(); len(vias) > 0 {
		via = vias[0]
	}
	return &location.Route{
		EdgePortRef:     req.GetEdgePortRef(),
		User:            uri.GetUser(),
		Host:            uri.GetHost(),
		Port:            strconv.Itoa(int(uri.GetPort())),
		AdvertisedHost:  via.GetHost(),
		AdvertisedPort:  strconv.Itoa(int(via.GetPort())),
		Transport:       transportOf(uri.GetTransportParam()),
		RegisteredOn:    now().UnixMilli(),
		SessionCount:    sessionCountOf(req),
		Expires:         TargetExpires(req, defaultExpires),
		ListeningPoints: req.GetListeningPoints(),
		Localnets:       req.GetLocalnets(),
		ExternalAddrs:   req.GetExternalAddrs(),
	}
}

// createRoute is CreateRoute on a clock.
func createRoute(req *MessageRequest, defaultExpires int32, now func() time.Time) *location.Route {
	var via *sipmessage.Via
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
	uri := &sipmessage.SipURI{
		Host:           host,
		Port:           port,
		TransportParam: strings.ToUpper(via.GetTransport()),
		User:           req.GetMessage().GetFrom().GetAddress().GetUri().GetUser(),
	}
	return buildRoute(req, uri, defaultExpires, now)
}
