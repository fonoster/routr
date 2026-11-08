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
	"fmt"
	"strings"
	"testing"

	"github.com/emiago/sipgo/sip"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// A dialog that crossed EdgePorts, seen from EdgePort A: peer EdgePort B
// forwarded the caller's INVITE here, record-routing its own address (the peer
// below) and its external one, and this EdgePort holds the callee's binding.

const crossedCaller = "1001@198.51.100.10:50000;transport=tcp"

// establishCrossed runs B's INVITE through this EdgePort to the callee and the
// 200 back to B.
func establishCrossed(t *testing.T, edge int, peerB, uas *peer, callID string) {
	t.Helper()
	peerB.send(edge, fmt.Sprintf(`
INVITE sip:1002@127.0.0.1 SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-%s
Via: SIP/2.0/TCP 198.51.100.10:50000;branch=z9hG4bK-caller-%s
Max-Forwards: 69
Record-Route: <sip:127.0.0.1:%d;transport=udp;lr>;r2=on
Record-Route: <sip:203.0.113.1:5060;transport=tcp;lr>;r2=on
From: <sip:1001@sip.local>;tag=caller
To: <sip:1002@sip.local>
Call-ID: %s
CSeq: 1 INVITE
Contact: <sip:%s>
X-Edgeport-Ref: edgeport-b
Content-Length: 0

`, peerB.port, callID, callID, peerB.port, callID, crossedCaller))
	in := recvMethod(t, uas, sip.INVITE)
	var b strings.Builder
	b.WriteString("SIP/2.0 200 OK\n")
	for _, v := range in.GetHeaders("Via") {
		b.WriteString("Via: " + v.Value() + "\n")
	}
	for _, rr := range in.GetHeaders("Record-Route") {
		b.WriteString("Record-Route: " + rr.Value() + "\n")
	}
	b.WriteString("From: " + in.From().Value() + "\n")
	b.WriteString("To: " + in.To().Value() + ";tag=callee\n")
	fmt.Fprintf(&b, "Call-ID: %s\nCSeq: 1 INVITE\nContact: <sip:1002@127.0.0.1:%d>\nContent-Length: 0\n\n", callID, uas.port)
	uas.send(edge, b.String())
	if res, ok := mustRecv(t, peerB).(*sip.Response); !ok || res.StatusCode != 200 {
		t.Fatalf("the 200 is relayed to B: %v", res)
	}
}

func calleeBye(edge, uasPort int, callID string) string {
	return fmt.Sprintf(`
BYE sip:%s SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-bye-%s
Max-Forwards: 70
Route: <sip:127.0.0.1:%d;transport=udp;lr>
From: <sip:1002@sip.local>;tag=callee
To: <sip:1001@sip.local>;tag=caller
Call-ID: %s
CSeq: 1 BYE
Content-Length: 0

`, crossedCaller, uasPort, callID, edge, callID)
}

