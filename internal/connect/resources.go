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
	"sync"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// direction is the routing direction of a call (mods/connect/src/types.ts).
type direction string

const (
	directionAgentToAgent direction = "agent-to-agent"
	directionAgentToPSTN  direction = "agent-to-pstn"
	directionUnknown      direction = "unknown"
)

// findDomain is the Domain whose domainUri is the given host, nil when none.
func (c *Connect) findDomain(ctx context.Context, domainURI string) (*domains.Domain, error) {
	res, err := c.domains.FindBy(ctx, &domains.FindByRequest{FieldName: "domainUri", FieldValue: domainURI})
	if err != nil {
		return nil, err
	}
	if items := res.GetItems(); len(items) > 0 {
		return items[0], nil
	}
	return nil, nil
}

// findAgent is the Agent with the given username, nil when none.
func (c *Connect) findAgent(ctx context.Context, username string) (*agents.Agent, error) {
	res, err := c.agents.FindBy(ctx, &agents.FindByRequest{FieldName: "username", FieldValue: username})
	if err != nil {
		return nil, err
	}
	if items := res.GetItems(); len(items) > 0 {
		return items[0], nil
	}
	return nil, nil
}

// findResource is utils.findResource for the resources milestone 1 knows:
// the Agent named by the user part, when it belongs to the Domain named by
// the host. Numbers and Peers come with milestone 2. The two lookups are
// independent, so they run together. As in Routr 2, a lookup that fails
// finds nothing; the failure is logged.
func (c *Connect) findResource(ctx context.Context, host, user string) *agents.Agent {
	var (
		wg     sync.WaitGroup
		domain *domains.Domain
		agent  *agents.Agent
		errD   error
		errA   error
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		domain, errD = c.findDomain(ctx, host)
	}()
	go func() {
		defer wg.Done()
		agent, errA = c.findAgent(ctx, user)
	}()
	wg.Wait()
	for _, err := range []error{errD, errA} {
		if err == nil || status.Code(err) == codes.NotFound {
			continue
		}
		c.log.Error("unable to find resource", "host", host, "user", user, "error", err)
		return nil
	}
	if agent == nil {
		return nil
	}
	if domain == nil || agent.GetDomain().GetRef() != domain.GetRef() {
		// Not in the same domain
		return nil
	}
	return agent
}

// findResources looks the caller and the callee up at once: one plan per
// call, each resource fetched once.
func (c *Connect) findResources(ctx context.Context, req *ppb.MessageRequest) (caller, callee *agents.Agent) {
	from := req.GetMessage().GetFrom().GetAddress().GetUri()
	to := req.GetMessage().GetRequestUri()
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		caller = c.findResource(ctx, from.GetHost(), from.GetUser())
	}()
	go func() {
		defer wg.Done()
		callee = c.findResource(ctx, to.GetHost(), to.GetUser())
	}()
	wg.Wait()
	return caller, callee
}

// findInboundTrunk is the Trunk a call from the PSTN arrives through: the one
// whose inboundUri is the given host. Nil when no Trunk answers to the host,
// or without a Trunks client, as the Node code does without an API client.
func (c *Connect) findInboundTrunk(ctx context.Context, host string) *trunks.Trunk {
	if c.trunks == nil {
		return nil
	}
	res, err := c.trunks.FindBy(ctx, &trunks.FindByRequest{FieldName: "inboundUri", FieldValue: host})
	if err != nil {
		if status.Code(err) != codes.NotFound {
			c.log.Error("unable to find inbound trunk", "host", host, "error", err)
		}
		return nil
	}
	if items := res.GetItems(); len(items) > 0 {
		return items[0]
	}
	return nil
}

// routingDirection is utils.getRoutingDirection for the resources milestone
// 1 knows: Agents. A caller or callee that is not an Agent is unknown.
func routingDirection(caller, callee *agents.Agent) direction {
	switch {
	case caller != nil && callee != nil:
		return directionAgentToAgent
	case caller != nil:
		return directionAgentToPSTN
	default:
		return directionUnknown
	}
}

// verifyDigest checks the request's Authorization against the credentials:
// a new challenge when the digest is wrong, a stale one when it is right but
// the nonce has expired, nil when it passes.
func (c *Connect) verifyDigest(req *ppb.MessageRequest, credentials auth.Credentials) *ppb.MessageResponse {
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
	}, credentials)
	if calculated != authorization.GetResponse() {
		return challenge(realm, c.nonce(), false)
	}
	if !auth.IsNonceFresh(authorization.GetNonce(), c.nonceMaxAge, c.now) {
		return challenge(realm, c.nonce(), true)
	}
	return nil
}

// credentialsOf is what an Agent authenticates with. An Agent without
// Credentials, or with Credentials without a username, has nothing to
// authenticate with and is refused: the Node code computed the digest over
// empty strings, so an endpoint that knew it could register as any such
// Agent.
func credentialsOf(agent *agents.Agent) (auth.Credentials, bool) {
	creds := agent.GetCredentials()
	if creds == nil || creds.GetUsername() == "" {
		return auth.Credentials{}, false
	}
	return auth.Credentials{Username: creds.GetUsername(), Secret: creds.GetPassword()}, true
}

// checkAgentAccess is access.checkAgentOrPeerAccess: an Agent placing a call
// authenticates with its credentials; without an Authorization it is
// challenged, and without credentials it is forbidden.
func (c *Connect) checkAgentAccess(req *ppb.MessageRequest, caller *agents.Agent) *ppb.MessageResponse {
	if req.GetMessage().GetAuthorization() == nil {
		return challenge(req.GetMessage().GetRequestUri().GetHost(), c.nonce(), false)
	}
	creds, ok := credentialsOf(caller)
	if !ok {
		c.log.Debug("agent has no credentials to authenticate with", "ref", req.GetRef(), "agent", caller.GetRef())
		return forbidden()
	}
	return c.verifyDigest(req, creds)
}

// checkAccess is access.checkAccess: the access check for the direction. A
// call in an unknown direction is forbidden.
func (c *Connect) checkAccess(req *ppb.MessageRequest, caller *agents.Agent, dir direction) *ppb.MessageResponse {
	switch dir {
	case directionAgentToAgent, directionAgentToPSTN:
		return c.checkAgentAccess(req, caller)
	default:
		return forbidden()
	}
}
