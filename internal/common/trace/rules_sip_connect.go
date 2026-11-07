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
	"regexp"
	"strings"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The sip-connect profile: the SIPconnect 1.1 Technical Recommendation
// (rules/sip-connect/*.ts).

// towardServiceProvider tells whether a record is a dialog-creating INVITE the
// proxy forwards out of its external interface, which is where SIPconnect 1.1
// applies. The external interface is a fact of the EdgePort (externalAddrs);
// the top Via of the outgoing request names the interface the request leaves by.
func towardServiceProvider(r *Record) bool {
	if !isForwarded(r) || r.Method != "INVITE" || isInDialog(r) {
		return false
	}
	return isExternalHost(r.Request, topVia(outbound(r)).GetHost())
}

func isAnonymous(uri *pb.SipURI) bool {
	return strings.ToLower(uri.GetUser()) == "anonymous" || strings.ToLower(uri.GetHost()) == "anonymous.invalid"
}

var rulePAISingle = &Rule{
	ID:       "sip-connect/pai-single",
	Profile:  ProfileSIPConnect,
	Severity: SeverityError,
	Spec:     "SIPconnect 1.1, calling party identity (test 1.3.1)",
	Summary:  "Exactly one P-Asserted-Identity reaches the service provider",
	check: func(r *Record, _ []*Record, fail report) {
		if !towardServiceProvider(r) {
			return
		}
		pai := headerValues(outbound(r), "P-Asserted-Identity")
		switch {
		case len(pai) == 0:
			fail("no P-Asserted-Identity on the INVITE to the service provider", SideOut, "P-Asserted-Identity")
		case len(pai) > 1:
			fail(fmt.Sprintf("%d P-Asserted-Identity headers reach the service provider; it reads the first", len(pai)), SideOut, "P-Asserted-Identity")
		}
	},
}

var rulePAIE164 = &Rule{
	ID:       "sip-connect/pai-e164",
	Profile:  ProfileSIPConnect,
	Severity: SeverityError,
	Spec:     "SIPconnect 1.1, calling party identity, E.164 with user=phone (test 1.3.1)",
	Summary:  "P-Asserted-Identity is a global E.164 number with user=phone",
	check: func(r *Record, _ []*Record, fail report) {
		if !towardServiceProvider(r) {
			return
		}
		values := headerValues(outbound(r), "P-Asserted-Identity")
		if len(values) == 0 || values[0] == "" {
			return
		}
		pai := values[0]
		uri, ok := uriOf(pai)
		if !ok || !isE164(uri.user) {
			fail("P-Asserted-Identity is not E.164: "+pai, SideOut, "P-Asserted-Identity")
			return
		}
		if !strings.Contains(uri.params, "user=phone") {
			fail("P-Asserted-Identity lacks user=phone: "+pai, SideOut, "P-Asserted-Identity")
		}
	},
}

var ruleRequestURIE164 = &Rule{
	ID:       "sip-connect/request-uri-e164",
	Profile:  ProfileSIPConnect,
	Severity: SeverityError,
	Spec:     "SIPconnect 1.1, called party number, E.164 with user=phone (test 1.3.1)",
	Summary:  "The Request-URI to the service provider is E.164 with user=phone",
	check: func(r *Record, _ []*Record, fail report) {
		if !towardServiceProvider(r) {
			return
		}
		uri := outbound(r).GetRequestUri()
		if uri == nil {
			return
		}
		if !isE164(uri.GetUser()) {
			fail(fmt.Sprintf("Request-URI user %s is not E.164", uri.GetUser()), SideOut, "Request-URI")
			return
		}
		if uri.GetUserParam() != "phone" {
			fail("Request-URI lacks user=phone", SideOut, "Request-URI")
		}
	},
}

var ruleFromE164OrAnonymous = &Rule{
	ID:       "sip-connect/from-e164-or-anonymous",
	Profile:  ProfileSIPConnect,
	Severity: SeverityWarning,
	Spec:     "SIPconnect 1.1, calling party identity and privacy (tests 1.3.1, 1.3.4)",
	Summary:  "From carries an E.164 number or the anonymous identity",
	check: func(r *Record, _ []*Record, fail report) {
		if !towardServiceProvider(r) {
			return
		}
		from := outbound(r).GetFrom().GetAddress().GetUri()
		if from == nil {
			return
		}
		if !isAnonymous(from) && !isE164(from.GetUser()) {
			fail(fmt.Sprintf("From user %s is neither E.164 nor anonymous", from.GetUser()), SideOut, "From")
		}
	},
}

var privacyID = regexp.MustCompile(`\bid\b`)

var rulePrivacy = &Rule{
	ID:       "sip-connect/privacy",
	Profile:  ProfileSIPConnect,
	Severity: SeverityError,
	Spec:     "RFC 3323 §4.2, RFC 3325 §9.3, SIPconnect 1.1 privacy (test 1.3.4)",
	Summary:  "With Privacy: id the From is anonymous and the identity travels only in P-Asserted-Identity",
	check: func(r *Record, _ []*Record, fail report) {
		if !towardServiceProvider(r) {
			return
		}
		out := outbound(r)
		privacy := strings.ToLower(strings.Join(headerValues(out, "Privacy"), ";"))
		if !privacyID.MatchString(privacy) {
			return
		}
		if !isAnonymous(out.GetFrom().GetAddress().GetUri()) {
			fail("Privacy: id requested but From still names the caller", SideOut, "From")
		}
		if len(headerValues(out, "P-Asserted-Identity")) == 0 {
			fail("Privacy: id requested but no P-Asserted-Identity carries the identity for the provider", SideOut, "P-Asserted-Identity")
		}
	},
}
