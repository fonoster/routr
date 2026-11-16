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
	"fmt"
	"math"
	"regexp"
	"strconv"
)

// The sip profile: RFC 3261 and companions (rules/sip/*.ts).

var ruleMaxForwards = &Rule{
	ID:       "sip/max-forwards",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §16.6 step 3, §16.3",
	Summary:  "A proxy decrements Max-Forwards by one and never forwards zero",
	check: func(r *Record, _ []*Record, fail report) {
		if !isForwarded(r) {
			return
		}
		in, out := inbound(r).GetMaxForwards(), outbound(r).GetMaxForwards()
		if in == nil {
			if out == nil {
				fail("Max-Forwards missing on the outgoing request", SideOut, "Max-Forwards")
			}
			return
		}
		if in.GetMaxForwards() == 0 {
			fail("forwarded a request whose Max-Forwards was 0 (should answer 483)", SideIn, "Max-Forwards")
			return
		}
		if out == nil || out.GetMaxForwards() != in.GetMaxForwards()-1 {
			got := "none"
			if out != nil {
				got = strconv.Itoa(int(out.GetMaxForwards()))
			}
			fail(fmt.Sprintf("Max-Forwards not decremented (%d in, %s out)", in.GetMaxForwards(), got), SideOut, "Max-Forwards")
		}
	},
}

var ruleVia = &Rule{
	ID:       "sip/via",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §16.6 step 8, §16.7 step 3",
	Summary:  "The proxy's own Via goes on top of a forwarded request and comes off a relayed response",
	check: func(r *Record, _ []*Record, fail report) {
		viaIn, viaOut := inbound(r).GetVia(), outbound(r).GetVia()
		switch {
		case isForwarded(r):
			if len(viaOut) != len(viaIn)+1 {
				fail(fmt.Sprintf("expected %d Via headers on the outgoing request, found %d", len(viaIn)+1, len(viaOut)), SideOut, "Via")
				return
			}
			if !isOwnHost(r.Request, viaOut[0].GetHost()) {
				fail(fmt.Sprintf("top Via of the outgoing request is %s, not one of the proxy's interfaces", viaOut[0].GetHost()), SideOut, "Via")
			}
		case isRelayed(r):
			if len(viaOut) != len(viaIn)-1 {
				fail(fmt.Sprintf("expected %d Via headers on the relayed response, found %d", len(viaIn)-1, len(viaOut)), SideOut, "Via")
				return
			}
			if len(viaIn) > 0 && !isOwnHost(r.Request, viaIn[0].GetHost()) {
				fail(fmt.Sprintf("top Via of the incoming response is %s, not one of the proxy's interfaces", viaIn[0].GetHost()), SideIn, "Via")
			}
		}
	},
}

var ruleRecordRouteSelf = &Rule{
	ID:       "sip/record-route-self",
	Profile:  ProfileSIP,
	Severity: SeverityWarning,
	Spec:     "RFC 3261 §16.6 step 4",
	Summary:  "A Record-Route the proxy adds names one of its own interfaces, and one the far side can reach",
	check: func(r *Record, _ []*Record, fail report) {
		if !isForwarded(r) || isInDialog(r) {
			return
		}
		out := outbound(r)
		if len(out.GetRecordRoute()) == 0 {
			return
		}
		rr := out.GetRecordRoute()[0].GetAddress().GetUri().GetHost()
		if rr == "" {
			return
		}
		if !isOwnHost(r.Request, rr) {
			fail(fmt.Sprintf("top Record-Route names %s, not one of the proxy's interfaces", rr), SideOut, "Record-Route")
			return
		}
		via := topVia(out).GetHost()
		if isExternalHost(r.Request, via) && isInternalHost(r.Request, rr) {
			fail(fmt.Sprintf("Record-Route names %s, an internal interface, while the request leaves through %s", rr, via), SideOut, "Record-Route")
		}
	},
}

var ruleRouteSelfRemoved = &Rule{
	ID:       "sip/route-self-removed",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §16.4",
	Summary:  "A Route pointing at the proxy itself is removed before forwarding",
	check: func(r *Record, _ []*Record, fail report) {
		if !isForwarded(r) {
			return
		}
		for _, route := range outbound(r).GetRoute() {
			host := route.GetAddress().GetUri().GetHost()
			if isOwnHost(r.Request, host) || isAliasHost(r.Request, host) {
				fail(fmt.Sprintf("outgoing request still carries a Route to %s, one of the proxy's interfaces", host), SideOut, "Route")
				return
			}
		}
	},
}

