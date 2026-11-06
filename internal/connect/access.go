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
	"strconv"
	"strings"

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
	if !digestURIMatches(req, authorization.GetUri()) {
		c.log.Debug("the digest uri names another target", "ref", req.GetRef(), "uri", authorization.GetUri())
		return challenge(realm, c.nonce(), false)
	}
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

// digestURIMatches tells whether a digest was computed for this request, so a
// captured Authorization can't be replayed toward another target (RFC 3261
// section 22.4). User, host and port are what is compared: a transport or other
// parameter may come and go, and a user the Trunk normalized to E.164 is
// compared normalized. SIPp puts the address it sends to in the digest, here
// this EdgePort, with no user; every SEET recording in etc/corpus does, so that
// form passes too.
func digestURIMatches(req *ppb.MessageRequest, digestURI string) bool {
	user, host, port, ok := parseDigestURI(digestURI)
	if !ok {
		return false
	}
	target := req.GetMessage().GetRequestUri()
	if strings.EqualFold(host, strings.Trim(target.GetHost(), "[]")) && samePort(port, target.GetPort()) && sameDigestUser(user, target.GetUser()) {
		return true
	}
	return user == "" && isOwnAddress(req, host, port)
}

// parseDigestURI reads the user, host and port of a sip or sips URI; port 0
// when it names none.
func parseDigestURI(digestURI string) (user, host string, port int32, ok bool) {
	scheme, rest, found := strings.Cut(digestURI, ":")
	if !found || (!strings.EqualFold(scheme, "sip") && !strings.EqualFold(scheme, "sips")) {
		return "", "", 0, false
	}
	if i := strings.IndexAny(rest, ";?"); i >= 0 {
		rest = rest[:i]
	}
	if i := strings.LastIndex(rest, "@"); i >= 0 {
		user, _, _ = strings.Cut(rest[:i], ":")
		rest = rest[i+1:]
	}
	host = rest
	if h, p, err := net.SplitHostPort(rest); err == nil {
		n, err := strconv.ParseInt(p, 10, 32)
		if err != nil {
			return "", "", 0, false
		}
		host, port = h, int32(n)
	}
	host = strings.Trim(host, "[]")
	return user, host, port, host != ""
}

// samePort compares URI ports; a URI that names none is on the default port.
// The proto reads -1 or 0 for none.
func samePort(a, b int32) bool {
	if a <= 0 {
		a = 0
	}
	if b <= 0 {
		b = 0
	}
	switch {
	case a == b:
		return true
	case a == 0:
		return b == 5060 || b == 5061
	case b == 0:
		return a == 5060 || a == 5061
	}
	return false
}

func sameDigestUser(digestUser, targetUser string) bool {
	if digestUser == targetUser {
		return true
	}
	normalized, ok := normalizeToE164(digestUser)
	return ok && normalized == targetUser
}

// isOwnAddress tells whether host:port is this EdgePort: one of its local or
// external addresses or aliases, on a port it listens on.
func isOwnAddress(req *ppb.MessageRequest, host string, port int32) bool {
	own := contains(req.GetExternalAddrs(), host) || containsFold(req.GetAliases(), host)
	for _, network := range req.GetLocalnets() {
		own = own || strings.SplitN(network, "/", 2)[0] == host
	}
	if !own {
		return false
	}
	for _, lp := range req.GetListeningPoints() {
		if samePort(port, lp.GetPort()) {
			return true
		}
	}
	return false
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
