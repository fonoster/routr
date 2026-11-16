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
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	lpb "github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// routing is what the router decided: the route and its direction, or the
// answer that ends the request instead. A nil route with no answer means the
// callee can't be reached right now.
type routing struct {
	route     *route
	direction direction
	response  *ppb.MessageResponse
}

// router is router.ts: who is calling whom, whether they may, and the route.
// The Trunk is the one the request handler found for the Request-URI host.
func (c *Connect) router(ctx context.Context, req *ppb.MessageRequest, trunk *trunks.Trunk) routing {
	var caller, callee *resource
	withToken := hasConnectToken(req)
	// A call on a Trunk without a Connect Token: the Trunk alone decides the
	// callee, after its own access check
	onTrunk := !withToken && trunk != nil
	var match numberMatch
	switch {
	case withToken:
		var res *ppb.MessageResponse
		if caller, callee, res = c.resourcesOfToken(ctx, req); res != nil {
			return routing{response: res}
		}
	case onTrunk:
		number, how, res, err := c.findNumberOnTrunk(ctx, req, trunk)
		if err != nil {
			c.log.Error("unable to find the Number of a call on a Trunk", "ref", req.GetRef(), "trunk", trunk.GetRef(), "error", err)
			return routing{response: internalServerError()}
		}
		if res != nil {
			return routing{response: res}
		}
		from := req.GetMessage().GetFrom().GetAddress().GetUri()
		caller = c.findResource(ctx, from.GetHost(), from.GetUser())
		callee, match = &resource{number: number}, how
	default:
		caller, callee = c.findResources(ctx, req)
	}

	dir := routingDirection(caller, callee)
	from := req.GetMessage().GetFrom().GetAddress().GetUri()
	to := req.GetMessage().GetRequestUri()
	c.log.Debug("routing request",
		"ref", req.GetRef(),
		"fromURI", sipURI(from.GetUser(), from.GetHost()),
		"requestURI", sipURI(to.GetUser(), to.GetHost()),
		"routingDirection", string(dir))

	if !withToken && !onTrunk {
		if res := c.checkAccess(req, caller, dir); res != nil {
			return routing{response: res}
		}
		if res := c.checkAgents(req, caller, callee, dir); res != nil {
			return routing{response: res}
		}
	}
	if dir == directionAgentToAgent && !callee.agent.GetEnabled() {
		return routing{response: temporarilyUnavailable()}
	}

	var (
		r        *route
		res      *ppb.MessageResponse
		err      error
		extended = caller.extended()
	)
	switch dir {
	case directionAgentToAgent:
		// A Connect Token's anonymous callee has no AOR of its own: it is the
		// To, which resourcesOfToken kept inside the token's Domain
		aor := targetAOR(req)
		if !withToken {
			aor = agentAOR(req, callee.agent)
		}
		r, err = c.findRoute(ctx, &lpb.FindRoutesRequest{Aor: aor, CallId: req.GetRef()})
	case directionAgentToPeer:
		r, err = c.findRoute(ctx, &lpb.FindRoutesRequest{
			Aor:     callee.peer.GetAor(),
			CallId:  req.GetRef(),
			Backend: backendOf(callee.peer),
		})
	case directionAgentToPSTN:
		r, err = c.agentToPSTN(req, caller.agent, to.GetUser())
	case directionFromPSTN:
		extended = callee.extended()
		r, err = c.fromPSTN(ctx, req, callee.number, trunk, match)
	case directionPeerToPSTN:
		// The callee is unknown, so the route carries no extended attributes
		extended = nil
		r, res, err = c.peerToPSTN(ctx, req)
	default:
		// peer-to-agent included: Routr 2 authenticates the Peer, then has no
		// route for it (docs-site/concepts/routing.mdx)
		err = fmt.Errorf("unsupported routing direction: %s", dir)
	}
	switch {
	case res != nil:
		return routing{response: res}
	case status.Code(err) == codes.NotFound:
		return routing{direction: dir}
	case err != nil:
		c.log.Error("unable to route request", "ref", req.GetRef(), "routingDirection", string(dir), "error", err)
		return routing{response: internalServerError()}
	case r == nil:
		return routing{direction: dir}
	}

	metadata := routeMetadata(extended, dir, traceablesOf(caller, callee)...)
	// Only the route says whether another Trunk URI remains: an extended
	// attribute of that name must not make the EdgePort retry
	delete(metadata, failoverTriedMetaKey)
	for key, value := range r.metadata {
		metadata[key] = value
	}
	r.metadata = metadata
	return routing{route: r, direction: dir}
}

