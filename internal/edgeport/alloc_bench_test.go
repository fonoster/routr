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
package edgeport

import (
	"testing"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

const benchInvite = "INVITE sip:1002@sip.local SIP/2.0\r\n" +
	"Via: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1;rport\r\n" +
	"Max-Forwards: 70\r\nFrom: \"Alice\" <sip:1001@sip.local>;tag=f1\r\nTo: <sip:1002@sip.local>\r\n" +
	"Call-ID: 1-25@10.0.0.2\r\nCSeq: 1 INVITE\r\nContact: <sip:1001@10.0.0.2:5070;transport=udp>\r\n" +
	"Allow: INVITE,ACK,BYE,CANCEL,OPTIONS\r\nSupported: replaces,timer\r\nUser-Agent: bench\r\n" +
	"Content-Type: application/sdp\r\nContent-Length: 0\r\n\r\n"

const benchOK = "SIP/2.0 200 OK\r\n" +
	"Via: SIP/2.0/UDP 10.0.0.1:5060;branch=z9hG4bK-e;rport\r\n" +
	"Via: SIP/2.0/UDP 10.0.0.2:5070;branch=z9hG4bK-1;rport=5070;received=10.0.0.2\r\n" +
	"Record-Route: <sip:10.0.0.1;lr>\r\nFrom: <sip:1001@sip.local>;tag=f1\r\nTo: <sip:1002@sip.local>;tag=t2\r\n" +
	"Call-ID: 1-25@10.0.0.2\r\nCSeq: 1 INVITE\r\nContact: <sip:1002@10.0.0.3:6060>\r\n" +
	"Content-Type: application/sdp\r\nContent-Length: 0\r\n\r\n"

// BenchmarkParse is what sipgo's parser allocates, the cost no change here reaches.
func BenchmarkParse(b *testing.B) {
	p := sipconv.NewParser()
	data := []byte(benchInvite)
	b.ReportAllocs()
	for range b.N {
		if _, err := p.ParseSIP(data); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkRelayedResponse is the EdgePort's own work on a response's way out,
// from the parsed message to the one sent, without the processor.
func BenchmarkRelayedResponse(b *testing.B) {
	p := sipconv.NewParser()
	data := []byte(benchOK)
	b.ReportAllocs()
	for range b.N {
		msg, err := p.ParseSIP(data)
		if err != nil {
			b.Fatal(err)
		}
		res := msg.(*sip.Response)
		in := rebuildResponse(res, res.Reason, res.Headers(), res.Body())
		all := RelayedHeaders(in, nil)
		_ = rebuildResponse(in, in.Reason, all, in.Body())
	}
}

// BenchmarkForwardedRequest is the request rebuilt from a processor's reply.
func BenchmarkForwardedRequest(b *testing.B) {
	p := sipconv.NewParser()
	msg, err := p.ParseSIP([]byte(benchInvite))
	if err != nil {
		b.Fatal(err)
	}
	req := msg.(*sip.Request)
	dto, err := sipconv.MessageToDTO(req)
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		headers := sipconv.HeadersFromDTO(dto)
		_ = BuildForwardedRequest(req, req.Recipient, nil, headers)
	}
}
