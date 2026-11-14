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

// Package processor is the Go SDK for writing a Routr processor: the gRPC
// server the Dispatcher calls, the message types and the response helpers,
// the twin of the Node package @routr/processor.
//
// ListenAndServe serves fonoster.routr.processor.v2beta1.Processor/ProcessMessage
// and the grpc.health.v1 service over plaintext, which is what the Dispatcher
// dials, and hands every SIP message to a Handler:
//
//	err := processor.ListenAndServe(ctx, processor.Options{Name: "echo", Version: "1.0.0"},
//		func(ctx context.Context, req *processor.MessageRequest) (*processor.MessageResponse, error) {
//			if req.GetMethod() == processor.Method_REGISTER {
//				return processor.RegisterOK(req, nil), nil
//			}
//			return processor.OK(), nil
//		})
//
// The server ends each connection after about 5 minutes, so that a
// round-robin client such as the Dispatcher finds the replicas added since.
// It only does when the processor's address resolves to one address per
// replica: on Kubernetes, a headless Service (clusterIP: None).
//
// # Answering
//
// A Handler answers with a response helper: OK, RegisterOK, NotFound,
// Forbidden and the others build the SIP response the EdgePort sends, and
// Forward sends the request on.
//
// # Routing
//
// The alterations change the request in place (the processor owns its copy)
// and return an error where the Node twin threw. They are the twins of
// @routr/processor's Alterations, Helper, Target and Extensions:
//
//   - Request-URI: FixRequestURI
//   - Via: AddSelfVia, AddSelfViaUsingTheRouteHeaders,
//     AddSelfViaUsingExternalAddrs, RemoveTopVia
//   - Route: AddRouteToNextHop, AddRouteToPeerEdgePort, RemoveSelfRoutes
//   - Record-Route: AddSelfRecordRoute
//   - Headers: ApplyXHeaders, AddXEdgePortRef, RemoveXEdgePortRef,
//     RemoveHeaders, RemoveAuthorization, DecreaseMaxForwards, and HeaderValue,
//     AddHeader, UpdateHeader, RemoveHeader
//   - Contact: FixInvalidContact, OverwriteContactWithSenderInfo
//   - Identity: IsAnonymous, RewriteFromWithNumber,
//     IdentityRewriteParameters, SwapIdentityFromRouteSet
//   - Helpers: EdgeInterface with NetsOf and NetsOfRoute, IsTypeRequest,
//     IsTypeResponse, HasSDP, IsOK, IsRinging, IsInviteWithSDP, IsAckWithSDP,
//     IsInviteOrAckWithSDP, IsResponseWithSDP, IsOKOrRingingWithSDP, IsBye,
//     IsWebRTC
//   - Target: AOR, TargetAOR, TargetExpires
//   - Location: CreateRoute, the twin of @routr/location's createRoute, for
//     the route a REGISTER binds
//   - Across EdgePorts that share one external address, Connect's own:
//     AddRouteToPeerEdgePortOwnAddress and AddSelfRecordRouteToPeer to send a
//     request to the peer EdgePort holding the connection; SourceAddress,
//     CreateRouteFromPeer and AddSelfRecordRouteFromPeer to receive one from a
//     peer the processor trusts; RemoveRoutesUpToOwn and
//     AddSelfViaTowardNextHop for in-dialog requests. Who is a peer is the
//     processor's own check.
//
// The route they take is Location's own *location.Route, what FindRoutes
// returns. A handler that routes a request to it and sends it on:
//
//	processor.DecreaseMaxForwards(req)
//	processor.RemoveAuthorization(req)
//	processor.RemoveSelfRoutes(req)
//	processor.FixRequestURI(req, route)
//	if err := processor.AddSelfVia(req, route); err != nil {
//		return processor.InternalServerError(), nil
//	}
//	if err := processor.AddSelfRecordRoute(req, route, nil); err != nil {
//		return processor.InternalServerError(), nil
//	}
//	processor.AddRouteToNextHop(req, route)
//	return processor.Forward(req), nil
//
// IdentityRewriteParameters compares a request before and after
// RewriteFromWithNumber or any rewrite of its From or To; since those change
// the request in place, its original must be a proto.Clone taken before them.
//
// # The handler error rule
//
// To reject a message a Handler returns a response helper, never an error.
// An error is a failed call, not a SIP answer: it reaches the Dispatcher as
// codes.Internal with the error's text (an error that already is a gRPC
// status passes through as it is), and a panic is recovered into
// codes.Internal and logged while the server stays up. On any status but
// Unavailable the Dispatcher logs a warning and forwards the request
// unchanged, as if the processor had not been there; Unavailable makes the
// EdgePort answer 503.
//
// # The module
//
// The SDK is its own module, github.com/fonoster/routr/pkg/processor,
// versioned on its own tags (pkg/processor/vX.Y.Z). The generated stubs it
// is built on are under pb/: MessageRequest, MessageResponse, NetInterface,
// Method, ProcessorClient and NewProcessorClient are re-exported here, so a
// processor never imports two packages named processor; pb/sipmessage,
// pb/common and pb/location are imported as they are.
package processor
