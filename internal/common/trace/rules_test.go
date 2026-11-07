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
	"regexp"
	"sort"
	"strings"
	"testing"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The behavior spec: mods/common/test/rules.unit.test.ts, over the same real
// recording: 401 challenge, forwarded INVITE (seq 2) and its retransmission
// (seq 3), 180/200, ACK, re-INVITE, 200, ACK, BYE, 200.
const ruleFixture = "../../../mods/common/test/fixtures/call.jsonl"

type ruleInput struct {
	record *Record
	call   []*Record
}

func setExt(m *pb.SIPMessage, name string, values ...string) {
	var kept []*pb.Extension
	for _, e := range m.GetExtensions() {
		if !strings.EqualFold(e.GetName(), name) {
			kept = append(kept, e)
		}
	}
	for _, v := range values {
		kept = append(kept, &pb.Extension{Name: name, Value: v})
	}
	m.Extensions = kept
}

func mutate(r *Record, fn func(in, out *pb.SIPMessage, r *Record)) *Record {
	c := cloneRecord(r)
	var out *pb.SIPMessage
	if c.Response != nil {
		out = c.Response.Message
	}
	fn(c.Request.GetMessage(), out, c)
	return c
}

func requestURI(uri *pb.SipURI) *pb.SIPMessage_RequestUri {
	return &pb.SIPMessage_RequestUri{RequestUri: uri}
}

func findingsOf(rule string, in ruleInput) []Finding {
	var found []Finding
	for _, f := range Evaluate(in.record, in.call, []Profile{ProfileSIP, ProfileSIPConnect}) {
		if f.Rule == rule {
			found = append(found, f)
		}
	}
	return found
}

// ruleFixtures are the records the cases are built from.
type ruleFixtures struct {
	all                                                    []*Record
	forwardedInvite, relayed180, ok200, ack, reInvite, bye *Record
	external, internal                                     string
}

func loadRuleFixtures(t *testing.T) *ruleFixtures {
	t.Helper()
	f := &ruleFixtures{all: readRecords(t, ruleFixture)}
	f.forwardedInvite = f.bySeq(t, 2)
	f.relayed180 = f.bySeq(t, 4)
	f.ok200 = f.bySeq(t, 5)
	f.ack = f.bySeq(t, 6)
	f.reInvite = f.bySeq(t, 7)
	f.bye = f.bySeq(t, 10)
	f.external = f.forwardedInvite.Request.GetExternalAddrs()[0]
	f.internal = f.forwardedInvite.Request.GetListeningPoints()[0].GetHost()
	return f
}

func (f *ruleFixtures) bySeq(t *testing.T, seq int) *Record {
	t.Helper()
	for _, r := range f.all {
		if r.Seq == seq {
			return r
		}
	}
	t.Fatalf("no record with seq %d", seq)
	return nil
}

