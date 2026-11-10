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

package processor

import (
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// Header is a SIP header a response helper adds to its answer.
type Header struct {
	Name, Value string
}

// OK answers 200 "OK", with the extra headers.
func OK(extra ...Header) *MessageResponse {
	return response(sipmessage.ResponseType_OK, "OK", extra)
}

// RegisterOK answers a REGISTER with 200 and no reason phrase, keeping the
// request's Contact. metadata is for the Dispatcher (the recording flag, for
// one); it is left out when empty.
func RegisterOK(req *MessageRequest, metadata map[string]string, extra ...Header) *MessageResponse {
	res := response(sipmessage.ResponseType_OK, "", extra)
	res.Message.Contact = req.GetMessage().GetContact()
	if len(metadata) > 0 {
		res.Metadata = metadata
	}
	return res
}

// MethodNotAllowed answers 405 "Method Not Allowed".
func MethodNotAllowed() *MessageResponse {
	return response(sipmessage.ResponseType_METHOD_NOT_ALLOWED, "Method Not Allowed", nil)
}

// NotFound answers 404 "Not Found".
func NotFound() *MessageResponse {
	return response(sipmessage.ResponseType_NOT_FOUND, "Not Found", nil)
}

// TemporarilyUnavailable answers 480 "Temporarily Unavailable".
func TemporarilyUnavailable() *MessageResponse {
	return response(sipmessage.ResponseType_TEMPORARILY_UNAVAILABLE, "Temporarily Unavailable", nil)
}

// NotImplemented answers 501 "Not Implemented".
func NotImplemented() *MessageResponse {
	return response(sipmessage.ResponseType_NOT_IMPLEMENTED, "Not Implemented", nil)
}

// BadGateway answers 502: the next hop cannot be reached as configured. An
// empty reason is "Bad Gateway".
func BadGateway(reason string) *MessageResponse {
	if reason == "" {
		reason = "Bad Gateway"
	}
	return response(sipmessage.ResponseType_BAD_GATEWAY, reason, nil)
}

// InternalServerError answers 500 "Internal Server Error".
func InternalServerError() *MessageResponse {
	return response(sipmessage.ResponseType_SERVER_INTERNAL_ERROR, "Internal Server Error", nil)
}

// Forbidden answers 403. An empty reason is "Forbidden".
func Forbidden(reason string) *MessageResponse {
	if reason == "" {
		reason = "Forbidden"
	}
	return response(sipmessage.ResponseType_FORBIDDEN, reason, nil)
}

// Forward sends the request on: the answer carries the request's Sender,
// Message and Metadata, as the handler left them, and nothing else.
func Forward(req *MessageRequest) *MessageResponse {
	return &MessageResponse{
		Sender:   req.GetSender(),
		Message:  req.GetMessage(),
		Metadata: req.GetMetadata(),
	}
}

// response is a SIP response of one type, with its reason phrase and the
// extra headers as extensions.
func response(code sipmessage.ResponseType, reason string, extra []Header) *MessageResponse {
	var extensions []*sipmessage.Extension
	for _, h := range extra {
		extensions = append(extensions, &sipmessage.Extension{Name: h.Name, Value: h.Value})
	}
	return &MessageResponse{
		Message: &sipmessage.SIPMessage{
			MessageType:  &sipmessage.SIPMessage_ResponseType{ResponseType: code},
			ReasonPhrase: reason,
			Extensions:   extensions,
		},
	}
}
