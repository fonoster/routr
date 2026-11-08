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

// Package connect is the Connect processor: the default Routr processor,
// which registers Agents and routes their calls (CONNECT.md), ported from
// mods/connect/src and the alterations of mods/processor/src. It implements
// the Processor gRPC service in process; cmd/connect serves it over the
// wire.
package connect

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/auth"
	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/pb/verifier"
)

// Dependencies are the services Connect calls, as the generated gRPC client
// interfaces: a client over the wire, or the component itself in process.
type Dependencies struct {
	Location location.LocationClient
	Agents   agents.AgentsClient
	Domains  domains.DomainsClient
	// Trunks decides whether a call arrives through a Trunk, which is not
	// challenged. Optional: without it no host is a Trunk's, as in Routr 2
	// without an API client.
	Trunks trunks.TrunksClient
	// Numbers finds the Numbers calls are placed to and from. Optional:
	// without it no user part is a Number.
	Numbers numbers.NumbersClient
	// Peers finds the Peers calls come from and go to. Optional: without it
	// no user part is a Peer.
	Peers peers.PeersClient
	// Verifier verifies Connect Tokens over gRPC. Optional, and exclusive
	// with Options.VerifierPublicKey: without either a Connect Token is
	// answered as in Routr 2 without a verifier (500 to an INVITE, 403 to a
	// REGISTER).
	Verifier verifier.VerifierClient
}

// Trust names the peer EdgePorts whose forwarded requests skip routing
// (Routr 2's TRUSTED_EDGEPORTS and TRUSTED_EDGEPORT_ADDRESSES) and the
// Requesters the Registry sends its Trunk REGISTERs through. The zero value
// trusts none.
type Trust struct {
	// EdgePorts narrows which X-Edgeport-Ref values are honored; empty
	// means any ref from a trusted address.
	EdgePorts []string
	// EdgePortAddresses are the peer EdgePorts, as IPs or CIDRs. They are
	// honored for X-Edgeport-Ref, not for X-Gateway-Auth.
	EdgePortAddresses []string
	// RegistryAddresses are the Requesters, as IPs, CIDRs or DNS names. They
	// are honored for X-Gateway-Auth, not for X-Edgeport-Ref. A name covers the
	// addresses it resolves to while Run keeps it resolved.
	RegistryAddresses []string
}

// Options tune a Connect beyond its settings.
type Options struct {
	// Logger receives the processor's logs; nil is slog.Default()
	Logger *slog.Logger
	// Now is the clock nonces and registrations are stamped with; nil is time.Now
	Now func() time.Time
	// VerifierPublicKey is the PEM key Connect Tokens are verified with in
	// process, as RS256 JWTs (Routr 2's CONNECT_VERIFIER_PUBLIC_KEY_PATH).
	VerifierPublicKey []byte
	// UntrustedHeaders are the platform headers removed from requests of
	// untrusted sources (Routr 2's UNTRUSTED_HEADERS_TO_STRIP). Nil is the
	// default list; empty, not nil, strips nothing.
	UntrustedHeaders []string
	// LookupHost resolves the DNS names of Trust.RegistryAddresses; nil is the
	// system resolver.
	LookupHost LookupHost
}

// Connect is the Connect processor.
type Connect struct {
	ppb.UnimplementedProcessorServer

	location location.LocationClient
	agents   agents.AgentsClient
	domains  domains.DomainsClient
	trunks   trunks.TrunksClient
	numbers  numbers.NumbersClient
	peers    peers.PeersClient

	verifyToken      tokenVerifier
	untrustedHeaders []string
	egressRules      *ruleCache

	nonceMaxAge            int
	registerDefaultExpires int
	trust                  edgePortTrust

	log *slog.Logger
	now func() time.Time
}

