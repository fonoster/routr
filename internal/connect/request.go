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

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// routing is what the router decided: the route and its direction, or the
// answer that ends the request instead.
type routing struct {
	route     *route
	direction direction
	response  *ppb.MessageResponse
}

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

// router is router.ts for the directions milestone 1 routes: a call between
// two Agents goes to the callee's registered contact. Agent-to-PSTN, calls
// from the PSTN and Peers come with milestone 2 and get the answer Routr 2
// gives when it finds no route for them.
func (c *Connect) router(ctx context.Context, req *ppb.MessageRequest) routing {
	if hasConnectToken(req) {
		// Connect Tokens are milestone 2; without a verifier Routr 2 answers
		// the same
		c.log.Error("unable to validate connect token: no verifier configured", "ref", req.GetRef())
		return routing{response: serverInternalError()}
	}

	caller, callee := c.findResources(ctx, req)
	dir := routingDirection(caller, callee)
	from := req.GetMessage().GetFrom().GetAddress().GetUri()
	to := req.GetMessage().GetRequestUri()
	c.log.Debug("routing request",
		"ref", req.GetRef(),
		"fromURI", sipURI(from.GetUser(), from.GetHost()),
		"requestURI", sipURI(to.GetUser(), to.GetHost()),
		"routingDirection", string(dir))

	if req.GetMethod() == ppb.Method_INVITE {
		if res := c.checkAccess(req, caller, dir); res != nil {
			return routing{response: res}
		}
	}

	switch dir {
	case directionAgentToAgent:
		res, err := c.location.FindRoutes(ctx, &lpb.FindRoutesRequest{Aor: targetAOR(req), CallId: req.GetRef()})
		if err != nil {
			if status.Code(err) == codes.NotFound {
				return routing{direction: dir}
			}
			c.log.Error("unable to find routes", "ref", req.GetRef(), "error", err)
			return routing{response: internalServerError()}
		}
		routes := res.GetRoutes()
		if len(routes) == 0 {
			return routing{direction: dir}
		}
		r := routeFromPB(routes[0])
		r.metadata = routeMetadata(caller.GetExtended(), dir, caller, caller.GetDomain(), callee, callee.GetDomain())
		return routing{route: r, direction: dir}
	case directionAgentToPSTN:
		c.log.Warn("agent-to-pstn routing is not available until milestone 2", "ref", req.GetRef())
		return routing{direction: dir}
	default:
		c.log.Error("unsupported routing direction: "+string(dir), "ref", req.GetRef())
		return routing{response: internalServerError()}
	}
}

func sipURI(user, host string) string {
	if user != "" {
		return "sip:" + user + "@" + host
	}
	return "sip:" + host
}

// tailor is tailor.ts: the request as it leaves toward the route.
func tailor(req *ppb.MessageRequest, r *route) error {
	decreaseMaxForwards(req)
	removeAuthorization(req)
	if err := removeSelfRoutes(req); err != nil {
		return err
	}
	removeXEdgePortRef(req)
	fixInvalidContact(req)
	fixRequestURI(req, r)
	if err := addSelfVia(req, r); err != nil {
		return err
	}
	applyXHeaders(req, r.headers)
	if err := addSelfRecordRoute(req, r, nil); err != nil {
		return err
	}
	addRouteToNextHop(req, r)
	return nil
}

// toPeerEdgePort sends the request to the EdgePort the route lives on, which
// rebuilds the route from the message alone.
func toPeerEdgePort(req *ppb.MessageRequest, r *route) error {
	// A Route the caller preloaded toward this EdgePort (an outbound proxy
	// setting) is consumed here, as the tailor does; left in, it would follow
	// the new route set and send the call back to us
	if err := removeSelfRoutes(req); err != nil {
		return err
	}
	if err := addSelfVia(req, r); err != nil {
		return err
	}
	if err := addSelfRecordRoute(req, r, nil); err != nil {
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
	trunk := c.findInboundTrunk(ctx, host)

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
		if trunk != nil {
			// Calls from the PSTN are milestone 2
			c.log.Warn("from-pstn routing is not available until milestone 2", "ref", req.GetRef(), "trunk", trunk.GetRef())
			return forbidden()
		}
		result := c.router(ctx, req)
		if result.response != nil {
			return result.response
		}
		if result.route == nil && result.direction == directionAgentToPSTN {
			return notFound()
		}
		if result.route == nil {
			return temporarilyUnavailable()
		}
		r = result.route
		r.headers = append(r.headers, headerModifier{name: headerCallDirection, value: string(result.direction)})
	}

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