func ruleCases(t *testing.T, f *ruleFixtures) map[string]struct{ hit, miss ruleInput } {
	t.Helper()
	external := func(_, out *pb.SIPMessage, _ *Record) { out.GetVia()[0].Host = f.external }
	invite := func(fn func(out *pb.SIPMessage)) *Record {
		return mutate(f.forwardedInvite, func(in, out *pb.SIPMessage, r *Record) {
			external(in, out, r)
			fn(out)
		})
	}
	registerOk := mutate(f.bySeq(t, 1), func(in, out *pb.SIPMessage, r *Record) {
		r.Method = "REGISTER"
		r.Outcome = OutcomeAnswered
		r.Status = 200
		in.MessageType = requestURI(&pb.SipURI{Host: "sip.local"})
		in.Expires = &pb.Expires{Expires: 3600}
		setExt(in, "CSeq", "1 REGISTER")
		out.MessageType = &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_OK}
		out.Contact = in.GetContact()
		out.Expires = &pb.Expires{Expires: 3600}
	})
	cancel := mutate(f.forwardedInvite, func(in, out *pb.SIPMessage, r *Record) {
		r.Method = "CANCEL"
		setExt(in, "CSeq", "2 CANCEL")
		setExt(out, "CSeq", "2 CANCEL")
	})
	const pai = "<sip:+17066041487@sip.local;user=phone>"
	anonymous := func(out *pb.SIPMessage) {
		uri := out.GetFrom().GetAddress().GetUri()
		uri.User, uri.Host = "anonymous", "anonymous.invalid"
	}

	return map[string]struct{ hit, miss ruleInput }{
		"sip/max-forwards": {
			hit: ruleInput{record: mutate(f.forwardedInvite, func(_, out *pb.SIPMessage, _ *Record) {
				out.MaxForwards = &pb.MaxForwards{MaxForwards: 70}
			})},
			miss: ruleInput{record: f.forwardedInvite},
		},
		"sip/via": {
			hit: ruleInput{record: mutate(f.relayed180, func(in, out *pb.SIPMessage, _ *Record) {
				out.Via = in.GetVia()
			})},
			miss: ruleInput{record: f.relayed180},
		},
		"sip/record-route-self": {
			hit: ruleInput{record: mutate(f.forwardedInvite, func(_, out *pb.SIPMessage, _ *Record) {
				out.GetRecordRoute()[0].GetAddress().GetUri().Host = "203.0.113.9"
			})},
			miss: ruleInput{record: mutate(f.forwardedInvite, func(_, out *pb.SIPMessage, _ *Record) {
				out.GetRecordRoute()[0].GetAddress().GetUri().Host = f.external
			})},
		},
		"sip/route-self-removed": {
			hit: ruleInput{record: mutate(f.forwardedInvite, func(_, out *pb.SIPMessage, _ *Record) {
				out.Route = []*pb.Route{{Address: &pb.Address{Uri: &pb.SipURI{Host: f.internal, Port: 5060}}}}
			})},
			miss: ruleInput{record: f.forwardedInvite},
		},
		"sip/credentials-stripped": {
			hit: ruleInput{record: mutate(f.forwardedInvite, func(in, out *pb.SIPMessage, _ *Record) {
				in.Authorization = &pb.Authorization{Username: "1001", Realm: "sip.local", Response: "abc"}
				out.Authorization = in.GetAuthorization()
			})},
			miss: ruleInput{record: mutate(f.forwardedInvite, func(in, out *pb.SIPMessage, _ *Record) {
				in.Authorization = &pb.Authorization{Username: "1001", Realm: "sip.local"}
				out.Authorization = nil
			})},
		},
		"sip/private-address": {
			hit: ruleInput{record: invite(func(out *pb.SIPMessage) {
				out.GetContact().GetAddress().GetUri().Host = f.internal
			})},
			miss: ruleInput{record: invite(func(out *pb.SIPMessage) {
				out.GetContact().GetAddress().GetUri().Host = "203.0.113.9"
				out.Body = "v=0\r\nc=IN IP4 203.0.113.9\r\nm=audio 6000 RTP/AVP 0\r\n"
			})},
		},
		"sip/register-ok": {
			hit: ruleInput{record: mutate(registerOk, func(in, out *pb.SIPMessage, _ *Record) {
				out.Contact = nil
				out.Expires = nil
				in.Expires = nil
			})},
			miss: ruleInput{record: registerOk},
		},
		"sip/cseq-ack": {
			hit: ruleInput{
				record: mutate(f.ack, func(in, _ *pb.SIPMessage, _ *Record) { setExt(in, "CSeq", "99 ACK") }),
				call:   []*Record{f.forwardedInvite},
			},
			miss: ruleInput{record: f.ack, call: []*Record{f.forwardedInvite, f.ok200}},
		},
		"sip/cseq-monotonic": {
			hit: ruleInput{
				record: mutate(f.reInvite, func(in, _ *pb.SIPMessage, _ *Record) {
					in.From = f.forwardedInvite.Request.GetMessage().GetFrom()
					setExt(in, "CSeq", "1 INVITE")
					in.GetVia()[0].Branch = "z9hG4bK-other"
				}),
				call: []*Record{f.forwardedInvite},
			},
			miss: ruleInput{
				record: mutate(f.reInvite, func(in, _ *pb.SIPMessage, _ *Record) {
					in.From = f.forwardedInvite.Request.GetMessage().GetFrom()
					setExt(in, "CSeq", "3 INVITE")
					in.GetVia()[0].Branch = "z9hG4bK-other"
				}),
				call: []*Record{f.forwardedInvite},
			},
		},
		"sip/cancel-matches": {
			hit: ruleInput{
				record: mutate(cancel, func(in, _ *pb.SIPMessage, _ *Record) { in.GetVia()[0].Branch = "z9hG4bK-nomatch" }),
				call:   []*Record{f.forwardedInvite},
			},
			miss: ruleInput{record: cancel, call: []*Record{f.forwardedInvite}},
		},
		"sip/ack-2xx": {
			hit:  ruleInput{record: f.bye, call: []*Record{f.forwardedInvite, f.ok200}},
			miss: ruleInput{record: f.bye, call: []*Record{f.forwardedInvite, f.ok200, f.ack}},
		},
		"sip/retransmission": {
			hit:  ruleInput{record: f.bySeq(t, 3), call: []*Record{f.forwardedInvite}},
			miss: ruleInput{record: f.forwardedInvite},
		},
		"sip-connect/pai-single": {
			hit:  ruleInput{record: invite(func(out *pb.SIPMessage) { setExt(out, "P-Asserted-Identity", pai, pai) })},
			miss: ruleInput{record: invite(func(out *pb.SIPMessage) { setExt(out, "P-Asserted-Identity", pai) })},
		},
		"sip-connect/pai-e164": {
			hit: ruleInput{record: invite(func(out *pb.SIPMessage) { setExt(out, "P-Asserted-Identity", "<sip:1001@sip.local>") })},
			miss: ruleInput{record: invite(func(out *pb.SIPMessage) {
				setExt(out, "P-Asserted-Identity", `"1001" `+pai)
			})},
		},
		"sip-connect/request-uri-e164": {
			hit: ruleInput{record: invite(func(out *pb.SIPMessage) {
				out.MessageType = requestURI(&pb.SipURI{User: "17853178070", Host: "sip.provider.net"})
			})},
			miss: ruleInput{record: invite(func(out *pb.SIPMessage) {
				out.MessageType = requestURI(&pb.SipURI{User: "+17853178070", Host: "sip.provider.net", UserParam: "phone"})
			})},
		},
		"sip-connect/from-e164-or-anonymous": {
			hit:  ruleInput{record: invite(func(out *pb.SIPMessage) { out.GetFrom().GetAddress().GetUri().User = "1001" })},
			miss: ruleInput{record: invite(anonymous)},
		},
		"sip-connect/privacy": {
			hit: ruleInput{record: invite(func(out *pb.SIPMessage) {
				setExt(out, "Privacy", "id")
				out.GetFrom().GetAddress().GetUri().User = "1001"
			})},
			miss: ruleInput{record: invite(func(out *pb.SIPMessage) {
				setExt(out, "Privacy", "id")
				setExt(out, "P-Asserted-Identity", pai)
				anonymous(out)
			})},
		},
	}
}