// New builds a Connect from its settings (spec.connect of routr.yaml, or
// the same part of connect.yaml; a zero RegisterDefaultExpires takes the
// default, a zero NonceMaxAge accepts any nonce), the peer EdgePorts it
// trusts and its dependencies. It never dials: the caller hands it clients,
// over the wire or in process.
func New(spec config.ConnectSpec, trust Trust, deps Dependencies, opts Options) (*Connect, error) {
	if spec.NonceMaxAge < 0 {
		return nil, fmt.Errorf("connect: nonceMaxAge must not be negative, got %d", spec.NonceMaxAge)
	}
	if spec.RegisterDefaultExpires < 0 {
		return nil, fmt.Errorf("connect: registerDefaultExpires must not be negative, got %d", spec.RegisterDefaultExpires)
	}
	if spec.RegisterDefaultExpires == 0 {
		spec.RegisterDefaultExpires = config.DefaultRegisterDefaultExpires
	}
	if deps.Location == nil {
		return nil, errors.New("connect: a Location client is required")
	}
	if deps.Agents == nil {
		return nil, errors.New("connect: an Agents client is required")
	}
	if deps.Domains == nil {
		return nil, errors.New("connect: a Domains client is required")
	}
	registries, registryNameList, err := splitRegistryAddresses(trust.RegistryAddresses)
	if err != nil {
		return nil, err
	}
	c := &Connect{
		location:               deps.Location,
		agents:                 deps.Agents,
		domains:                deps.Domains,
		trunks:                 deps.Trunks,
		numbers:                deps.Numbers,
		peers:                  deps.Peers,
		untrustedHeaders:       opts.UntrustedHeaders,
		nonceMaxAge:            spec.NonceMaxAge,
		registerDefaultExpires: spec.RegisterDefaultExpires,
		trust: edgePortTrust{
			refs:       trust.EdgePorts,
			addresses:  trust.EdgePortAddresses,
			registries: registries,
		},
		egressRules: newRuleCache(),
		log:         opts.Logger,
		now:         opts.Now,
	}
	if c.log == nil {
		c.log = slog.Default()
	}
	if c.now == nil {
		c.now = time.Now
	}
	if c.untrustedHeaders == nil {
		c.untrustedHeaders = defaultUntrustedHeaders
	}
	if len(registryNameList) > 0 {
		c.trust.registryNames = newRegistryNames(registryNameList, opts.LookupHost, c.now, c.log)
	}
	switch {
	case deps.Verifier != nil && len(opts.VerifierPublicKey) > 0:
		return nil, errors.New("connect: a Verifier client and a verifier public key are exclusive")
	case deps.Verifier != nil:
		c.verifyToken = grpcTokenVerifier(deps.Verifier)
	case len(opts.VerifierPublicKey) > 0:
		verify, err := publicKeyTokenVerifier(opts.VerifierPublicKey, c.now, tokenExpectations{
			issuer:   spec.VerifierIssuer,
			audience: spec.VerifierAudience,
		}, c.log)
		if err != nil {
			return nil, fmt.Errorf("connect: verifier public key: %w", err)
		}
		c.verifyToken = verify
	}
	return c, nil
}

// Register serves the processor on a gRPC server.
func (c *Connect) Register(s grpc.ServiceRegistrar) {
	ppb.RegisterProcessorServer(s, c)
}

// Run keeps the DNS names of Trust.RegistryAddresses resolved until ctx ends.
// Its caller owns the goroutine it runs on. Without names it returns at once;
// without Run a name trusts nothing.
func (c *Connect) Run(ctx context.Context) {
	if c.trust.registryNames == nil {
		return
	}
	c.trust.registryNames.run(ctx, registryRefreshInterval)
}

// nonce issues a digest nonce stamped with this processor's clock.
func (c *Connect) nonce() string {
	return auth.GenerateNonce(c.now)
}

