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

package rtprelay

import (
	"errors"
	"strings"

	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// Direction is which kinds of endpoint a message goes between.
type Direction string

// The directions of utils.ts.
const (
	WebToWeb     Direction = "web-to-web"
	WebToPhone   Direction = "web-to-phone"
	PhoneToWeb   Direction = "phone-to-web"
	PhoneToPhone Direction = "phone-to-phone"
)

// directionOf reads the direction from the transport the message came in on
// and its top Via: on a request the EdgePort's own Via, facing the next hop;
// on a response the party it goes back to. A message with no Via has no
// direction (in Node, a TypeError that became a 500).
func directionOf(req *processor.MessageRequest) (Direction, error) {
	via := req.GetMessage().GetVia()
	if len(via) == 0 {
		return "", errors.New("the message has no Via")
	}
	return directionBetween(req.GetSender().GetTransport().String(), via[0].GetTransport()), nil
}

func directionBetween(src, dst string) Direction {
	switch {
	case isWebRTC(src) && isWebRTC(dst):
		return WebToWeb
	case isWebRTC(src):
		return WebToPhone
	case isWebRTC(dst):
		return PhoneToWeb
	}
	return PhoneToPhone
}

func isWebRTC(transport string) bool {
	return strings.EqualFold(transport, common.Transport_WS.String()) ||
		strings.EqualFold(transport, common.Transport_WSS.String())
}

// isSecurePhone is a phone leg reached over TLS, how a carrier that requires
// secure trunking is configured. SRTP follows the transport.
func isSecurePhone(transport string) bool {
	return strings.EqualFold(transport, common.Transport_TLS.String())
}

// The predicates of mods/processor/src/helper.ts.

func isResponse(req *processor.MessageRequest) bool {
	_, ok := req.GetMessage().GetMessageType().(*sipmessage.SIPMessage_ResponseType)
	return ok
}

func hasSDP(req *processor.MessageRequest) bool {
	return req.GetMessage().GetBody() != ""
}

func isRinging(req *processor.MessageRequest) bool {
	return isResponse(req) && req.GetMessage().GetResponseType() == sipmessage.ResponseType_RINGING
}

func isOk(req *processor.MessageRequest) bool {
	return isResponse(req) && req.GetMessage().GetResponseType() == sipmessage.ResponseType_OK
}

// isOfferWithSDP is a request whose SDP is an offer: an INVITE, or an UPDATE
// in a call (RFC 3311).
func isOfferWithSDP(req *processor.MessageRequest) bool {
	return !isResponse(req) && hasSDP(req) && (req.GetMethod() == processor.Method_INVITE || req.GetMethod() == processor.Method_UPDATE)
}

// isAnswerWithSDP is a request whose SDP answers an offer: an ACK, or a PRACK
// answering a reliable provisional response's offer (RFC 3262).
func isAnswerWithSDP(req *processor.MessageRequest) bool {
	return !isResponse(req) && hasSDP(req) && (req.GetMethod() == processor.Method_ACK || req.GetMethod() == processor.Method_PRACK)
}

func isResponseWithSDP(req *processor.MessageRequest) bool {
	return isResponse(req) && hasSDP(req)
}

func isBye(req *processor.MessageRequest) bool {
	return !isResponse(req) && req.GetMethod() == processor.Method_BYE
}

// shouldNotHandle is utils.ts shouldNotHandleRequest: what goes through the
// relay untouched, with no call to RTPEngine.
func shouldNotHandle(req *processor.MessageRequest) bool {
	return !(isOfferWithSDP(req) || isAnswerWithSDP(req) ||
		(isResponseWithSDP(req) && (isOk(req) || isRinging(req))) ||
		isRinging(req) || isBye(req))
}
