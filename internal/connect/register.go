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
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// handleRegister is handlers/register.ts: a REGISTER without credentials is
// challenged; one with them is verified against the Agent's or the Peer's,
// bound in the Location with its expiry, and answered with the Contact it
// registered. A Peer binds at its own AOR, an Agent at the To's. A REGISTER
// with a Connect Token binds at the token's AOR.
func (c *Connect) handleRegister(ctx context.Context, req *ppb.MessageRequest) *ppb.MessageResponse {
	realm := req.GetMessage().GetRequestUri().GetHost()
	switch {
	case req.GetMessage().GetAuthorization() != nil:
		from := req.GetMessage().GetFrom().GetAddress().GetUri()
		endpoint := c.findResource(ctx, from.GetHost(), from.GetUser())
		if endpoint == nil {
			return forbidden()
		}
		creds, ok := credentialsFrom(endpoint.credentials())
		if !ok {
			c.log.Debug("resource has no credentials to authenticate with", "ref", req.GetRef(), "resource", endpoint.ref())
			return forbidden()
		}
		if res := c.verifyDigest(req, creds); res != nil {
			return res
		}
		aor := targetAOR(req)
		if endpoint.peer != nil {
			aor = endpoint.peer.GetAor()
		}
		if res := c.addRoute(ctx, req, aor, endpoint.maxContacts()); res != nil {
			return res
		}
		return registerOK(req, recordingMetadata(traceablesOf(endpoint)...))
	case hasConnectToken(req):
		return c.registerWithToken(ctx, req)
	default:
		return challenge(realm, c.nonce(), false)
	}
}

// addRoute binds the REGISTER's route at the AOR; nil when it was bound, the
// answer otherwise. A binding the Location refuses is a 403 with its reason.
func (c *Connect) addRoute(ctx context.Context, req *ppb.MessageRequest, aor string, maxContacts int32) *ppb.MessageResponse {
	_, err := c.location.AddRoute(ctx, &lpb.AddRouteRequest{
		Aor:         aor,
		Route:       createRoute(req, int32(c.registerDefaultExpires), c.now),
		MaxContacts: maxContacts,
	})
	if err == nil {
		return nil
	}
	if s, ok := status.FromError(err); ok && s.Code() == codes.InvalidArgument {
		c.log.Debug(s.Message(), "ref", req.GetRef())
		return forbiddenWith(s.Message())
	}
	c.log.Error("unable to add route", "ref", req.GetRef(), "error", err)
	return internalServerError()
}

// registerWithToken registers the endpoint a Connect Token names. Anything
// wrong with the token, or no verifier to read it with, is a 403.
func (c *Connect) registerWithToken(ctx context.Context, req *ppb.MessageRequest) *ppb.MessageResponse {
	if c.verifyToken == nil {
		c.log.Debug("unable to validate connect token", "ref", req.GetRef(), "originalError", "no verifier configured")
		return forbidden()
	}
	claims, err := c.verifyToken(ctx, getHeaderValue(req, headerConnectToken))
	if err != nil {
		c.log.Debug("unable to validate connect token", "ref", req.GetRef(), "originalError", err)
		return forbidden()
	}
	if !claims.allows(ppb.Method_REGISTER) {
		return forbidden()
	}
	_, err = c.location.AddRoute(ctx, &lpb.AddRouteRequest{
		Aor:         claims.AOR,
		Route:       createRoute(req, int32(c.registerDefaultExpires), c.now),
		MaxContacts: claims.maxContacts(),
	})
	if err != nil {
		// handlers/register.ts answers any failure of this branch the same
		c.log.Debug("unable to validate connect token", "ref", req.GetRef(), "originalError", err)
		return forbidden()
	}
	return registerOK(req, nil)
}

// handleRegistry is handlers/registry.ts: the REGISTER the Registry sends
// on behalf of a Trunk goes to the provider as it is, minus the gateway
// credentials the EdgePort consumed.
func (c *Connect) handleRegistry(req *ppb.MessageRequest) *ppb.MessageResponse {
	r := routeFromPB(createRouteFromLastMessage(req, c.now))
	if err := addSelfVia(req, r); err != nil {
		return c.failure(req, err)
	}
	decreaseMaxForwards(req)
	removeAuthorization(req)
	removeSelfRoutes(req)
	removeXEdgePortRef(req)
	return forward(req, req.GetMetadata())
}

// failure answers a request the processor could not alter: 502 when the
// route wants a transport this EdgePort does not listen on, which is a
// configuration problem on our side of the call, 500 otherwise.
func (c *Connect) failure(req *ppb.MessageRequest, err error) *ppb.MessageResponse {
	var nlp *noListeningPointError
	if errors.As(err, &nlp) {
		c.log.Error(err.Error(), "ref", req.GetRef(), "edgePortRef", req.GetEdgePortRef(), "transport", nlp.transport)
		return badGateway()
	}
	c.log.Error(err.Error(), "ref", req.GetRef(), "edgePortRef", req.GetEdgePortRef())
	return internalServerError()
}
