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

package trace

import (
	"reflect"
	"strings"
	"testing"

	"google.golang.org/protobuf/proto"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The behavior spec: mods/common/test/trace.unit.test.ts.

func sampleMessage() *pb.SIPMessage {
	return &pb.SIPMessage{
		MessageType: &pb.SIPMessage_RequestUri{RequestUri: &pb.SipURI{User: "17853178070", Host: "sip.local"}},
		From: &pb.From{
			Address: &pb.Address{DisplayName: "John Doe", Uri: &pb.SipURI{User: "1001", Host: "sip.local"}},
			Tag:     "1",
		},
		To:          &pb.To{Address: &pb.Address{Uri: &pb.SipURI{User: "17853178070", Host: "sip.local"}}},
		Contact:     &pb.Contact{Address: &pb.Address{Uri: &pb.SipURI{User: "1001", Host: "10.0.0.2", Port: 5060}}},
		CallId:      &pb.CallID{CallId: "1-25@10.0.0.2"},
		MaxForwards: &pb.MaxForwards{MaxForwards: 70},
		Authorization: &pb.Authorization{
			Realm: "sip.local", Scheme: "Digest", Nonce: "abc", CNonce: "def", NonceCount: 1,
			Response: "7a0c1b", Username: "1001", Uri: "sip:sip.local", Algorithm: "MD5", Qop: "auth",
		},
		Extensions: []*pb.Extension{
			{Name: "CSeq", Value: "2 INVITE"},
			{Name: "X-Gateway-Auth", Value: "dXNlcjpwYXNz"},
			{Name: "Privacy", Value: "id"},
		},
		Via: []*pb.Via{{Host: "10.0.0.2", Port: 5060, Transport: "UDP", Branch: "z9hG4bK-1", RPortFlag: true}},
	}
}

func TestRedactMessageRemovesCredentialsAndKeepsTheRest(t *testing.T) {
	m := sampleMessage()
	m.GetFrom().GetAddress().GetUri().UserPassword = "secret"
	m.GetRequestUri().UserPassword = "secret"
	r := RedactMessage(m)
	if r.GetAuthorization().GetResponse() != Redacted || r.GetAuthorization().GetCNonce() != Redacted {
		t.Errorf("authorization: %v", r.GetAuthorization())
	}
	if r.GetAuthorization().GetNonce() != "abc" || r.GetAuthorization().GetUsername() != "1001" {
		t.Errorf("kept: %v", r.GetAuthorization())
	}
	if got := r.GetExtensions()[1].GetValue(); got != Redacted {
		t.Errorf("X-Gateway-Auth: %s", got)
	}
	if got := r.GetExtensions()[0].GetValue(); got != "2 INVITE" {
		t.Errorf("CSeq: %s", got)
	}
	if r.GetFrom().GetAddress().GetUri().GetUserPassword() != Redacted || r.GetRequestUri().GetUserPassword() != Redacted {
		t.Error("URI passwords stay")
	}
}

func TestRedactMessageDoesNotTouchTheOriginal(t *testing.T) {
	m := sampleMessage()
	RedactMessage(m)
	if !proto.Equal(m, sampleMessage()) {
		t.Error("the original changed")
	}
}

func TestRedactMessageNil(t *testing.T) {
	if RedactMessage(nil) != nil {
		t.Error("nil stays nil")
	}
}

func TestFormatURIRendersAsOnTheWire(t *testing.T) {
	got := FormatURI(&pb.SipURI{User: "+1555", Host: "sip.provider.net", Port: 7060, TransportParam: "UDP", UserParam: "phone"})
	if want := "sip:+1555@sip.provider.net:7060;transport=udp;user=phone"; got != want {
		t.Errorf("got %s", got)
	}
	// An unset port of the Java converter reads as in the corpus
	if got := FormatURI(&pb.SipURI{User: "1002", Host: "sip.local", Port: -1}); got != "sip:1002@sip.local:-1" {
		t.Errorf("got %s", got)
	}
	if FormatURI(nil) != "" {
		t.Error("nil is empty")
	}
}

func TestFlattenKeepsMultiValuedHeadersInOrder(t *testing.T) {
	f := flatten(sampleMessage())
	via, _ := f.get("Via")
	if !reflect.DeepEqual(via.values, []string{"SIP/2.0/UDP 10.0.0.2:5060;branch=z9hG4bK-1;rport"}) {
		t.Errorf("Via: %v", via.values)
	}
	from, _ := f.get("From")
	if len(from.values) != 1 || !strings.Contains(from.values[0], "John Doe") || !strings.Contains(from.values[0], "<sip:1001@sip.local>;tag=1") {
		t.Errorf("From: %v", from.values)
	}
	if mf, _ := f.get("Max-Forwards"); !reflect.DeepEqual(mf.values, []string{"70"}) {
		t.Errorf("Max-Forwards: %v", mf.values)
	}
}

func TestFlattenSummarizesTheBodyByItsMediaLines(t *testing.T) {
	m := &pb.SIPMessage{Body: "v=0\r\nc=IN IP4 10.0.0.1\r\nm=audio 6000 RTP/AVP 0\r\na=sendrecv\r\n"}
	body, _ := flatten(m).get("Body")
	if !reflect.DeepEqual(body.values, []string{"c=IN IP4 10.0.0.1 m=audio 6000 RTP/AVP 0"}) {
		t.Errorf("Body: %v", body.values)
	}
}

func TestDiffMessagesReportsAddedRemovedChangedAndTheRequestURI(t *testing.T) {
	before, after := sampleMessage(), sampleMessage()
	after.MessageType = &pb.SIPMessage_RequestUri{RequestUri: &pb.SipURI{User: "17853178070", Host: "sip.provider.net"}}
	after.MaxForwards = &pb.MaxForwards{MaxForwards: 69}
	after.Via = append([]*pb.Via{{Host: "10.0.1.1", Port: 5060, Transport: "UDP", Branch: "z9hG4bK-2"}}, after.Via...)
	after.Extensions = []*pb.Extension{after.Extensions[0], after.Extensions[1], {Name: "P-Asserted-Identity", Value: "<sip:+1@x;user=phone>"}}
	after.Authorization = nil

	diff := DiffMessages(before, after)
	if diff.RequestURI == nil || diff.RequestURI.From != "sip:17853178070@sip.local" || diff.RequestURI.To != "sip:17853178070@sip.provider.net" {
		t.Errorf("requestUri: %+v", diff.RequestURI)
	}
	if len(diff.Added) != 1 || diff.Added[0].Name != "P-Asserted-Identity" {
		t.Errorf("added: %+v", diff.Added)
	}
	if len(diff.Removed) != 2 || diff.Removed[0].Name != "Authorization" || diff.Removed[1].Name != "Privacy" {
		t.Errorf("removed: %+v", diff.Removed)
	}
	changed := map[string]HeaderChange{}
	for _, c := range diff.Changed {
		changed[c.Name] = c.HeaderChange
	}
	if changed["Max-Forwards"] != (HeaderChange{From: "70", To: "69"}) {
		t.Errorf("Max-Forwards: %+v", changed["Max-Forwards"])
	}
	if !strings.Contains(changed["Via"].To, "z9hG4bK-2") {
		t.Errorf("Via: %+v", changed["Via"])
	}
	if diff.IsEmpty() {
		t.Error("the diff is not empty")
	}
	if !DiffMessages(before, sampleMessage()).IsEmpty() {
		t.Error("equal messages have an empty diff")
	}
}

func TestStatusCodeOf(t *testing.T) {
	cases := map[pb.ResponseType]int{
		pb.ResponseType_RINGING:                            180,
		pb.ResponseType_CALL_OR_TRANSACTION_DOES_NOT_EXIST: 481,
		pb.ResponseType_SUCCESS:                            200,
		pb.ResponseType_UNKNOWN:                            0,
		pb.ResponseType(999):                               0,
	}
	for rt, want := range cases {
		if got := StatusCodeOf(rt); got != want {
			t.Errorf("%v: got %d, want %d", rt, got, want)
		}
	}
	// Every type the proto carries but UNKNOWN has a code
	for value := range pb.ResponseType_name {
		rt := pb.ResponseType(value)
		if rt != pb.ResponseType_UNKNOWN && StatusCodeOf(rt) == 0 {
			t.Errorf("%v has no code", rt)
		}
	}
}

func TestSplitSeparatesTraceMetadataFromWhatTheEdgePortMaySee(t *testing.T) {
	split := Split(map[string]string{
		"trace.record":    "trunk-01",
		"trace.direction": "agentToPSTN",
		"accountRef":      "acc-1",
	})
	if split.Flag != "trunk-01" {
		t.Errorf("flag: %s", split.Flag)
	}
	if !reflect.DeepEqual(split.Hop, map[string]string{"direction": "agentToPSTN"}) {
		t.Errorf("hop: %v", split.Hop)
	}
	if !reflect.DeepEqual(split.Rest, map[string]string{"accountRef": "acc-1"}) {
		t.Errorf("rest: %v", split.Rest)
	}
	if empty := Split(nil); empty.Flag != "" || empty.Hop != nil || empty.Rest != nil {
		t.Errorf("empty: %+v", empty)
	}
}
