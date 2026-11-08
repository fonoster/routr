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
	"context"

	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// challengeBeforeRouting tells whether an INVITE is challenged before it is
// routed. A caller that isn't a Trunk must authenticate, and the challenge
// needs nothing from the database, so the lookups routing makes are kept for
// the INVITE that carries the credentials. A call from a Trunk is checked
// after routing, against the Trunk's own settings, and a call with a Connect
// Token is verified by it.
func challengeBeforeRouting(req *ppb.MessageRequest, trunk *trunks.Trunk) bool {
	return req.GetMethod() == ppb.Method_INVITE &&
		trunk == nil &&
		req.GetMessage().GetAuthorization() == nil &&
		!hasConnectToken(req)
}

func sipURI(user, host string) string {
	if user != "" {
		return "sip:" + user + "@" + host
	}
	return "sip:" + host
}

// tailor is tailor.ts: the request as it leaves toward the route.
func tailor(req *ppb.MessageRequest, r *route) error {
	recordRouteParameters := applyTrunkIdentity(req, r)
	decreaseMaxForwards(req)
	removeAuthorization(req)
	removeSelfRoutes(req)
	removeXEdgePortRef(req)
	fixInvalidContact(req)
	fixRequestURI(req, r)
	if err := addSelfVia(req, r); err != nil {
		return err
	}
	applyXHeaders(req, r.headers)
	if err := addSelfRecordRoute(req, r, recordRouteParameters); err != nil {
		return err
	}
	addRouteToNextHop(req, r)
	return nil
}

// toPeerEdgePort sends the request to the EdgePort the route lives on, which
// rebuilds the route from the message alone.
func toPeerEdgePort(req *ppb.MessageRequest, r *route) error {
	// The peer EdgePort rebuilds the route from the message alone, without the
	// Trunk's settings, so the caller identity is applied here
	recordRouteParameters := applyTrunkIdentity(req, r)
	// A Route the caller preloaded toward this EdgePort (an outbound proxy
	// setting) is consumed here, as the tailor does; left in, it would follow
	// the new route set and send the call back to us
	removeSelfRoutes(req)
	if err := addSelfVia(req, r); err != nil {
		return err
	}
	if err := addSelfRecordRouteToPeer(req, r, recordRouteParameters); err != nil {
		return err
	}
	// Each alteration puts its Route on top, so the one applied last is the
	// first hop: the peer EdgePort, then the next hop after it
	addRouteToNextHop(req, r)
	if err := addRouteToPeerEdgePort(req, r); err != nil {
		return err
	}
	addXEdgePortRef(req)
	decreaseMaxForwards(req)
	return nil
}

// handleRequest is handlers/request.ts: an out-of-dialog request is routed
// as a new call, challenged first when it carries no credentials, and
// tailored toward its route.
func (c *Connect) handleRequest(ctx context.Context, req *ppb.MessageRequest) *ppb.MessageResponse {
	host := req.GetMessage().GetRequestUri().GetHost()
	trunk, err := c.findInboundTrunk(ctx, host)
	if err != nil {
		return c.failure(req, err)
	}

	// A Trunk with normalizeToE164 gets its calls normalized before routing,
	// which finds the Number by the Request-URI user. Calls toward a Trunk are
	// normalized after routing, by the tailor.
	if trunk.GetNormalizeToE164() {
		normalizeE164Alteration(req)
	}

	// X-Edgeport-Ref marks a request forwarded by a peer EdgePort, whose route
	// is rebuilt from the message without routing or access checks. Honor it
	// only from a trusted peer EdgePort. Anyone else could use it to relay
	// calls through Routr (toll fraud), so remove it and route the request
	// normally.
	fromTrustedEdgePort := isFromTrustedEdgePort(req, c.trust)
	if !fromTrustedEdgePort && getHeaderValue(req, headerEdgePortRef) != "" {
		c.log.Warn("ignoring X-Edgeport-Ref from an untrusted source", "ref", req.GetRef(), "edgePortRef", req.GetEdgePortRef(), "source", sourceAddress(req))
		removeXEdgePortRef(req)
	}

	var r *route
	// A CANCEL must follow the exact path its INVITE took (RFC 3261 section
	// 9.1); it is never a new call to route. The EdgePort forwards it from the
	// INVITE's own client transaction and only needs a non-error answer here.
	if fromTrustedEdgePort || req.GetMethod() == ppb.Method_CANCEL {
		r = routeFromPB(createRouteFromLastMessage(req, c.now))
	} else {
		if challengeBeforeRouting(req, trunk) {
			return challenge(host, c.nonce(), false)
		}
		result := c.router(ctx, req, trunk)
		if result.response != nil {
			return result.response
		}
		if result.route == nil {
			return temporarilyUnavailable()
		}
		// Remove platform headers a caller from an untrusted source (the PSTN,
		// say) could have spoofed. Routr adds its own values afterwards.
		removeHeaders(req, untrustedHeadersToStrip(result.direction, hasConnectToken(req), c.untrustedHeaders))
		r = result.route
		r.headers = append(r.headers, headerModifier{name: headerCallDirection, value: string(result.direction)})
	}

	// The token has done its work; the next hop has no business with it
	removeHeaders(req, []string{headerConnectToken})

	if req.GetEdgePortRef() != r.edgePortRef {
		if err := toPeerEdgePort(req, r); err != nil {
			return c.failure(req, err)
		}
		return forward(req, req.GetMetadata())
	}

	if err := tailor(req, r); err != nil {
		return c.failure(req, err)
	}
	return forward(req, r.metadata)
}
