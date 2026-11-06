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

package registry

import (
	"strings"
	"testing"
	"time"

	"google.golang.org/protobuf/proto"

	commonpb "github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
	requesterpb "github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// fixedNow is a clock that doesn't move.
func fixedNow() time.Time {
	return time.UnixMilli(1661701508130)
}

func testParams() RequestParams {
	return RequestParams{
		TrunkRef:      "trunk-01",
		User:          "user",
		TargetDomain:  "sip.provider.net",
		TargetAddress: "sip.provider.net:5060",
		ProxyAddress:  "sip.proxy01.net:5070",
		Transport:     "TCP",
		Methods:       []string{"INVITE"},
		Auth:          &Auth{Username: "1001", Secret: "1234"},
	}
}

// TestBuildMakesRoutr2sRequest pins the whole message: SEET's registration
// scenarios depend on it. Only the Call-ID and the From tag vary.
func TestBuildMakesRoutr2sRequest(t *testing.T) {
	request, err := newRequestBuilder(fixedNow).build(testParams())
	if err != nil {
		t.Fatal(err)
	}

	tag := request.GetMessage().GetFrom().GetTag()
	if len(tag) != 8 {
		t.Errorf("the From tag is uniqid.time(), 8 characters: %q", tag)
	}
	if callID := request.GetMessage().GetCallId().GetCallId(); callID == "" {
		t.Error("the request needs a Call-ID")
	}
	request.Message.From.Tag = ""
	request.Message.CallId.CallId = ""

	aor := &sipmessage.Address{Uri: &sipmessage.SipURI{
		User:           "user",
		Host:           "sip.provider.net",
		Port:           -1,
		TransportParam: "TCP",
	}}
	want := &requesterpb.SendMessageRequest{
		Target:    "sip.provider.net:5060",
		Method:    processor.Method_REGISTER,
		Transport: commonpb.Transport_TCP,
		Message: &sipmessage.SIPMessage{
			MessageType: &sipmessage.SIPMessage_RequestUri{RequestUri: &sipmessage.SipURI{
				User:           "user",
				Host:           "sip.provider.net",
				Port:           5060,
				TransportParam: "TCP",
				MethodParam:    "REGISTER",
			}},
			Extensions: []*sipmessage.Extension{
				{Name: "Allow", Value: "INVITE"},
				{Name: "CSeq", Value: "1 REGISTER"},
				{Name: "User-Agent", Value: "Routr Connect v2"},
				{Name: "Allow-Events", Value: "presence"},
				{Name: "Proxy-Require", Value: "gin"},
				{Name: "Require", Value: "gin"},
				{Name: "Supported", Value: "path"},
				{Name: "X-Gateway-Auth", Value: "MTAwMToxMjM0"},
			},
			Route: []*sipmessage.Route{{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{
				Host:           "sip.proxy01.net",
				Port:           5070,
				TransportParam: "TCP",
				LrParam:        true,
			}}}},
			From:          &sipmessage.From{Address: aor},
			To:            &sipmessage.To{Address: aor},
			CallId:        &sipmessage.CallID{},
			ContentLength: &sipmessage.ContentLength{},
			Expires:       &sipmessage.Expires{Expires: 600},
			MaxForwards:   &sipmessage.MaxForwards{MaxForwards: 70},
		},
	}
	if !proto.Equal(request, want) {
		t.Errorf("the request:\n got %v\nwant %v", request, want)
	}
}

func TestBuildHonorsTheOptionalParams(t *testing.T) {
	params := testParams()
	params.UserAgent = "Custom"
	params.Expires = 300
	params.MaxForwards = 10
	params.Secure = true
	params.Methods = nil
	params.Auth = nil
	request, err := newRequestBuilder(fixedNow).build(params)
	if err != nil {
		t.Fatal(err)
	}
	message := request.GetMessage()
	if message.GetExpires().GetExpires() != 300 || message.GetMaxForwards().GetMaxForwards() != 10 {
		t.Errorf("expires and max-forwards: %v", message)
	}
	if !message.GetRequestUri().GetSecure() || !message.GetFrom().GetAddress().GetUri().GetSecure() || !message.GetTo().GetAddress().GetUri().GetSecure() {
		t.Errorf("secure: %v", message)
	}
	extensions := message.GetExtensions()
	if len(extensions) != 6 {
		t.Fatalf("no Allow and no X-Gateway-Auth: %v", extensions)
	}
	if extensions[0].GetName() != "CSeq" || extensions[1].GetValue() != "Custom" {
		t.Errorf("the extensions: %v", extensions)
	}
}

