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
	"strings"
	"sync"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// direction is the routing direction of a call (mods/connect/src/types.ts).
type direction string

const (
	directionAgentToAgent direction = "agent-to-agent"
	directionAgentToPeer  direction = "agent-to-peer"
	directionAgentToPSTN  direction = "agent-to-pstn"
	directionFromPSTN     direction = "from-pstn"
	directionPeerToAgent  direction = "peer-to-agent"
	directionPeerToPSTN   direction = "peer-to-pstn"
	directionUnknown      direction = "unknown"
)

// anonymous names the caller and callee a Connect Token stands for.
const anonymous = "anonymous"

// resource is what a user part resolves to (CC.RoutableResourceUnion): one of
// an Agent, a Peer or a Number. A nil resource is something Routr doesn't know,
// which is how a number on the PSTN reads.
type resource struct {
	agent  *agents.Agent
	peer   *peers.Peer
	number *numbers.Number
}

func (r *resource) isAgent() bool  { return r != nil && r.agent != nil }
func (r *resource) isPeer() bool   { return r != nil && r.peer != nil }
func (r *resource) isNumber() bool { return r != nil && r.number != nil }

// ref is the resource's reference; empty for no resource.
func (r *resource) ref() string {
	switch {
	case r.isAgent():
		return r.agent.GetRef()
	case r.isPeer():
		return r.peer.GetRef()
	case r.isNumber():
		return r.number.GetRef()
	}
	return ""
}

// credentials are what an Agent or a Peer authenticates with; a Number has none.
func (r *resource) credentials() *credentials.Credentials {
	switch {
	case r.isAgent():
		return r.agent.GetCredentials()
	case r.isPeer():
		return r.peer.GetCredentials()
	}
	return nil
}

// accessControlList is where an Agent or a Peer may authenticate from: an
// Agent's Domain's list, a Peer's own; nil, no check.
func (r *resource) accessControlList() *acl.AccessControlList {
	switch {
	case r.isAgent():
		return r.agent.GetDomain().GetAccessControlList()
	case r.isPeer():
		return r.peer.GetAccessControlList()
	}
	return nil
}

// extended are the resource's extended attributes, which link a call to an
// account.
func (r *resource) extended() *structpb.Struct {
	switch {
	case r.isAgent():
		return r.agent.GetExtended()
	case r.isPeer():
		return r.peer.GetExtended()
	case r.isNumber():
		return r.number.GetExtended()
	}
	return nil
}

func (r *resource) maxContacts() int32 {
	switch {
	case r.isAgent():
		return r.agent.GetMaxContacts()
	case r.isPeer():
		return r.peer.GetMaxContacts()
	}
	return 0
}

// traceablesOf lists what the resources can ask for recording through, in order
// of precedence: each resource, then its Domain. A Number has no trace settings.
func traceablesOf(resources ...*resource) []traceable {
	var out []traceable
	for _, r := range resources {
		switch {
		case r.isAgent():
			out = append(out, r.agent, r.agent.GetDomain())
		case r.isPeer():
			out = append(out, r.peer)
		}
	}
	return out
}

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

// findNumber is the Number with the given tel URL, nil when none or without a
// Numbers client.
func (c *Connect) findNumber(ctx context.Context, telURL string) (*numbers.Number, error) {
	if c.numbers == nil {
		return nil, nil
	}
	res, err := c.numbers.FindBy(ctx, &numbers.FindByRequest{FieldName: "telUrl", FieldValue: telURL})
	if err != nil {
		return nil, err
	}
	if items := res.GetItems(); len(items) > 0 {
		return items[0], nil
	}
	return nil, nil
}

// findPeer is the Peer whose field has the value, nil when none or without a
// Peers client.
func (c *Connect) findPeer(ctx context.Context, field, value string) (*peers.Peer, error) {
	if c.peers == nil {
		return nil, nil
	}
	res, err := c.peers.FindBy(ctx, &peers.FindByRequest{FieldName: field, FieldValue: value})
	if err != nil {
		return nil, err
	}
	if items := res.GetItems(); len(items) > 0 {
		return items[0], nil
	}
	return nil, nil
}

// findResource is utils.findResource: first a Number, next an Agent of the
// Domain the host names, next a Peer, each lookup only when the one before
// found nothing. An Agent of another Domain finds nothing at all, Peers
// included. As in Routr 2, a lookup that fails finds nothing; the failure is
// logged.
func (c *Connect) findResource(ctx context.Context, host, user string) *resource {
	r, err := c.lookupResource(ctx, host, user)
	if err != nil {
		if status.Code(err) != codes.NotFound {
			c.log.Error("unable to find resource", "host", host, "user", user, "error", err)
		}
		return nil
	}
	return r
}

func (c *Connect) lookupResource(ctx context.Context, host, user string) (*resource, error) {
	number, err := c.findNumber(ctx, "tel:"+user)
	if err != nil {
		return nil, err
	}
	if number != nil {
		return &resource{number: number}, nil
	}
	agent, err := c.findAgent(ctx, user)
	if err != nil {
		return nil, err
	}
	if agent != nil {
		domain, err := c.findDomain(ctx, host)
		if err != nil {
			return nil, err
		}
		if domain == nil || agent.GetDomain().GetRef() != domain.GetRef() {
			// Not in the same domain
			return nil, nil
		}
		return &resource{agent: agent}, nil
	}
	peer, err := c.findPeer(ctx, "username", user)
	if err != nil {
		return nil, err
	}
	if peer != nil {
		return &resource{peer: peer}, nil
	}
	return nil, nil
}

// findResources looks the caller and the callee up at once: one plan per
// call, each resource fetched once.
func (c *Connect) findResources(ctx context.Context, req *ppb.MessageRequest) (caller, callee *resource) {
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
// or without a Trunks client, as the Node code does without an API client. An
// API that fails is an error, which a request answers with 500.
func (c *Connect) findInboundTrunk(ctx context.Context, host string) (*trunks.Trunk, error) {
	if c.trunks == nil {
		return nil, nil
	}
	res, err := c.trunks.FindBy(ctx, &trunks.FindByRequest{FieldName: "inboundUri", FieldValue: host})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, err
	}
	if items := res.GetItems(); len(items) > 0 {
		return items[0], nil
	}
	return nil, nil
}

// routingDirection is utils.getRoutingDirection. All a Number callee tells is
// that this Routr manages it, so whoever calls it, the call is from the PSTN.
func routingDirection(caller, callee *resource) direction {
	switch {
	case caller.isAgent() && callee.isAgent():
		return directionAgentToAgent
	case caller.isAgent() && callee == nil:
		return directionAgentToPSTN
	case caller.isPeer() && callee.isAgent():
		return directionPeerToAgent
	case caller.isAgent() && callee.isPeer():
		return directionAgentToPeer
	case callee.isNumber():
		return directionFromPSTN
	case caller.isPeer() && callee == nil:
		return directionPeerToPSTN
	default:
		return directionUnknown
	}
}

// telNumber is the number of a tel URL, what follows its first colon.
func telNumber(telURL string) string {
	_, number, _ := strings.Cut(telURL, ":")
	number, _, _ = strings.Cut(number, ":")
	return number
}