func TestEveryRuleHasAFiringAndANonFiringCase(t *testing.T) {
	cases := ruleCases(t, loadRuleFixtures(t))
	covered := make([]string, 0, len(cases))
	for rule := range cases {
		covered = append(covered, rule)
	}
	ids := make([]string, 0, len(rules))
	for _, rule := range rules {
		ids = append(ids, rule.ID)
	}
	sort.Strings(covered)
	sort.Strings(ids)
	if !reflect.DeepEqual(covered, ids) {
		t.Errorf("covered %v, rules %v", covered, ids)
	}
}

func TestRulesFireOnTheViolationAndNotOnTheCompliantMessage(t *testing.T) {
	for rule, c := range ruleCases(t, loadRuleFixtures(t)) {
		t.Run(rule, func(t *testing.T) {
			fired := findingsOf(rule, c.hit)
			if len(fired) == 0 {
				t.Fatal("should fire")
			}
			f := fired[0]
			if f.Rule != rule || f.Spec == "" || f.Message == "" || (f.Side != SideIn && f.Side != SideOut && f.Side != SideCall) {
				t.Errorf("finding: %+v", f)
			}
			if missed := findingsOf(rule, c.miss); len(missed) != 0 {
				t.Errorf("should not fire: %+v", missed)
			}
		})
	}
}

