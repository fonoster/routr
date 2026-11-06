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
	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// verifyDigest checks the request's Authorization against the credentials:
// a new challenge when the digest is wrong, a stale one when it is right but
// the nonce has expired, nil when it passes.
func (c *Connect) verifyDigest(req *ppb.MessageRequest, creds auth.Credentials) *ppb.MessageResponse {
	authorization := req.GetMessage().GetAuthorization()
	realm := req.GetMessage().GetRequestUri().GetHost()
	calculated := auth.CalculateResponse(auth.Challenge{
		Realm:      authorization.GetRealm(),
		Nonce:      authorization.GetNonce(),
		NonceCount: authorization.GetNonceCount(),
		CNonce:     authorization.GetCNonce(),
		Qop:        authorization.GetQop(),
		URI:        authorization.GetUri(),
		Method:     req.GetMethod().String(),
	}, creds)
	if calculated != authorization.GetResponse() {
		return challenge(realm, c.nonce(), false)
	}
	if !auth.IsNonceFresh(authorization.GetNonce(), c.nonceMaxAge, c.now) {
		return challenge(realm, c.nonce(), true)
	}
	return nil
}

// credentialsFrom is what a resource authenticates with. A resource without
// Credentials, or with Credentials without a username, has nothing to
// authenticate with and is refused: the Node code computed the digest over
// empty strings, so an endpoint that knew it could register as any such
// resource.
func credentialsFrom(creds *credentials.Credentials) (auth.Credentials, bool) {
	if creds == nil || creds.GetUsername() == "" {
		return auth.Credentials{}, false
	}
	return auth.Credentials{Username: creds.GetUsername(), Secret: creds.GetPassword()}, true
}

// checkAgentOrPeerAccess is access.checkAgentOrPeerAccess: an Agent or a Peer
// placing a call authenticates with its credentials; without an Authorization
// it is challenged, and without credentials it is forbidden.
func (c *Connect) checkAgentOrPeerAccess(req *ppb.MessageRequest, caller *resource) *ppb.MessageResponse {
	if req.GetMessage().GetAuthorization() == nil {
		return challenge(req.GetMessage().GetRequestUri().GetHost(), c.nonce(), false)
	}
	creds, ok := credentialsFrom(caller.credentials())
	if !ok {
		c.log.Debug("caller has no credentials to authenticate with", "ref", req.GetRef(), "caller", caller.ref())
		return forbidden()
	}
	return c.verifyDigest(req, creds)
}

// checkAccessFromPSTN is access.checkAccessFromPSTN, with the Trunk the request
// handler already found for the Request-URI host. The call must reach a Number
// of that Trunk, from an address in its access control list, with its
// credentials when it has them.
//
// The source is the top Via's "received" value (set by the SIP stack when the
// packet came from another address), not the sender, which is copied from the
// Via host and can be forged. Only allow entries are read (CONNECT.md).
func (c *Connect) checkAccessFromPSTN(req *ppb.MessageRequest, callee *resource, trunk *trunks.Trunk) *ppb.MessageResponse {
	if !callee.isNumber() || trunk == nil || callee.number.GetTrunk().GetRef() != trunk.GetRef() {
		return forbidden()
	}
	if list := trunk.GetAccessControlList(); list != nil {
		source := sourceAddress(req)
		allowed := false
		for _, network := range list.GetAllow() {
			if hasIP(network, source) {
				allowed = true
				break
			}
		}
		if !allowed {
			return unauthorizedWithoutChallenge()
		}
	}
	inbound := trunk.GetInboundCredentials()
	if inbound == nil {
		return nil
	}
	if req.GetMessage().GetAuthorization() == nil {
		return challenge(req.GetMessage().GetRequestUri().GetHost(), c.nonce(), false)
	}
	creds, ok := credentialsFrom(inbound)
	if !ok {
		c.log.Debug("trunk has empty inbound credentials", "ref", req.GetRef(), "trunk", trunk.GetRef())
		return forbidden()
	}
	return c.verifyDigest(req, creds)
}

// checkAccess is access.checkAccess: the access check for the direction. A
// call in an unknown direction is forbidden.
func (c *Connect) checkAccess(req *ppb.MessageRequest, caller, callee *resource, trunk *trunks.Trunk, dir direction) *ppb.MessageResponse {
	switch dir {
	case directionAgentToAgent, directionAgentToPeer, directionAgentToPSTN, directionPeerToAgent, directionPeerToPSTN:
		return c.checkAgentOrPeerAccess(req, caller)
	case directionFromPSTN:
		return c.checkAccessFromPSTN(req, callee, trunk)
	default:
		return forbidden()
	}
}