// resourcesOfToken is the X-Connect-Token branch of router.ts: the caller and
// the callee of a request a Connect Token authorizes. The caller is an Agent
// the token stands for; the callee the Peer at the token's aorLink, or else
// another such Agent (Routr 2's experimental Ephemeral Agents). No verifier is
// a 500, anything else wrong with the token a 403.
func (c *Connect) resourcesOfToken(ctx context.Context, req *ppb.MessageRequest) (caller, callee *resource, res *ppb.MessageResponse) {
	if c.verifyToken == nil {
		c.log.Error("unable to validate connect token: no verifier configured", "ref", req.GetRef())
		return nil, nil, serverInternalError()
	}
	refuse := func(err error) (*resource, *resource, *ppb.MessageResponse) {
		c.log.Debug("unable to validate connect token", "ref", req.GetRef(), "originalError", err)
		return nil, nil, forbidden()
	}
	claims, err := c.verifyToken(ctx, getHeaderValue(req, headerConnectToken))
	if err != nil {
		return refuse(err)
	}
	domain, err := c.findDomain(ctx, claims.Domain)
	if err != nil {
		return refuse(err)
	}
	if domain == nil {
		return refuse(fmt.Errorf("no Domain %q", claims.Domain))
	}
	if !claims.allows(ppb.Method_INVITE) {
		return nil, nil, forbidden()
	}
	name := req.GetMessage().GetFrom().GetAddress().GetDisplayName()
	if name == "" {
		name = anonymous
	}
	caller = &resource{agent: &agents.Agent{Ref: claims.Ref, Name: name, Domain: domain, Username: anonymous, Enabled: true}}
	peer, err := c.findPeer(ctx, "aor", claims.AORLink)
	if err != nil {
		return refuse(err)
	}
	if peer != nil {
		return caller, &resource{peer: peer}, nil
	}
	// The call is routed by its To, which the caller wrote
	if host := req.GetMessage().GetTo().GetAddress().GetUri().GetHost(); !strings.EqualFold(host, claims.Domain) {
		return refuse(fmt.Errorf("To host %q is outside the token's Domain %q", host, claims.Domain))
	}
	return caller, &resource{agent: &agents.Agent{Ref: anonymous, Name: anonymous, Domain: domain, Username: anonymous, Enabled: true}}, nil
}

// findRoute is the first route the Location has for the request, nil when it
// has none. Its errors, NOT_FOUND included, go back to the router.
func (c *Connect) findRoute(ctx context.Context, in *lpb.FindRoutesRequest) (*route, error) {
	res, err := c.location.FindRoutes(ctx, in)
	if err != nil {
		return nil, err
	}
	routes := res.GetRoutes()
	if len(routes) == 0 {
		return nil, nil
	}
	return routeFromPB(routes[0]), nil
}

// backendOf is how the Location balances the routes of a Peer's AOR. Without
// LEAST_SESSIONS it goes round-robin.
func backendOf(peer *peers.Peer) *lpb.FindRoutesRequest_Backend {
	backend := &lpb.FindRoutesRequest_Backend{WithSessionAffinity: peer.GetWithSessionAffinity()}
	if peer.GetBalancingAlgorithm() == peers.LoadBalancingAlgorithm_LEAST_SESSIONS {
		backend.Algorithm = lpb.FindRoutesRequest_Backend_LEAST_SESSIONS
	}
	return backend
}