func TestBuildCountsCSeqAcrossRequests(t *testing.T) {
	builder := newRequestBuilder(fixedNow)
	cseqOf := func() string {
		t.Helper()
		params := testParams()
		params.Methods = nil
		request, err := builder.build(params)
		if err != nil {
			t.Fatal(err)
		}
		return request.GetMessage().GetExtensions()[0].GetValue()
	}
	if got := cseqOf(); got != "1 REGISTER" {
		t.Errorf("first CSeq: %s", got)
	}
	if got := cseqOf(); got != "2 REGISTER" {
		t.Errorf("second CSeq: %s", got)
	}

	// A request that fails spends its number
	bad := testParams()
	bad.ProxyAddress = "sip.proxy01.net"
	if _, err := builder.build(bad); err == nil {
		t.Fatal("a bad proxy address is an error")
	}
	if got := cseqOf(); got != "4 REGISTER" {
		t.Errorf("CSeq after a failure: %s", got)
	}

	// Another builder starts over: the count is no global
	params := testParams()
	params.Methods = nil
	request, err := newRequestBuilder(fixedNow).build(params)
	if err != nil {
		t.Fatal(err)
	}
	if got := request.GetMessage().GetExtensions()[0].GetValue(); got != "1 REGISTER" {
		t.Errorf("CSeq of a new builder: %s", got)
	}
}

func TestBuildRejectsBadAddresses(t *testing.T) {
	for name, change := range map[string]func(*RequestParams){
		"proxy":  func(p *RequestParams) { p.ProxyAddress = "sip.local" },
		"target": func(p *RequestParams) { p.TargetAddress = "sip.local" },
	} {
		params := testParams()
		change(&params)
		_, err := newRequestBuilder(fixedNow).build(params)
		if err == nil || !strings.Contains(err.Error(), "malformated address") {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestSplitAddress(t *testing.T) {
	host, port, err := splitAddress("sip.local:5060")
	if err != nil || host != "sip.local" || port != 5060 {
		t.Errorf("good address: %s %d %v", host, port, err)
	}
	for _, bad := range []string{"sip.local", "a:b:5060", "sip.local:port", "sip.local:"} {
		if _, _, err := splitAddress(bad); err == nil || !strings.Contains(err.Error(), "malformated address") {
			t.Errorf("%q: %v", bad, err)
		}
	}
}

func TestTransportOf(t *testing.T) {
	for name, want := range map[string]commonpb.Transport{
		"UDP":  commonpb.Transport_UDP,
		"TCP":  commonpb.Transport_TCP,
		"TLS":  commonpb.Transport_TLS,
		"SCTP": commonpb.Transport_SCTP,
		"WS":   commonpb.Transport_WS,
		"WSS":  commonpb.Transport_WSS,
		"tcp":  commonpb.Transport_UDP,
		"":     commonpb.Transport_UDP,
	} {
		if got := transportOf(name); got != want {
			t.Errorf("%q: %v", name, got)
		}
	}
}

func TestTagsAndCallIDsDontRepeatOnAStoppedClock(t *testing.T) {
	builder := newRequestBuilder(fixedNow)
	if first, second := builder.newTag(), builder.newTag(); first == second {
		t.Errorf("two tags: %s", first)
	}
	first, second := builder.newCallID(), builder.newCallID()
	if first == second {
		t.Errorf("two Call-IDs: %s", first)
	}
	if len(first) != 18 {
		t.Errorf("a Call-ID has uniqid's length: %q", first)
	}
}
