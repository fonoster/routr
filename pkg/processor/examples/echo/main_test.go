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

package main

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/fonoster/routr/pkg/processor"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The Go echo answers what mods/echo answers with sendOk(): 200 "OK" and
// nothing else, whatever the method. A REGISTER gets no Contact back, since
// the Node echo does not call sendRegisterOk.
func TestEchoAnswersOK(t *testing.T) {
	handler := echo(slog.New(slog.NewTextHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelDebug})))
	for _, method := range []processor.Method{processor.Method_INVITE, processor.Method_MESSAGE, processor.Method_REGISTER} {
		t.Run(method.String(), func(t *testing.T) {
			req := &processor.MessageRequest{
				Ref:      "call-01",
				Method:   method,
				Sender:   &processor.NetInterface{Host: "127.0.0.1", Port: 5060},
				Metadata: map[string]string{"k": "v"},
				Message: &sipmessage.SIPMessage{
					Contact:    &sipmessage.Contact{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{User: "1001", Host: "127.0.0.1"}}},
					Extensions: []*sipmessage.Extension{{Name: "User-Agent", Value: "test"}},
				},
			}
			res, err := handler(context.Background(), req)
			if err != nil {
				t.Fatalf("echo returned an error: %v", err)
			}
			msg := res.GetMessage()
			if got := msg.GetResponseType(); got != sipmessage.ResponseType_OK {
				t.Errorf("response type = %v, want OK", got)
			}
			if got := msg.GetReasonPhrase(); got != "OK" {
				t.Errorf("reason phrase = %q, want OK", got)
			}
			if len(msg.GetExtensions()) != 0 {
				t.Errorf("extensions = %v, want none", msg.GetExtensions())
			}
			if msg.GetContact() != nil {
				t.Errorf("contact = %v, want none", msg.GetContact())
			}
			if len(res.GetMetadata()) != 0 {
				t.Errorf("metadata = %v, want none", res.GetMetadata())
			}
			if res.GetSender() != nil {
				t.Errorf("sender = %v, want none", res.GetSender())
			}
		})
	}
}