// ProcessMessage answers a message the dispatcher hands over: the SIP message
// to send on, or the response that ends the request. The message received is
// never changed; the processor works on its own copy.
func (c *Connect) ProcessMessage(ctx context.Context, in *ppb.MessageRequest) (*ppb.MessageResponse, error) {
	if in == nil || in.GetMessage() == nil {
		return nil, status.Error(codes.InvalidArgument, "message is required")
	}
	// A response simply goes back to the UAC minus our Via, which shareResponse
	// does without a deep copy: half the messages of a call
	if isResponse(in) {
		c.log.Debug("connect processor received new request", "ref", in.GetRef(), "method", in.GetMethod().String(), "type", "response", "edgePort", in.GetEdgePortRef())
		return forward(shareResponse(in), in.GetMetadata()), nil
	}
	req := proto.Clone(in).(*ppb.MessageRequest)
	c.log.Debug("connect processor received new request", "ref", req.GetRef(), "method", req.GetMethod().String(), "type", "request", "edgePort", req.GetEdgePortRef())
	return c.dispatch(ctx, req), nil
}

// shareResponse is the request with a new SIPMessage that lacks the top Via and
// shares everything else with in: nothing a response goes through after this
// changes a nested message (§ 3.1), and the slice of Vias is resliced, not
// written. Every SIPMessage field must be listed; a test checks it against the
// message descriptor.
func shareResponse(in *ppb.MessageRequest) *ppb.MessageRequest {
	msg := in.GetMessage()
	out := &spb.SIPMessage{
		MessageType:     msg.MessageType,
		From:            msg.From,
		To:              msg.To,
		Contact:         msg.Contact,
		CallId:          msg.CallId,
		ContentLength:   msg.ContentLength,
		Expires:         msg.Expires,
		WwwAuthenticate: msg.WwwAuthenticate,
		MaxForwards:     msg.MaxForwards,
		Authorization:   msg.Authorization,
		Extensions:      msg.Extensions,
		Via:             msg.Via,
		Route:           msg.Route,
		RecordRoute:     msg.RecordRoute,
		ReasonPhrase:    msg.ReasonPhrase,
		Body:            msg.Body,
	}
	req := &ppb.MessageRequest{Sender: in.GetSender(), Message: out}
	removeTopVia(req)
	return req
}

// dispatch is service.ts createDispatcher for requests (a response took
// shareResponse's way): in-dialog requests follow their route set; everything else
// is routed by method.
func (c *Connect) dispatch(ctx context.Context, req *ppb.MessageRequest) *ppb.MessageResponse {
	// REGISTER never carries a To tag and CANCEL keeps its own path (it
	// follows the INVITE it cancels); everything else with a To tag is in a
	// dialog
	method := req.GetMethod()
	if method != ppb.Method_REGISTER && method != ppb.Method_CANCEL && isInDialog(req) {
		return c.forwardInDialog(req)
	}

	// Out-of-dialog REFER (RFC 3515 allows it) would be routed as a new call;
	// it is refused so transfer only happens on a dialog this proxy already
	// authorized. SIPconnect 1.1 section 12.1 keeps REFER out of scope anyway.
	switch method {
	case ppb.Method_PUBLISH, ppb.Method_NOTIFY, ppb.Method_SUBSCRIBE, ppb.Method_MESSAGE, ppb.Method_REFER:
		return methodNotAllowed()
	case ppb.Method_REGISTER:
		if getHeaderValue(req, headerGatewayAuth) != "" {
			// X-Gateway-Auth marks the REGISTER the Registry sends on behalf
			// of a Trunk, which goes to the provider in the Request-URI as it
			// is. The header alone proves nothing (any endpoint can set it)
			// and honoring it would relay a REGISTER to any host, so it is
			// honored only from the Requester the Registry sends through.
			// From anywhere else it is stripped and the REGISTER is an
			// endpoint's, challenged like any other. An Error: if this is the
			// Registry's, the Trunk never registers and its DIDs go dead.
			if isFromRegistry(req, c.trust) {
				return c.handleRegistry(req)
			}
			c.log.Error("X-Gateway-Auth from an address not in trustedRegistryAddresses; treating the REGISTER as an endpoint's", "ref", req.GetRef(), "source", sourceAddress(req))
			removeHeaders(req, []string{headerGatewayAuth})
		}
		return c.handleRegister(ctx, req)
	case ppb.Method_BYE, ppb.Method_ACK:
		return c.forwardInDialog(req)
	case ppb.Method_INVITE, ppb.Method_CANCEL:
		return c.handleRequest(ctx, req)
	default:
		// Out of a dialog only an INVITE starts anything. Routr 2 routed the
		// rest (OPTIONS, INFO, UPDATE, PRACK) as a new call with no access
		// check, a relay for anyone: a deliberate deviation.
		return methodNotAllowed()
	}
}