var ruleCredentialsStripped = &Rule{
	ID:       "sip/credentials-stripped",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §22.2",
	Summary:  "Credentials the proxy accepted are not forwarded; the next hop would receive the digest",
	check: func(r *Record, _ []*Record, fail report) {
		if !isForwarded(r) {
			return
		}
		in := inbound(r)
		if in.GetAuthorization() == nil && len(headerValues(in, "Authorization")) == 0 {
			return
		}
		out := outbound(r)
		if out.GetAuthorization() != nil || len(headerValues(out, "Authorization")) > 0 {
			fail("Authorization the proxy accepted was forwarded to the next hop", SideOut, "Authorization")
		}
	},
}

var sdpConnection = regexp.MustCompile(`(?m)^c=IN IP4 (\S+)`)

var rulePrivateAddress = &Rule{
	ID:       "sip/private-address",
	Profile:  ProfileSIP,
	Severity: SeverityWarning,
	Spec:     "RFC 3261 §8.1.1.8, RFC 3264 §5",
	Summary:  "A request leaving through the external interface names no internal address in Contact or SDP",
	check: func(r *Record, _ []*Record, fail report) {
		if !isForwarded(r) {
			return
		}
		out := outbound(r)
		if out == nil || !isExternalHost(r.Request, topVia(out).GetHost()) {
			return
		}
		contact := out.GetContact().GetAddress().GetUri().GetHost()
		if isInternalHost(r.Request, contact) {
			fail(fmt.Sprintf("Contact names %s, an internal address the far side cannot reach", contact), SideOut, "Contact")
		}
		if m := sdpConnection.FindStringSubmatch(out.GetBody()); m != nil && isInternalHost(r.Request, m[1]) {
			fail(fmt.Sprintf("SDP connection address %s is internal; media needs a relay", m[1]), SideOut, "Body")
		}
	},
}

var ruleRegisterOK = &Rule{
	ID:       "sip/register-ok",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §10.3 step 8",
	Summary:  "A 200 to REGISTER carries the Contact bound and an expiration (the EdgePort copies the request's Expires)",
	check: func(r *Record, _ []*Record, fail report) {
		if !isRequest(r) || r.Method != "REGISTER" || r.Outcome != OutcomeAnswered || statusOf(r) != 200 {
			return
		}
		out, in := outbound(r), inbound(r)
		if out.GetContact() == nil {
			fail("200 to REGISTER carries no Contact", SideOut, "Contact")
			return
		}
		hasExpiration := out.GetContact().GetExpires() >= 0 ||
			(out.GetExpires() != nil && out.GetExpires().GetExpires() >= 0) ||
			(in.GetExpires() != nil && in.GetExpires().GetExpires() >= 0) ||
			(in.GetContact() != nil && in.GetContact().GetExpires() >= 0)
		if !hasExpiration {
			fail("200 to REGISTER carries no expiration and the request had none", SideOut, "Expires")
		}
	},
}

func invitesOf(call []*Record) []*Record {
	var invites []*Record
	for _, r := range call {
		if isRequest(r) && r.Method == "INVITE" {
			invites = append(invites, r)
		}
	}
	return invites
}

var ruleCSeqACK = &Rule{
	ID:       "sip/cseq-ack",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §17.1.1.3, §13.2.2.4",
	Summary:  "An ACK carries the CSeq number of the INVITE it acknowledges",
	check: func(r *Record, call []*Record, fail report) {
		if !isRequest(r) || r.Method != "ACK" {
			return
		}
		cseq, ok := cseqOf(inbound(r))
		invites := invitesOf(call)
		if !ok || len(invites) == 0 {
			return
		}
		for _, invite := range invites {
			if n, has := cseqOf(inbound(invite)); has && n == cseq {
				return
			}
		}
		fail(fmt.Sprintf("ACK CSeq %d matches no INVITE of this call", cseq), SideIn, "CSeq")
	},
}

// sharesCSeq tells the methods that reuse the CSeq number of their INVITE.
func sharesCSeq(method string) bool { return method == "ACK" || method == "CANCEL" }

var ruleCSeqMonotonic = &Rule{
	ID:       "sip/cseq-monotonic",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §12.2.1.1",
	Summary:  "CSeq grows with every new request a party sends within a dialog",
	check: func(r *Record, call []*Record, fail report) {
		if !isRequest(r) || sharesCSeq(r.Method) {
			return
		}
		cseq, ok := cseqOf(inbound(r))
		if !ok {
			return
		}
		direction, branch := directionOf(r), topBranch(inbound(r))
		highest, found := 0, false
		for _, earlier := range call {
			if !isRequest(earlier) || directionOf(earlier) != direction || sharesCSeq(earlier.Method) || topBranch(inbound(earlier)) == branch {
				continue
			}
			if n, has := cseqOf(inbound(earlier)); has && (!found || n > highest) {
				highest, found = n, true
			}
		}
		if found && cseq <= highest {
			fail(fmt.Sprintf("%s CSeq %d does not exceed the previous %d from the same party", r.Method, cseq, highest), SideIn, "CSeq")
		}
	},
}

