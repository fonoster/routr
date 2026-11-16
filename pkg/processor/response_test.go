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
	"testing"

	"github.com/fonoster/routr/pkg/processor/pb/common"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

func TestResponseHelpers(t *testing.T) {
	tests := []struct {
		name   string
		res    *MessageResponse
		code   sipmessage.ResponseType
		reason string
	}{
		{"OK", OK(), sipmessage.ResponseType_OK, "OK"},
		{"MethodNotAllowed", MethodNotAllowed(), sipmessage.ResponseType_METHOD_NOT_ALLOWED, "Method Not Allowed"},
		{"NotFound", NotFound(), sipmessage.ResponseType_NOT_FOUND, "Not Found"},
		{"TemporarilyUnavailable", TemporarilyUnavailable(), sipmessage.ResponseType_TEMPORARILY_UNAVAILABLE, "Temporarily Unavailable"},
		{"NotImplemented", NotImplemented(), sipmessage.ResponseType_NOT_IMPLEMENTED, "Not Implemented"},
		{"BadGateway", BadGateway("no route to the trunk"), sipmessage.ResponseType_BAD_GATEWAY, "no route to the trunk"},
		{"BadGateway fallback", BadGateway(""), sipmessage.ResponseType_BAD_GATEWAY, "Bad Gateway"},
		{"InternalServerError", InternalServerError(), sipmessage.ResponseType_SERVER_INTERNAL_ERROR, "Internal Server Error"},
		{"Forbidden", Forbidden("not your domain"), sipmessage.ResponseType_FORBIDDEN, "not your domain"},
		{"Forbidden fallback", Forbidden(""), sipmessage.ResponseType_FORBIDDEN, "Forbidden"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := tt.res.GetMessage()
			if _, ok := msg.GetMessageType().(*sipmessage.SIPMessage_ResponseType); !ok {
				t.Fatalf("message type = %T, want a response type", msg.GetMessageType())
			}
			if got := msg.GetResponseType(); got != tt.code {
				t.Errorf("response type = %v, want %v", got, tt.code)
			}
			if got := msg.GetReasonPhrase(); got != tt.reason {
				t.Errorf("reason phrase = %q, want %q", got, tt.reason)
			}
			if len(msg.GetExtensions()) != 0 {
				t.Errorf("extensions = %v, want none", msg.GetExtensions())
			}
			if tt.res.GetSender() != nil || tt.res.GetMetadata() != nil {
				t.Errorf("sender = %v, metadata = %v, want neither", tt.res.GetSender(), tt.res.GetMetadata())
			}
		})
	}
}

func TestOKExtraHeaders(t *testing.T) {
	res := OK(Header{Name: "X-One", Value: "1"}, Header{Name: "X-Two", Value: "2"})
	ext := res.GetMessage().GetExtensions()
	if len(ext) != 2 {
		t.Fatalf("extensions = %v, want two", ext)
	}
	if ext[0].GetName() != "X-One" || ext[0].GetValue() != "1" || ext[1].GetName() != "X-Two" || ext[1].GetValue() != "2" {
		t.Errorf("extensions = %v, want X-One: 1 then X-Two: 2", ext)
	}
}

func TestRegisterOK(t *testing.T) {
	contact := &sipmessage.Contact{}
	req := &MessageRequest{Message: &sipmessage.SIPMessage{Contact: contact}}

	res := RegisterOK(req, map[string]string{}, Header{Name: "X-One", Value: "1"})
	if got := res.GetMessage().GetResponseType(); got != sipmessage.ResponseType_OK {
		t.Errorf("response type = %v, want OK", got)
	}
	if got := res.GetMessage().GetReasonPhrase(); got != "" {
		t.Errorf("reason phrase = %q, want none", got)
	}
	if res.GetMessage().GetContact() != contact {
		t.Errorf("contact = %v, want the request's", res.GetMessage().GetContact())
	}
	if res.Metadata != nil {
		t.Errorf("metadata = %v, want nil for an empty map", res.Metadata)
	}
	if ext := res.GetMessage().GetExtensions(); len(ext) != 1 || ext[0].GetName() != "X-One" {
		t.Errorf("extensions = %v, want X-One", ext)
	}

	if res := RegisterOK(req, nil); res.Metadata != nil {
		t.Errorf("metadata = %v, want nil for a nil map", res.Metadata)
	}

	res = RegisterOK(req, map[string]string{"recording": "true"})
	if got := res.GetMetadata()["recording"]; got != "true" {
		t.Errorf("metadata = %v, want recording=true", res.GetMetadata())
	}
}

func TestForward(t *testing.T) {
	req := &MessageRequest{
		Ref:      "call-1",
		Method:   Method_INVITE,
		Sender:   &NetInterface{Host: "10.0.0.1", Port: 5060, Transport: common.Transport_UDP},
		Message:  &sipmessage.SIPMessage{Body: "v=0"},
		Metadata: map[string]string{"k": "v"},
	}
	res := Forward(req)
	if res.GetSender() != req.GetSender() {
		t.Errorf("sender = %v, want the request's", res.GetSender())
	}
	if res.GetMessage() != req.GetMessage() {
		t.Errorf("message = %v, want the request's", res.GetMessage())
	}
	if got := res.GetMetadata()["k"]; got != "v" || len(res.GetMetadata()) != 1 {
		t.Errorf("metadata = %v, want the request's", res.GetMetadata())
	}
}
