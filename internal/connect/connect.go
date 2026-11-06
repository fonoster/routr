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
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/location"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// Dependencies are the services Connect calls, as the generated gRPC client
// interfaces: a client over the wire, or the component itself in process.
type Dependencies struct {
	Location location.LocationClient
	Agents   agents.AgentsClient
	Domains  domains.DomainsClient
	// Trunks decides whether a call arrives through a Trunk, which is not
	// challenged. Optional: without it no host is a Trunk's, as in Routr 2
	// without an API client. Routing those calls is milestone 2.
	Trunks trunks.TrunksClient
}

// Trust names the peer EdgePorts whose forwarded requests skip routing
// (Routr 2's TRUSTED_EDGEPORTS and TRUSTED_EDGEPORT_ADDRESSES). The zero
// value trusts none.
type Trust struct {
	// EdgePorts narrows which X-Edgeport-Ref values are honored; empty
	// means any ref from a trusted address.
	EdgePorts []string
	// EdgePortAddresses are the peer EdgePorts, as IPs or CIDRs.
	EdgePortAddresses []string
}

// Options tune a Connect beyond its settings.
type Options struct {
	// Logger receives the processor's logs; nil is slog.Default()
	Logger *slog.Logger
	// Now is the clock nonces and registrations are stamped with; nil is time.Now
	Now func() time.Time
}

// Connect is the Connect processor.
type Connect struct {
	ppb.UnimplementedProcessorServer

	location location.LocationClient
	agents   agents.AgentsClient
	domains  domains.DomainsClient
	trunks   trunks.TrunksClient

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
	c := &Connect{
		location:               deps.Location,
		agents:                 deps.Agents,
		domains:                deps.Domains,
		trunks:                 deps.Trunks,
		nonceMaxAge:            spec.NonceMaxAge,
		registerDefaultExpires: spec.RegisterDefaultExpires,
		trust: edgePortTrust{
			refs:      trust.EdgePorts,
			addresses: trust.EdgePortAddresses,
		},
		log: opts.Logger,
		now: opts.Now,
	}
	if c.log == nil {
		c.log = slog.Default()
	}
	if c.now == nil {
		c.now = time.Now
	}
	return c, nil
}

// Register serves the processor on a gRPC server.
func (c *Connect) Register(s grpc.ServiceRegistrar) {
	ppb.RegisterProcessorServer(s, c)
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
	req := proto.Clone(in).(*ppb.MessageRequest)
	kind := "request"
	if isResponse(req) {
		kind = "response"
	}
	c.log.Debug("connect processor received new request", "ref", req.GetRef(), "method", req.GetMethod().String(), "type", kind, "edgePort", req.GetEdgePortRef())
	return c.dispatch(ctx, req), nil
}

// dispatch is service.ts createDispatcher: responses go back minus our Via;
// in-dialog requests follow their route set; everything else is routed by
// method.
func (c *Connect) dispatch(ctx context.Context, req *ppb.MessageRequest) *ppb.MessageResponse {
	// A response simply goes back to the UAC
	if isResponse(req) {
		removeTopVia(req)
		return forward(req, req.GetMetadata())
	}

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
			// honored only from a trusted address: the networks of Routr's
			// own senders, the peer EdgePorts and the Requester the Registry
			// sends through. From anywhere else it is stripped and the
			// REGISTER is an endpoint's, challenged like any other.
			if isFromTrustedAddress(req, c.trust) {
				return c.handleRegistry(req)
			}
			c.log.Warn("X-Gateway-Auth from an untrusted address; treating the REGISTER as an endpoint's", "ref", req.GetRef(), "source", sourceAddress(req))
			removeHeaders(req, []string{headerGatewayAuth})
		}
		return c.handleRegister(ctx, req)
	case ppb.Method_BYE, ppb.Method_ACK:
		return c.forwardInDialog(req)
	default:
		return c.handleRequest(ctx, req)
	}
}

// forwardInDialog forwards a request that belongs to an existing dialog
// along its route set: strip our own Route, add our Via, and let the EdgePort
// send it to the next hop or the Request-URI. No routing and no access
// checks: the dialog was authorized when it was set up. BYE and ACK always
// took this path; since RFC 3261 section 12.2 makes any request with a To
// tag an in-dialog request, re-INVITE, UPDATE, INFO, REFER and the NOTIFY
// that follows a REFER take it too.
func (c *Connect) forwardInDialog(req *ppb.MessageRequest) *ppb.MessageResponse {
	decreaseMaxForwards(req)
	if err := addSelfViaUsingExternalAddrs(req); err != nil {
		return c.failure(req, err)
	}
	removeSelfRoutes(req)
	return forward(req, req.GetMetadata())
}