var ruleCancelMatches = &Rule{
	ID:       "sip/cancel-matches",
	Profile:  ProfileSIP,
	Severity: SeverityError,
	Spec:     "RFC 3261 §9.1",
	Summary:  "A CANCEL carries the CSeq number and top Via branch of the INVITE it cancels",
	check: func(r *Record, call []*Record, fail report) {
		if !isRequest(r) || r.Method != "CANCEL" {
			return
		}
		cseq, ok := cseqOf(inbound(r))
		invites := invitesOf(call)
		if !ok || len(invites) == 0 {
			return
		}
		branch := topBranch(inbound(r))
		for _, invite := range invites {
			n, has := cseqOf(inbound(invite))
			if has && n == cseq && (branch == "" || topBranch(inbound(invite)) == branch) {
				return
			}
		}
		shown := branch
		if topVia(inbound(r)) == nil {
			shown = "none"
		}
		fail(fmt.Sprintf("CANCEL (CSeq %d, branch %s) matches no INVITE of this call", cseq, shown), SideIn, "CSeq")
	},
}

// isAcknowledged tells whether an ACK followed the 2xx. The ACK carries the
// caller's CSeq, which is the CSeq of the INVITE forwarded before the 2xx. It
// differs from the 2xx's own when the EdgePort authenticated on the caller's
// behalf: the retry raised the CSeq on the provider leg alone.
func isAcknowledged(ok *Record, call []*Record) bool {
	okNumber, hasOK := cseqOf(inbound(ok))
	forwardedNumber, hasForwarded := 0, false
	for i := len(call) - 1; i >= 0; i-- {
		if r := call[i]; isRequest(r) && r.Method == "INVITE" && r.Seq < ok.Seq {
			forwardedNumber, hasForwarded = cseqOf(inbound(r))
			break
		}
	}
	for _, r := range call {
		if !isRequest(r) || r.Method != "ACK" || r.Seq <= ok.Seq {
			continue
		}
		n, has := cseqOf(inbound(r))
		if has && ((hasOK && n == okNumber) || (hasForwarded && n == forwardedNumber)) {
			return true
		}
	}
	return false
}

var ruleACK2xx = &Rule{
	ID:       "sip/ack-2xx",
	Profile:  ProfileSIP,
	Severity: SeverityWarning,
	Spec:     "RFC 3261 §13.2.2.4",
	Summary:  "A 2xx to INVITE is acknowledged before the dialog is torn down",
	check: func(r *Record, call []*Record, fail report) {
		if !isRequest(r) || r.Method != "BYE" {
			return
		}
		for _, ok := range call {
			status := statusOf(ok)
			if !isResponse(ok) || ok.Method != "INVITE" || status < 200 || status >= 300 || isAcknowledged(ok, call) {
				continue
			}
			number := "undefined"
			if n, has := cseqOf(inbound(ok)); has {
				number = strconv.Itoa(n)
			}
			fail(fmt.Sprintf("BYE arrived while the 2xx to INVITE (CSeq %s) was never acknowledged", number), SideCall, "")
			return
		}
	},
}

var ruleRetransmission = &Rule{
	ID:       "sip/retransmission",
	Profile:  ProfileSIP,
	Severity: SeverityWarning,
	Spec:     "RFC 3261 §17.1.1.2, §17.1.2.2",
	Summary:  "A request seen twice with the same branch means its response did not reach the sender in time",
	check: func(r *Record, call []*Record, fail report) {
		if !isRequest(r) {
			return
		}
		branch := topBranch(inbound(r))
		cseq, ok := cseqOf(inbound(r))
		if branch == "" || !ok {
			return
		}
		for _, earlier := range call {
			if !isRequest(earlier) || earlier.Method != r.Method || topBranch(inbound(earlier)) != branch {
				continue
			}
			if n, has := cseqOf(inbound(earlier)); has && n == cseq {
				elapsed := int64(math.Floor(r.TOffsetMs - earlier.TOffsetMs + 0.5))
				fail(fmt.Sprintf("%s retransmitted %d ms after the first copy (seq %d): the sender had not seen a response", r.Method, elapsed, earlier.Seq), SideIn, "Via")
				return
			}
		}
	},
}
