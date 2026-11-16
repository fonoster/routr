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
	"log/slog"
	"testing"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// fullResponse sets every field of a SIPMessage, by the descriptor: a field
// added to the proto is covered without touching this test.
func fullResponse() *spb.SIPMessage {
	msg := &spb.SIPMessage{}
	m := msg.ProtoReflect()
	fields := m.Descriptor().Fields()
	for i := range fields.Len() {
		fd := fields.Get(i)
		// The oneof takes the response side, set below
		if fd.ContainingOneof() != nil && !fd.ContainingOneof().IsSynthetic() {
			continue
		}
		switch {
		case fd.IsList():
			list := m.Mutable(fd).List()
			list.Append(list.NewElement())
			list.Append(list.NewElement())
		case fd.Kind() == protoreflect.MessageKind:
			m.Mutable(fd)
		case fd.Kind() == protoreflect.StringKind:
			m.Set(fd, protoreflect.ValueOfString(string(fd.Name())))
		}
	}
	msg.MessageType = &spb.SIPMessage_ResponseType{ResponseType: spb.ResponseType_OK}
	return msg
}

func TestShareResponseListsEverySIPMessageField(t *testing.T) {
	in := &ppb.MessageRequest{Ref: "r", Sender: &ppb.NetInterface{Host: "h"}, Message: fullResponse()}
	// What the deep copy and removeTopVia made
	want := proto.Clone(in).(*ppb.MessageRequest)
	removeTopVia(want)

	before := proto.Clone(in)
	got := shareResponse(in)

	if !proto.Equal(got.GetMessage(), want.GetMessage()) {
		t.Errorf("got %v, want %v", got.GetMessage(), want.GetMessage())
	}
	if !proto.Equal(got.GetSender(), want.GetSender()) {
		t.Error("the sender is lost")
	}
	if !proto.Equal(in, before) {
		t.Error("the message received changed")
	}
	if len(in.GetMessage().GetVia()) != 2 {
		t.Error("the received message lost its Via")
	}
}

func TestResponseIsTheSameWithoutTheDeepCopy(t *testing.T) {
	in := &ppb.MessageRequest{
		Ref:      "r",
		Sender:   &ppb.NetInterface{Host: "h"},
		Message:  fullResponse(),
		Metadata: map[string]string{"k": "v"},
	}
	c := &Connect{log: slog.New(slog.DiscardHandler)}
	res, err := c.ProcessMessage(t.Context(), in)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.GetMessage().GetVia()) != 1 || res.GetMetadata()["k"] != "v" || res.GetSender().GetHost() != "h" {
		t.Errorf("%v", res)
	}
	opts := proto.MarshalOptions{Deterministic: true}
	if b, err := opts.Marshal(res); err != nil || len(b) == 0 {
		t.Errorf("%v", err)
	}
}

// BenchmarkResponse is what Connect allocates per response.
func BenchmarkResponse(b *testing.B) {
	in := &ppb.MessageRequest{Ref: "r", Sender: &ppb.NetInterface{Host: "h"}, Message: fullResponse()}
	c := &Connect{log: slog.New(slog.DiscardHandler)}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		if _, err := c.ProcessMessage(b.Context(), in); err != nil {
			b.Fatal(err)
		}
	}
}
