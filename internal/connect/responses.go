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
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The answers Connect gives on its own (mods/common/src/response.ts and
// mods/processor/src/response.ts): a MessageResponse whose message is a SIP
// response, with the reason phrases the Node code sends.

func statusResponse(t spb.ResponseType, reasonPhrase string) *ppb.MessageResponse {
	return &ppb.MessageResponse{
		Message: &spb.SIPMessage{
			MessageType:  &spb.SIPMessage_ResponseType{ResponseType: t},
			ReasonPhrase: reasonPhrase,
		},
	}
}

// challenge is createUnauthorizedResponse: a 401 with a fresh digest
// challenge for the realm, stale when the credentials were right but the
// nonce had expired (RFC 7616 section 3.3).
func challenge(realm, nonce string, stale bool) *ppb.MessageResponse {
	res := statusResponse(spb.ResponseType_UNAUTHORIZED, "Unauthorized")
	res.Message.WwwAuthenticate = &spb.WWWAuthenticate{
		Scheme:    "Digest",
		Realm:     realm,
		Qop:       "auth",
		Opaque:    "",
		Stale:     stale,
		Nonce:     nonce,
		Algorithm: auth.DefaultAlgorithm,
	}
	return res
}

func forbidden() *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_FORBIDDEN, "Forbidden")
}

func forbiddenWith(reasonPhrase string) *ppb.MessageResponse {
	if reasonPhrase == "" {
		reasonPhrase = "Forbidden"
	}
	return statusResponse(spb.ResponseType_FORBIDDEN, reasonPhrase)
}

// notFoundWith is createNotFoundResponse with its reason.
func notFoundWith(reasonPhrase string) *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_NOT_FOUND, reasonPhrase)
}

// badRequestWith is createBadRequestResponse with its reason.
func badRequestWith(reasonPhrase string) *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_BAD_REQUEST, reasonPhrase)
}

// unauthorizedWithoutChallenge is createUnauthorizedResponseWithoutChallenge,
// the answer to a source outside a Trunk's access control list: no
// credentials would change it.
func unauthorizedWithoutChallenge() *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_UNAUTHORIZED, "Unauthorized")
}

func temporarilyUnavailable() *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_TEMPORARILY_UNAVAILABLE, "Temporarily Unavailable")
}

func methodNotAllowed() *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_METHOD_NOT_ALLOWED, "Method Not Allowed")
}

func badGateway() *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_BAD_GATEWAY, "Bad Gateway")
}

// internalServerError is Response#sendInternalServerError, the answer to a
// failure while handling a request.
func internalServerError() *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_SERVER_INTERNAL_ERROR, "Internal Server Error")
}

// serverInternalError is createServerInternalErrorResponse, the router's
// answer when a Connect Token arrives and no verifier is configured.
func serverInternalError() *ppb.MessageResponse {
	return statusResponse(spb.ResponseType_SERVER_INTERNAL_ERROR, "Server Internal Error")
}

// registerOK is Response#sendRegisterOk: a 200 carrying the Contact the
// endpoint registered, and the recording flag when a resource asked for it.
func registerOK(req *ppb.MessageRequest, metadata map[string]string) *ppb.MessageResponse {
	res := statusResponse(spb.ResponseType_OK, "")
	res.Message.Contact = req.GetMessage().GetContact()
	if len(metadata) > 0 {
		res.Metadata = metadata
	}
	return res
}

// forward is Response#send with the altered request: the EdgePort sends the
// message on, from the sender the request named, with the metadata for the
// dispatcher.
func forward(req *ppb.MessageRequest, metadata map[string]string) *ppb.MessageResponse {
	return &ppb.MessageResponse{
		Sender:   req.GetSender(),
		Message:  req.GetMessage(),
		Metadata: metadata,
	}
}
