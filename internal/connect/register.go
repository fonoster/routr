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

	"github.com/fonoster/routr/internal/common/auth"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// handleRegister is handlers/register.ts: a REGISTER without credentials is
// challenged; one with them is verified against the Agent's, bound in the
// Location with its expiry, and answered with the Contact it registered.
func (c *Connect) handleRegister(ctx context.Context, req *ppb.MessageRequest) *ppb.MessageResponse {
	realm := req.GetMessage().GetRequestUri().GetHost()
	switch {
	case req.GetMessage().GetAuthorization() != nil:
		from := req.GetMessage().GetFrom().GetAddress().GetUri()
		agent := c.findResource(ctx, from.GetHost(), from.GetUser())
		if agent == nil {
			return forbidden()
		}
		creds := agent.GetCredentials()
		if res := c.verifyDigest(req, auth.Credentials{Username: creds.GetUsername(), Secret: creds.GetPassword()}); res != nil {
			return res
		}
		_, err := c.location.AddRoute(ctx, &lpb.AddRouteRequest{
			Aor:         targetAOR(req),
			Route:       createRoute(req, int32(c.registerDefaultExpires), c.now),
			MaxContacts: agent.GetMaxContacts(),
		})
		if err != nil {
			if s, ok := status.FromError(err); ok && s.Code() == codes.InvalidArgument {
				c.log.Debug(s.Message(), "ref", req.GetRef())
				return forbiddenWith(s.Message())
			}
			c.log.Error("unable to add route", "ref", req.GetRef(), "error", err)
			return internalServerError()
		}
		return registerOK(req, recordingMetadata(agent, agent.GetDomain()))
	case hasConnectToken(req):
		// Connect Tokens are milestone 2; without a verifier Routr 2 refuses
		// the token the same way
		c.log.Debug("unable to validate connect token", "ref", req.GetRef(), "originalError", "no verifier configured")
		return forbidden()
	default:
		return challenge(realm, c.nonce(), false)
	}
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
	if err := removeSelfRoutes(req); err != nil {
		return c.failure(req, err)
	}
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