func TestEveryRuleDeclaresItsProfileSeveritySpecAndSummary(t *testing.T) {
	id := regexp.MustCompile(`^(sip|sip-connect)/[a-z0-9-]+$`)
	for _, r := range rules {
		if !id.MatchString(r.ID) || !strings.HasPrefix(r.ID, string(r.Profile)+"/") {
			t.Errorf("id: %s (%s)", r.ID, r.Profile)
		}
		if r.Severity != SeverityError && r.Severity != SeverityWarning {
			t.Errorf("%s severity: %s", r.ID, r.Severity)
		}
		if r.Spec == "" || r.Summary == "" {
			t.Errorf("%s: no spec or summary", r.ID)
		}
	}
}

func TestEvaluateRunsOnlyTheRequestedProfiles(t *testing.T) {
	f := loadRuleFixtures(t)
	record := mutate(f.forwardedInvite, func(_, out *pb.SIPMessage, _ *Record) {
		out.GetVia()[0].Host = f.external
		out.MaxForwards = &pb.MaxForwards{MaxForwards: 70}
		setExt(out, "P-Asserted-Identity")
	})
	sipOnly := Evaluate(record, nil, []Profile{ProfileSIP})
	hasMaxForwards := false
	for _, finding := range sipOnly {
		if finding.Profile == ProfileSIPConnect {
			t.Errorf("sip-connect finding: %+v", finding)
		}
		hasMaxForwards = hasMaxForwards || finding.Rule == "sip/max-forwards"
	}
	if !hasMaxForwards {
		t.Error("sip/max-forwards should fire")
	}
	both := Evaluate(record, nil, []Profile{ProfileSIP, ProfileSIPConnect})
	if len(findingsOf("sip-connect/pai-single", ruleInput{record: record})) == 0 {
		t.Error("sip-connect/pai-single should fire")
	}
	// Errors come first
	if both[0].Severity != SeverityError {
		t.Errorf("first finding: %+v", both[0])
	}
	if none := Evaluate(record, nil, nil); len(none) != 0 {
		t.Errorf("no profiles: %+v", none)
	}
}

func TestEvaluateGivesEachRecordTheOnesBeforeIt(t *testing.T) {
	f := loadRuleFixtures(t)
	fired := func(seq int) bool {
		for i, r := range f.all {
			if r.Seq == seq {
				for _, finding := range Evaluate(r, f.all[:i], []Profile{ProfileSIP}) {
					if finding.Rule == "sip/retransmission" {
						return true
					}
				}
			}
		}
		return false
	}
	if !fired(3) {
		t.Error("seq 3 is the retransmission")
	}
	if fired(2) {
		t.Error("seq 2 is the first copy")
	}
}

func TestRulesNeverReadAHopsMetadata(t *testing.T) {
	f := loadRuleFixtures(t)
	annotated := mutate(f.forwardedInvite, func(_, _ *pb.SIPMessage, r *Record) {
		r.Hops[1].Metadata = map[string]string{"route": "agentToPSTN", "anything": "goes"}
	})
	all := []Profile{ProfileSIP, ProfileSIPConnect}
	if !reflect.DeepEqual(Evaluate(annotated, nil, all), Evaluate(f.forwardedInvite, nil, all)) {
		t.Error("the annotation changed the findings")
	}
}