// fromPSTN is the From PSTN routing: the Number's aorLink, balanced when a Peer
// answers to it, with the Number's extra headers. The session affinity header,
// when the Number names one, picks the instance a session is already on. The
// call carries exactly one X-DID-Number, the Number's own: a copy the carrier
// sent is removed. To and From stay as received.
func (c *Connect) fromPSTN(ctx context.Context, req *ppb.MessageRequest, number *numbers.Number, trunk *trunks.Trunk, match numberMatch) (*route, error) {
	peer, err := c.findPeer(ctx, "aor", number.GetAorLink())
	if err != nil {
		return nil, err
	}
	in := &lpb.FindRoutesRequest{
		Aor:                number.GetAorLink(),
		CallId:             req.GetRef(),
		SessionAffinityRef: getHeaderValue(req, number.GetSessionAffinityHeader()),
	}
	if peer != nil {
		in.Backend = backendOf(peer)
	}
	r, err := c.findRoute(ctx, in)
	if err != nil || r == nil {
		return nil, err
	}
	r.metadata = trunkMetadata(trunk)
	r.metadata[traceNumberMatchMetaKey] = string(match)
	for _, h := range number.GetExtraHeaders() {
		r.headers = append(r.headers, headerModifier{name: h.GetName(), value: h.GetValue()})
	}
	r.headers = append(r.headers,
		headerModifier{name: headerDIDNumber, remove: true},
		headerModifier{name: headerDIDNumber, value: telNumber(number.GetTelUrl())})
	return r, nil
}

// agentToPSTN routes through the Number of the first egress policy of the
// caller's Domain whose rule matches the dialed user, and that Number's Trunk. A
// Domain with no such policy is a configuration problem, which Routr 2 answers
// with 500 (docs-site/concepts/routing.mdx), not 404. So does a rule that doesn't
// compile or takes too long to match.
func (c *Connect) agentToPSTN(req *ppb.MessageRequest, agent *agents.Agent, calleeNumber string) (*route, error) {
	domain := agent.GetDomain()
	for _, policy := range domain.GetEgressPolicies() {
		matched, err := c.egressRules.match(policy.GetRule(), calleeNumber)
		if err != nil {
			return nil, fmt.Errorf("egress policy rule %q in Domain ref %s: %w", policy.GetRule(), domain.GetRef(), err)
		}
		if !matched {
			continue
		}
		number := policy.GetNumber()
		if number.GetTrunk() == nil {
			return nil, fmt.Errorf("no trunk associated with Number ref: %s", policy.GetNumberRef())
		}
		return trunkRoute(req, number.GetTrunk(), number, privacyOfAgent(agent), c.random)
	}
	return nil, fmt.Errorf("no egress policy matching number %q in Domain ref: %s", calleeNumber, domain.GetRef())
}

// peerToPSTN routes through the Number the Peer names in X-DOD-Number and that
// Number's Trunk. A Number bound to an access key (a Fonoster workspace, say)
// may only be used by a request that carries the same X-Access-Key-Id.
func (c *Connect) peerToPSTN(ctx context.Context, req *ppb.MessageRequest) (*route, *ppb.MessageResponse, error) {
	numberTel := getHeaderValue(req, headerDODNumber)
	if numberTel == "" {
		return nil, badRequestWith("Missing or empty '" + headerDODNumber + "' header required for peer-to-pstn routing"), nil
	}
	number, err := c.findNumber(ctx, "tel:"+numberTel)
	if err != nil {
		return nil, nil, err
	}
	if number == nil {
		return nil, notFoundWith("No Number found for tel:" + numberTel), nil
	}
	if key := number.GetExtended().GetFields()["accessKeyId"]; key != nil {
		if want := stringOf(key); want != "" && want != getHeaderValue(req, headerAccessKeyID) {
			c.log.Debug("rejected peer-to-pstn request: access key mismatch", "ref", req.GetRef(), "numberRef", number.GetRef())
			return nil, forbidden(), nil
		}
	}
	if number.GetTrunk() == nil {
		return nil, nil, fmt.Errorf("no trunk associated with Number ref: %s", number.GetRef())
	}
	r, err := trunkRoute(req, number.GetTrunk(), number, privacyOfPeerRequest(req), c.random)
	return r, nil, err
}