func TestFlowCrossedDialog(t *testing.T) {
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	peerB := newPeer(t)
	stranger := freeUDPPort(t)
	// What Connect leaves of each BYE's route set. The callee's goes to B's own
	// address, the Record-Route entry facing the caller (crossed1), or to one
	// the dialog never record-routed (crossed3). The caller's, which B sends
	// here, loses its Route to this EdgePort and goes to the Request-URI
	// (crossed2).
	routeTo := map[string]int{"crossed1": peerB.port, "crossed2": 0, "crossed3": stranger}
	proc.inDialog = func(msg *pb.SIPMessage) bool {
		port, ok := routeTo[msg.GetCallId().GetCallId()]
		if !ok {
			return false
		}
		msg.Route = nil
		if port != 0 {
			msg.Route = []*pb.Route{{Address: &pb.Address{Uri: &pb.SipURI{Host: "127.0.0.1", Port: int32(port), TransportParam: "udp", LrParam: true, TtlParam: -1}}}}
		}
		return true
	}
	edge := startEdgePort(t, proc)

	t.Run("the callee's BYE goes to the peer's own address the dialog record-routed", func(t *testing.T) {
		establishCrossed(t, edge, peerB, uas, "crossed1")
		uas.send(edge, calleeBye(edge, uas.port, "crossed1"))
		req := recvMethod(t, peerB, sip.BYE)
		if req.Recipient.Host != "198.51.100.10" {
			t.Errorf("Request-URI = %v, want the caller", req.Recipient)
		}
	})
	t.Run("the caller's BYE from the peer goes to the callee", func(t *testing.T) {
		establishCrossed(t, edge, peerB, uas, "crossed2")
		peerB.send(edge, fmt.Sprintf(`
BYE sip:1002@127.0.0.1:%d SIP/2.0
Via: SIP/2.0/UDP 127.0.0.1:%d;rport;branch=z9hG4bK-bye-crossed2
Via: SIP/2.0/TCP 198.51.100.10:50000;branch=z9hG4bK-caller-bye
Max-Forwards: 69
Route: <sip:127.0.0.1:%d;transport=udp;lr>
From: <sip:1001@sip.local>;tag=caller
To: <sip:1002@sip.local>;tag=callee
Call-ID: crossed2
CSeq: 2 BYE
Content-Length: 0

`, uas.port, peerB.port, edge))
		recvMethod(t, uas, sip.BYE)
	})
	t.Run("a peer address the dialog didn't record-route is 481", func(t *testing.T) {
		establishCrossed(t, edge, peerB, uas, "crossed3")
		uas.send(edge, calleeBye(edge, uas.port, "crossed3"))
		expect481(t, uas)
	})
}

// The same dialog seen from EdgePort B, which forwarded the caller's INVITE to
// peer A: the 200 brings A's own address in its Record-Route, and the caller's
// BYE goes there.
func TestFlowCrossedDialogFromTheForwardingEdgePort(t *testing.T) {
	proc := &fakeProcessor{}
	peerA := newPeer(t)
	ownA := newPeer(t)
	proc.uas = peerA.port
	proc.inDialog = func(msg *pb.SIPMessage) bool {
		if msg.GetCallId().GetCallId() != "crossedB" {
			return false
		}
		msg.Route = []*pb.Route{{Address: &pb.Address{Uri: &pb.SipURI{Host: "127.0.0.1", Port: int32(ownA.port), TransportParam: "udp", LrParam: true, TtlParam: -1}}}}
		return true
	}
	edge := startEdgePort(t, proc)
	uac := newPeer(t)
	uac.send(edge, inviteText(uac.port, "crossedB"))
	in := recvMethod(t, peerA, sip.INVITE)
	var b strings.Builder
	b.WriteString("SIP/2.0 200 OK\n")
	for _, v := range in.GetHeaders("Via") {
		b.WriteString("Via: " + v.Value() + "\n")
	}
	b.WriteString("Record-Route: <sip:203.0.113.1:5060;transport=udp;lr>;r2=on\n")
	fmt.Fprintf(&b, "Record-Route: <sip:127.0.0.1:%d;transport=udp;lr>;r2=on\n", ownA.port)
	for _, rr := range in.GetHeaders("Record-Route") {
		b.WriteString("Record-Route: " + rr.Value() + "\n")
	}
	b.WriteString("From: " + in.From().Value() + "\n")
	b.WriteString("To: " + in.To().Value() + ";tag=callee\n")
	fmt.Fprintf(&b, "Call-ID: crossedB\nCSeq: 1 INVITE\nContact: <sip:1002@198.51.100.20:40000>\nContent-Length: 0\n\n")
	peerA.send(edge, b.String())
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
		t.Fatalf("the 200 is relayed to the caller: %v", res)
	}
	uac.send(edge, inDialogText("BYE", "1002@198.51.100.20:40000", "crossedB", "byeB", uac.port, 2, ""))
	recvMethod(t, ownA, sip.BYE)
}