func TestRouteSelfRemovedWithAliases(t *testing.T) {
	f := loadRuleFixtures(t)
	withAlias := func(route []*pb.Route) *Record {
		return mutate(f.forwardedInvite, func(_, out *pb.SIPMessage, r *Record) {
			r.Request.Aliases = []string{"routr"}
			out.Route = route
		})
	}
	left := withAlias([]*pb.Route{{Address: &pb.Address{Uri: &pb.SipURI{Host: "routr", Port: 5060}}}})
	if got := findingsOf("sip/route-self-removed", ruleInput{record: left}); len(got) != 1 {
		t.Errorf("a Route naming an alias: %+v", got)
	}
	if got := findingsOf("sip/route-self-removed", ruleInput{record: withAlias(nil)}); len(got) != 0 {
		t.Errorf("no Route: %+v", got)
	}
}

// The provider leg's 2xx carries CSeq 3 after the authenticated retry, while
// the caller's INVITE and ACK keep CSeq 2.
func TestACK2xxWhenTheEdgePortAuthenticatedOnTheCallersBehalf(t *testing.T) {
	f := loadRuleFixtures(t)
	withCSeq := func(r *Record, value string) *Record {
		return mutate(r, func(in, _ *pb.SIPMessage, _ *Record) { setExt(in, "CSeq", value) })
	}
	invite, ok := withCSeq(f.forwardedInvite, "2 INVITE"), withCSeq(f.ok200, "3 INVITE")
	ack, bye := withCSeq(f.ack, "2 ACK"), withCSeq(f.bye, "3 BYE")
	if got := findingsOf("sip/ack-2xx", ruleInput{record: bye, call: []*Record{invite, ok, ack}}); len(got) != 0 {
		t.Errorf("the caller's ACK: %+v", got)
	}
	if got := findingsOf("sip/ack-2xx", ruleInput{record: bye, call: []*Record{invite, ok}}); len(got) != 1 {
		t.Errorf("no ACK: %+v", got)
	}
}

func TestFacts(t *testing.T) {
	if n, ok := cseqOf(&pb.SIPMessage{Extensions: []*pb.Extension{{Name: "cseq", Value: " 12 INVITE"}}}); !ok || n != 12 {
		t.Errorf("cseq: %d %v", n, ok)
	}
	for _, m := range []*pb.SIPMessage{nil, {}, {Extensions: []*pb.Extension{{Name: "CSeq", Value: "x INVITE"}}}} {
		if _, ok := cseqOf(m); ok {
			t.Errorf("cseq of %v", m)
		}
	}
	nets := map[[2]string]bool{
		{"10.0.0.7", "10.0.0.0/24"}:  true,
		{"10.0.1.7", "10.0.0.0/24"}:  false,
		{"10.0.0.7", "10.0.0.7"}:     true,
		{"8.8.8.8", "0.0.0.0/0"}:     true,
		{"routr", "routr"}:           true,
		{"routr", "10.0.0.0/24"}:     false,
		{"256.0.0.1", "10.0.0.0/24"}: false,
	}
	for c, want := range nets {
		if got := inNet(c[0], c[1]); got != want {
			t.Errorf("inNet(%s, %s) = %v", c[0], c[1], got)
		}
	}
	for user, want := range map[string]bool{"+17853178070": true, "17853178070": false, "+0123456789": false, "+123": false, "": false} {
		if got := isE164(user); got != want {
			t.Errorf("isE164(%s) = %v", user, got)
		}
	}
	uri, ok := uriOf(`"1001" <sip:+17066041487@sip.local;user=phone>`)
	if !ok || uri.user != "+17066041487" || uri.host != "sip.local" || uri.params != ";user=phone" {
		t.Errorf("uri: %+v", uri)
	}
	if _, ok := uriOf("nothing here"); ok {
		t.Error("no URI")
	}
}