// forwardInDialog forwards a request that belongs to an existing dialog
// along its route set: strip our own Route, add our Via, and let the EdgePort
// send it to the next hop or the Request-URI. No routing and no access
// checks: the dialog was authorized when it was set up. BYE and ACK always
// took this path; since RFC 3261 section 12.2 makes any request with a To
// tag an in-dialog request, re-INVITE, UPDATE, INFO, REFER and the NOTIFY
// that follows a REFER take it too. When the INVITE went to a Trunk that
// rewrote the caller identity, each side gets back the From and To it knows.
func (c *Connect) forwardInDialog(req *ppb.MessageRequest) *ppb.MessageResponse {
	// Before our own Route entries go: they carry the identity mapping
	swapIdentityFromRouteSet(req)
	decreaseMaxForwards(req)
	last, peer := c.crossedDialog(req)
	if peer != nil {
		// The connection to the target is on the peer: our Via faces it
		intf, err := getEdgeInterface(netsOfRequest(req), peer.GetHost(), peer.GetTransportParam())
		if err != nil {
			return c.failure(req, err)
		}
		prependVia(req, intf)
	} else if err := addSelfViaUsingExternalAddrs(req); err != nil {
		return c.failure(req, err)
	}
	if last < 0 {
		removeSelfRoutes(req)
	} else {
		// Every entry up to the one facing the target is an EdgePort of this
		// deployment, the peers' internal ones included: the request goes
		// straight to the EdgePort that holds the target's connection
		req.Message.Route = req.Message.Route[last+1:]
		if peer != nil {
			prependRoute(req, peer.GetHost(), peer.GetPort(), peer.GetTransportParam())
		}
	}
	removeHeaders(req, []string{headerConnectToken})
	return forward(req, req.GetMetadata())
}

// crossedDialog finds where an in-dialog request goes when its dialog crossed
// EdgePorts. Route entries come in route-set order (RFC 3261 section 12.1.2:
// the UAC reverses Record-Route, the UAS keeps it), so the last entry that
// points at this EdgePort is the one facing the Request-URI's target, and the
// ep address it carries names the EdgePort that holds the connection to it.
// last is that entry's index, -1 when the dialog didn't cross EdgePorts (no
// address) or its address is not to be honored: outside the localnets or off
// the listening ports, which is logged. peer is the EdgePort to go through,
// nil when it is this one.
func (c *Connect) crossedDialog(req *ppb.MessageRequest) (last int, peer *spb.SipURI) {
	routes := req.GetMessage().GetRoute()
	for i := len(routes) - 1; i >= 0; i-- {
		if !isSelfRoute(req, routes[i]) {
			continue
		}
		value := decodeIdentityUser(routes[i].GetAddress().GetUri().GetUser())[edgePortAddressParameter]
		if value == "" {
			return -1, nil
		}
		peer, ok := decodeEdgePortAddress(value)
		if !ok || !isEdgePortAddress(req, peer) {
			c.log.Warn("ignoring an EdgePort address outside the localnets or listening ports", "ref", req.GetRef(), "edgePortRef", req.GetEdgePortRef(), "address", peer.GetHost(), "port", peer.GetPort(), "transport", peer.GetTransportParam())
			return -1, nil
		}
		if isSelfRoute(req, &spb.Route{Address: &spb.Address{Uri: peer}}) {
			return i, nil
		}
		return i, peer
	}
	return -1, nil
}
