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

// Package rtprelay is the RTPRelay: a Dispatcher middleware that puts
// RTPEngine in the media path. It rewrites the SDP of the messages it is given
// with what RTPEngine negotiates over its NG protocol (mods/rtprelay/src on
// Routr 2).
package rtprelay

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// RTPRelay is the middleware. It serves the Processor service, gRPC or in
// process, and never changes a message it receives.
type RTPRelay struct {
	processor.UnimplementedProcessorServer
	engine   Engine
	profiles Profiles
	log      *slog.Logger
}

// New builds the relay over engine with the profiles it runs with: nil is the
// shipped set, anything else comes from MergeProfiles.
func New(engine Engine, profiles Profiles, logger *slog.Logger) (*RTPRelay, error) {
	if engine == nil {
		return nil, errors.New("rtprelay: an RTPEngine client is required")
	}
	if profiles == nil {
		profiles = DefaultProfiles()
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &RTPRelay{engine: engine, profiles: profiles, log: logger}, nil
}

// Register adds the Processor service to a server.
func (r *RTPRelay) Register(s grpc.ServiceRegistrar) {
	processor.RegisterProcessorServer(s, r)
}

// ProcessMessage is service.ts. Whatever goes wrong with RTPEngine is logged
// and becomes a 500 for the caller to relay, never a gRPC error.
func (r *RTPRelay) ProcessMessage(ctx context.Context, req *processor.MessageRequest) (*processor.MessageResponse, error) {
	res, err := r.process(ctx, req)
	if err != nil {
		r.log.Error("unable to relay the media", "ref", req.GetRef(), "error", err.Error())
		return internalServerError(), nil
	}
	return res, nil
}

func (r *RTPRelay) process(ctx context.Context, req *processor.MessageRequest) (*processor.MessageResponse, error) {
	if req.GetMessage() == nil {
		return nil, errors.New("the request has no message")
	}
	if shouldNotHandle(req) {
		return passThrough(req, req.GetMessage()), nil
	}
	direction, err := directionOf(req)
	if err != nil {
		return nil, err
	}
	callID := req.GetMessage().GetCallId().GetCallId()
	query, err := r.engine.Query(ctx, Params{"call-id": callID})
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	isNewCall := query.Result == resultError
	r.log.Debug("request", "ref", req.GetRef(), "direction", string(direction), "isNewCall", isNewCall, "method", req.GetMethod().String())

	profile := r.profiles[profileNameFor(direction, isSecurePhone(req.GetMessage().GetVia()[0].GetTransport()))]
	switch {
	case isInviteWithSDP(req):
		return send(req)(r.engine.Offer(ctx, offerParams(req, profile, false)))
	case isAckWithSDP(req):
		return send(req)(r.engine.Answer(ctx, answerParams(req, profile, true)))
	case isRinging(req) && direction == WebToPhone:
		// The FIXME of service.ts: a ringing body is not sent to the caller
		// while the call is being established
		return passThrough(req, withBody(req.GetMessage(), "")), nil
	case isResponseWithSDP(req) && isNewCall:
		return send(req)(r.engine.Offer(ctx, offerParams(req, profile, true)))
	case isResponseWithSDP(req):
		return send(req)(r.engine.Answer(ctx, answerParams(req, profile, false)))
	case isBye(req):
		return send(req)(r.engine.Delete(ctx, deleteParams(req)))
	}
	return passThrough(req, req.GetMessage()), nil
}

// send takes what RTPEngine answered and returns the request with its SDP. An
// answer without SDP (a delete) leaves the message without a body.
func send(req *processor.MessageRequest) func(Result, error) (*processor.MessageResponse, error) {
	return func(res Result, err error) (*processor.MessageResponse, error) {
		if err != nil {
			return nil, err
		}
		if res.Result == resultError {
			return nil, fmt.Errorf("rtpengine: %s", res.ErrorReason)
		}
		return passThrough(req, withBody(req.GetMessage(), res.SDP)), nil
	}
}

// offerParams is client.ts offer: the profile, then the keys of the message,
// which win over a profile that names them. invertTags is for the offer a
// response carries, where the offering party is the To.
func offerParams(req *processor.MessageRequest, profile Profile, invertTags bool) Params {
	msg := req.GetMessage()
	params := fromProfile(profile, 3)
	params["sdp"] = msg.GetBody()
	params["call-id"] = msg.GetCallId().GetCallId()
	params["from-tag"] = msg.GetFrom().GetTag()
	if invertTags {
		params["from-tag"] = msg.GetTo().GetTag()
	}
	return params
}

// answerParams is client.ts answer. An empty tag is sent as it is, as Node did:
// a response from a party that sets no To tag.
func answerParams(req *processor.MessageRequest, profile Profile, invertTags bool) Params {
	msg := req.GetMessage()
	params := fromProfile(profile, 4)
	params["sdp"] = msg.GetBody()
	params["call-id"] = msg.GetCallId().GetCallId()
	params["from-tag"], params["to-tag"] = msg.GetFrom().GetTag(), msg.GetTo().GetTag()
	if invertTags {
		params["from-tag"], params["to-tag"] = msg.GetTo().GetTag(), msg.GetFrom().GetTag()
	}
	return params
}

// deleteParams is client.ts del.
func deleteParams(req *processor.MessageRequest) Params {
	msg := req.GetMessage()
	return Params{"call-id": msg.GetCallId().GetCallId(), "from-tag": msg.GetFrom().GetTag()}
}

func fromProfile(profile Profile, extra int) Params {
	params := make(Params, len(profile)+extra)
	for key, value := range profile {
		params[key] = value
	}
	return params
}

// passThrough is res.send(req): the fields a MessageResponse shares with the
// request.
func passThrough(req *processor.MessageRequest, msg *sipmessage.SIPMessage) *processor.MessageResponse {
	return &processor.MessageResponse{Sender: req.GetSender(), Message: msg, Metadata: req.GetMetadata()}
}

// withBody is a copy of the message with another body. Only the messages with
// SDP pay for the copy.
func withBody(msg *sipmessage.SIPMessage, body string) *sipmessage.SIPMessage {
	out := proto.Clone(msg).(*sipmessage.SIPMessage)
	out.Body = body
	return out
}

// internalServerError is res.sendInternalServerError().
func internalServerError() *processor.MessageResponse {
	return &processor.MessageResponse{Message: &sipmessage.SIPMessage{
		MessageType:  &sipmessage.SIPMessage_ResponseType{ResponseType: sipmessage.ResponseType_SERVER_INTERNAL_ERROR},
		ReasonPhrase: "Internal Server Error",
	}}
}