// trunkURI is utils.getTrunkURI: the first outbound URI of the Trunk, on 5060
// and UDP when it names neither. The transport is upper-case, as a route's is.
func trunkURI(trunk *trunks.Trunk, exclude map[string]bool, random func() float64) (*trunks.TrunkURI, int32, string, error) {
	if len(trunk.GetUris()) == 0 {
		return nil, 0, "", fmt.Errorf("trunk %s has no outbound settings", trunk.GetRef())
	}
	uri, err := selectTrunkURI(trunk, exclude, random)
	if err != nil {
		return nil, 0, "", err
	}
	port, transport := portAndTransport(uri)
	return uri, port, transport, nil
}

// portAndTransport are a Trunk URI's port and upper-cased transport, 5060 and
// UDP when it names none.
func portAndTransport(uri *trunks.TrunkURI) (int32, string) {
	port := uri.GetPort()
	if port == 0 {
		port = 5060
	}
	transport := strings.ToUpper(uri.GetTransport())
	if transport == "" {
		transport = "UDP"
	}
	return port, transport
}

// trunkURIIdentity is user@host:port;transport, lower-cased, with the
// defaults of portAndTransport: what tells two outbound URIs apart.
func trunkURIIdentity(uri *trunks.TrunkURI) string {
	port, transport := portAndTransport(uri)
	return strings.ToLower(fmt.Sprintf("%s@%s:%d;%s", uri.GetUser(), uri.GetHost(), port, transport))
}

// selectTrunkURI is the outbound URI a call takes: among the enabled URIs
// (absent enabled is enabled) not in exclude, those of the lowest priority,
// one drawn in proportion to its weight (0 counts as 1), the rule RFC 3263
// section 4.2 takes from RFC 2782. random draws in [0, 1).
func selectTrunkURI(trunk *trunks.Trunk, exclude map[string]bool, random func() float64) (*trunks.TrunkURI, error) {
	var candidates []*trunks.TrunkURI
	var total int64
	for _, u := range trunk.GetUris() {
		if (u.Enabled != nil && !*u.Enabled) || exclude[trunkURIIdentity(u)] {
			continue
		}
		if len(candidates) > 0 && u.GetPriority() > candidates[0].GetPriority() {
			continue
		}
		if len(candidates) > 0 && u.GetPriority() < candidates[0].GetPriority() {
			candidates, total = candidates[:0], 0
		}
		candidates = append(candidates, u)
		total += weightOf(u)
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("trunk %s has no enabled outbound uri", trunk.GetRef())
	}
	draw := int64(random() * float64(total))
	for _, u := range candidates {
		if draw < weightOf(u) {
			return u, nil
		}
		draw -= weightOf(u)
	}
	return candidates[len(candidates)-1], nil
}

// weightOf is a URI's weight, 1 when it has none.
func weightOf(uri *trunks.TrunkURI) int64 {
	if w := uri.GetWeight(); w > 0 {
		return int64(w)
	}
	return 1
}

// trunkMetadata is what a call through a Trunk records: the recording flag when
// the Trunk asks for it, and the Trunk in the hop's annotations.
func trunkMetadata(trunk *trunks.Trunk) map[string]string {
	metadata := recordingMetadata(trunk)
	if ref := trunk.GetRef(); ref != "" {
		metadata[traceTrunkMetaKey] = ref
	}
	return metadata
}

