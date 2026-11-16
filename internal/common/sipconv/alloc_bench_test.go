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
package sipconv

import (
	"testing"

	"github.com/emiago/sipgo/sip"
)

const benchMessage = "INVITE sip:1002@sip.local SIP/2.0\r\n" +
	"Via: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1;rport\r\n" +
	"Record-Route: <sip:10.0.0.1;lr>\r\nRoute: <sip:10.0.0.9:5080;lr>\r\n" +
	"Max-Forwards: 70\r\nFrom: \"Alice\" <sip:1001@sip.local>;tag=f1\r\nTo: <sip:1002@sip.local>\r\n" +
	"Call-ID: 1-25@10.0.0.2\r\nCSeq: 1 INVITE\r\nContact: <sip:1001@10.0.0.2:5070;transport=udp>\r\n" +
	"Allow: INVITE,ACK,BYE,CANCEL,OPTIONS\r\nSupported: replaces,timer\r\nUser-Agent: bench\r\n" +
	"Content-Type: application/sdp\r\nContent-Length: 0\r\n\r\n"

func benchParse(b *testing.B) *sip.Request {
	b.Helper()
	msg, err := NewParser().ParseSIP([]byte(benchMessage))
	if err != nil {
		b.Fatal(err)
	}
	return msg.(*sip.Request)
}

// BenchmarkMessageToDTO is the allocations of the conversion at the boundary,
// per message.
func BenchmarkMessageToDTO(b *testing.B) {
	req := benchParse(b)
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		if _, err := MessageToDTO(req); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkMessageRequest adds what the converter puts around the message.
func BenchmarkMessageRequest(b *testing.B) {
	req := benchParse(b)
	req.SetSource("10.0.0.2:5070")
	c := &Converter{EdgePortRef: "ep", EdgePortVersion: "v", BindAddr: "10.0.0.1"}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		if _, err := c.MessageRequest(req, 5060); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkHeadersFromDTO is the way back.
func BenchmarkHeadersFromDTO(b *testing.B) {
	dto, err := MessageToDTO(benchParse(b))
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		_ = HeadersFromDTO(dto)
	}
}

// BenchmarkGroupHeaders is the grouping alone, once a map per message.
func BenchmarkGroupHeaders(b *testing.B) {
	headers := benchParse(b).Headers()
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		_ = groupHeaders(headers)
	}
}

func TestGroupHeadersKeepsFirstSeenOrderAndGroupsAnyCase(t *testing.T) {
	headers := []sip.Header{
		sip.NewHeader("X-One", "1"),
		sip.NewHeader("x-two", "2"),
		sip.NewHeader("X-ONE", "3"),
		sip.NewHeader("k", "compact"),
		sip.NewHeader("Supported", "long"),
	}
	groups := groupHeaders(headers)
	if len(groups) != 3 {
		t.Fatalf("%d groups", len(groups))
	}
	if groups[0].name != "X-One" || len(groups[0].headers) != 2 || groups[0].headers[1].Value() != "3" {
		t.Errorf("%+v", groups[0])
	}
	if groups[1].name != "x-two" {
		t.Errorf("%+v", groups[1])
	}
	if groups[2].name != "Supported" || len(groups[2].headers) != 2 {
		t.Errorf("%+v", groups[2])
	}
	if headers[1].Value() != "2" {
		t.Error("growing a group wrote over the input")
	}
}

// Past groupsBeforeIndex names the map takes over: the same groups, in the same
// order, without a cost that grows with their square.
func TestGroupHeadersPastTheIndexThreshold(t *testing.T) {
	var headers []sip.Header
	for i := range 3 * groupsBeforeIndex {
		headers = append(headers, sip.NewHeader("X-"+string(rune('A'+i%26))+string(rune('a'+i/26)), "v"))
	}
	headers = append(headers, sip.NewHeader("x-aA", "again"), sip.NewHeader("X-AA", "again"))
	groups := groupHeaders(headers)
	if len(groups) != 3*groupsBeforeIndex {
		t.Fatalf("%d groups", len(groups))
	}
	if groups[0].name != "X-Aa" || len(groups[0].headers) != 3 {
		t.Errorf("%+v", groups[0])
	}
}

func TestCanonicalNameFastPathAgreesWithTheSlowOne(t *testing.T) {
	for name, want := range exactNames {
		if got := CanonicalName(" " + name + " "); got != want {
			t.Errorf("%q: %q", name, got)
		}
		if got := CanonicalName(name); got != want {
			t.Errorf("%q: %q", name, got)
		}
	}
}