// trunkRoute is the route both directions toward the PSTN build. Applying the
// Trunk's caller identity is left to the tailor, after routing, access control
// and the asserted identity have all been worked out from the caller's own From.
//
// privacy is the caller's choice: privacyOfAgent or privacyOfPeerRequest.
func trunkRoute(req *ppb.MessageRequest, trunk *trunks.Trunk, number *numbers.Number, privacy string, random func() float64) (*route, error) {
	// An initial INVITE the EdgePort sends again after a URI failed names the
	// URIs it tried, which are left out of the selection
	failover := req.GetMethod() == ppb.Method_INVITE && !isInDialog(req)
	var tried []string
	if failover {
		tried = triedTrunkURIs(req)
	}
	exclude := make(map[string]bool, len(tried))
	for _, identity := range tried {
		exclude[identity] = true
	}
	uri, port, transport, err := trunkURI(trunk, exclude, random)
	if err != nil {
		return nil, err
	}
	metadata := trunkMetadata(trunk)
	if failover {
		tried = append(tried, trunkURIIdentity(uri))
		exclude[trunkURIIdentity(uri)] = true
		if hasUntriedURI(trunk, exclude) {
			if list, err := json.Marshal(tried); err == nil {
				metadata[failoverTriedMetaKey] = string(list)
			}
		}
	}
	var advertisedHost string
	var advertisedPort int32
	if vias := req.GetMessage().GetVia(); len(vias) > 0 {
		advertisedHost = vias[0].GetHost()
		advertisedPort = vias[0].GetPort()
	} else {
		return nil, errors.New("request has no Via")
	}
	formats := numberFormatsOf(trunk, number)
	r := &route{
		user:            uri.GetUser(),
		host:            uri.GetHost(),
		port:            port,
		advertisedHost:  advertisedHost,
		advertisedPort:  advertisedPort,
		transport:       transport,
		edgePortRef:     req.GetEdgePortRef(),
		listeningPoints: req.GetListeningPoints(),
		localnets:       req.GetLocalnets(),
		externalAddrs:   req.GetExternalAddrs(),
		metadata:        metadata,
		formats:         formats,
		rewriteFrom:     fromRewriteOf(trunk, number, uri.GetHost(), formats),
		headers: []headerModifier{
			// TODO: Find a more deterministic way to re-add the Privacy header
			{name: "Privacy", remove: true},
			{name: "Privacy", value: privacy},
			remotePartyID(number, uri.GetHost(), formats),
			pAssertedIdentity(req, number, uri.GetHost(), formats),
			trunkAuthentication(trunk),
		},
	}
	return r, nil
}

// privacyOfAgent is the Privacy an Agent's setting asks for toward a Trunk
// (docs-site/concepts/routing.mdx). Routr 2 meant the same but compared PRIVATE
// with the "ID" it is stored as, so it always said none.
func privacyOfAgent(agent *agents.Agent) string {
	if agent.GetPrivacy() == agents.Privacy_PRIVATE {
		return "id"
	}
	return "none"
}

// privacyOfPeerRequest is the Privacy a Peer asks for with X-DOD-Privacy: id, in
// any case; anything else is none (docs-site/reference/sip-headers.mdx). Routr 2
// meant the same but compared the lower-cased value with "ID".
func privacyOfPeerRequest(req *ppb.MessageRequest) string {
	if strings.EqualFold(getHeaderValue(req, headerDODPrivacy), "id") {
		return "id"
	}
	return "none"
}

// fromRewriteOf is the From a Trunk with rewriteFromWithNumber presents: the
// Number at fromDomain, or else at the Trunk's outbound host. E.164 always
// carries the leading +, whether or not the telUrl does, unless the Trunk's
// caller format writes it another way.
func fromRewriteOf(trunk *trunks.Trunk, number *numbers.Number, trunkHost string, formats *numberFormats) *fromRewrite {
	if !trunk.GetRewriteFromWithNumber() {
		return nil
	}
	user := telNumber(number.GetTelUrl())
	if !strings.HasPrefix(user, "+") {
		user = "+" + user
	}
	host := trunk.GetFromDomain()
	if host == "" {
		host = trunkHost
	}
	written := formats.callerNumber(user)
	return &fromRewrite{user: written.user, host: host, noUserPhone: !written.userPhone}
}

// pAssertedIdentity is utils.createPAssertedIdentity, with the Number as the
// Trunk's caller format writes it. user=phone stays unless the format wrote a
// number without its +.
func pAssertedIdentity(req *ppb.MessageRequest, number *numbers.Number, trunkHost string, formats *numberFormats) headerModifier {
	written := formats.callerNumber(telNumber(number.GetTelUrl()))
	value := "<sip:" + written.user + "@" + trunkHost + ">"
	if written.userPhone {
		value = "<sip:" + written.user + "@" + trunkHost + ";user=phone>"
	}
	if name := req.GetMessage().GetFrom().GetAddress().GetDisplayName(); name != "" {
		value = "\"" + name + "\" " + value
	}
	return headerModifier{name: "P-Asserted-Identity", value: value}
}

// remotePartyID is utils.createRemotePartyId, with the Number as the Trunk's
// caller format writes it.
func remotePartyID(number *numbers.Number, trunkHost string, formats *numberFormats) headerModifier {
	return headerModifier{
		name:  "Remote-Party-ID",
		value: "<sip:" + formats.callerNumber(telNumber(number.GetTelUrl())).user + "@" + trunkHost + ">;screen=yes;party=calling",
	}
}

// trunkAuthentication is utils.createTrunkAuthentication: the credentials the
// EdgePort answers the provider's challenge with. The EdgePort consumes the
// header; it never leaves. A Trunk without outbound credentials sends what
// Routr 2 does, the literal "undefined:undefined".
func trunkAuthentication(trunk *trunks.Trunk) headerModifier {
	username, password := "undefined", "undefined"
	if creds := trunk.GetOutboundCredentials(); creds != nil {
		username, password = creds.GetUsername(), creds.GetPassword()
	}
	return headerModifier{
		name:  headerGatewayAuth,
		value: base64.StdEncoding.EncodeToString([]byte(username + ":" + password)),
	}
}

// checkAgents refuses, once the caller has passed the digest check, a
// disabled Agent's request and an Agent's call to an Agent of another Domain:
// Domains are isolated, so the call goes through a Peer or a Number instead.
func (c *Connect) checkAgents(req *ppb.MessageRequest, caller, callee *resource, dir direction) *ppb.MessageResponse {
	// From the PSTN the From is the carrier's to write and no Agent digest was
	// checked: refusing there would tell anyone whether an Agent is disabled
	if dir != directionFromPSTN && caller.isAgent() && !caller.agent.GetEnabled() {
		c.log.Info("request from a disabled agent refused", "ref", req.GetRef(), "agent", caller.agent.GetRef())
		return forbidden()
	}
	if dir != directionAgentToAgent {
		return nil
	}
	callerDomain, calleeDomain := caller.agent.GetDomain().GetRef(), callee.agent.GetDomain().GetRef()
	if callerDomain != calleeDomain {
		c.log.Info("agent-to-agent call across domains refused", "ref", req.GetRef(), "callerDomain", callerDomain, "calleeDomain", calleeDomain)
		return forbidden()
	}
	return nil
}

// triedTrunkURIs are the URI identities in the request's failover.tried
// metadata; none when it has none or it isn't a JSON array of strings.
func triedTrunkURIs(req *ppb.MessageRequest) []string {
	value := req.GetMetadata()[failoverTriedMetaKey]
	if value == "" {
		return nil
	}
	var tried []string
	if err := json.Unmarshal([]byte(value), &tried); err != nil {
		return nil
	}
	return tried
}

// hasUntriedURI tells whether the Trunk has an enabled URI outside tried.
func hasUntriedURI(trunk *trunks.Trunk, tried map[string]bool) bool {
	for _, u := range trunk.GetUris() {
		if (u.Enabled == nil || *u.Enabled) && !tried[trunkURIIdentity(u)] {
			return true
		}
	}
	return false
}
