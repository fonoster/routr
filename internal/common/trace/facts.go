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
	"regexp"
	"strconv"
	"strings"

	"github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The facts a rule may read (rules/facts.ts): the SIP messages, the processor
// contract fields and what the Dispatcher measured. Never a hop's metadata.

func inbound(r *Record) *pb.SIPMessage { return r.Request.GetMessage() }

func outbound(r *Record) *pb.SIPMessage {
	if r.Response == nil {
		return nil
	}
	return r.Response.Message
}

func isRequest(r *Record) bool  { return r.Kind == KindRequest }
func isResponse(r *Record) bool { return r.Kind == KindResponse }

func isForwarded(r *Record) bool {
	return isRequest(r) && r.Outcome == OutcomeForwarded && r.Response != nil
}

func isRelayed(r *Record) bool {
	return isResponse(r) && r.Outcome == OutcomeRelayed && r.Response != nil
}

func isInDialog(r *Record) bool { return inbound(r).GetTo().GetTag() != "" }

// statusOf returns the status of a record, 0 when it has none.
func statusOf(r *Record) int {
	if r.Status != 0 {
		return r.Status
	}
	if isResponse(r) {
		return StatusCodeOf(inbound(r).GetResponseType())
	}
	return StatusCodeOf(outbound(r).GetResponseType())
}

func headerValues(m *pb.SIPMessage, name string) []string {
	var values []string
	for _, ext := range m.GetExtensions() {
		if strings.EqualFold(ext.GetName(), name) {
			values = append(values, ext.GetValue())
		}
	}
	return values
}

// parseInt reads a number as JavaScript's parseInt(s, 10) does: an optional
// sign and the digits that follow, whatever comes after them.
func parseInt(s string) (int, bool) {
	s = strings.TrimSpace(s)
	end := 0
	if end < len(s) && (s[end] == '-' || s[end] == '+') {
		end++
	}
	digits := end
	for end < len(s) && s[end] >= '0' && s[end] <= '9' {
		end++
	}
	if end == digits {
		return 0, false
	}
	n, err := strconv.Atoi(s[:end])
	return n, err == nil
}

// cseqOf returns the number of the CSeq header, false when it has none.
func cseqOf(m *pb.SIPMessage) (int, bool) {
	values := headerValues(m, "CSeq")
	if len(values) == 0 {
		return 0, false
	}
	fields := strings.Fields(values[0])
	if len(fields) == 0 {
		return 0, false
	}
	return parseInt(fields[0])
}

func topVia(m *pb.SIPMessage) *pb.Via {
	via := m.GetVia()
	if len(via) == 0 {
		return nil
	}
	return via[0]
}

func topBranch(m *pb.SIPMessage) string { return topVia(m).GetBranch() }

func isExternalHost(req *processor.MessageRequest, host string) bool {
	if host == "" {
		return false
	}
	for _, addr := range req.GetExternalAddrs() {
		if addr == host {
			return true
		}
	}
	return false
}

// isInternalHost tells whether a host is one of the proxy's internal
// interfaces: a listening point, the socket the message came in on, or an
// address in localnets.
func isInternalHost(req *processor.MessageRequest, host string) bool {
	if host == "" {
		return false
	}
	for _, lp := range req.GetListeningPoints() {
		if lp.GetHost() == host {
			return true
		}
	}
	if req.GetReceivedOn().GetHost() == host {
		return true
	}
	for _, net := range req.GetLocalnets() {
		if inNet(host, net) {
			return true
		}
	}
	return false
}

func isOwnHost(req *processor.MessageRequest, host string) bool {
	return isExternalHost(req, host) || isInternalHost(req, host)
}

// isAliasHost tells whether a host is one of the names the proxy answers to.
// Aliases are never advertised, so only the rule about Route entries uses this.
func isAliasHost(req *processor.MessageRequest, host string) bool {
	if host == "" {
		return false
	}
	for _, alias := range req.GetAliases() {
		if strings.EqualFold(alias, host) {
			return true
		}
	}
	return false
}

func inNet(host, network string) bool {
	parts := strings.Split(network, "/")
	base := parts[0]
	bits, hasBits := 32, true
	if len(parts) > 1 {
		bits, hasBits = parseInt(parts[1])
	}
	a, okA := ipv4(host)
	b, okB := ipv4(base)
	if !okA || !okB || !hasBits {
		return host == base
	}
	var mask uint32
	if bits != 0 {
		mask = ^uint32(0) << (uint(32-bits) & 31)
	}
	return a&mask == b&mask
}

func ipv4(s string) (uint32, bool) {
	parts := strings.Split(s, ".")
	if len(parts) != 4 {
		return 0, false
	}
	var n uint32
	for _, p := range parts {
		v, ok := parseInt(p)
		if !ok || v < 0 || v > 255 {
			return 0, false
		}
		n = n<<8 | uint32(v)
	}
	return n, true
}

// directionOf identifies the party that sent a request: its From URI and tag.
// Both are needed, a SIPp-style endpoint may use the same tag on both sides.
func directionOf(r *Record) string {
	from := inbound(r).GetFrom()
	uri := from.GetAddress().GetUri()
	return uri.GetUser() + "@" + uri.GetHost() + ";" + from.GetTag()
}

var (
	e164Pattern = regexp.MustCompile(`^\+[1-9][0-9]{6,14}$`)
	uriPattern  = regexp.MustCompile(`<?sips?:(?:([^@>;]*)@)?([^>;?]*)([^>]*)>?`)
)

// isE164 tells whether a user part is a plus sign and 7 to 15 digits.
func isE164(user string) bool { return e164Pattern.MatchString(user) }

// parsedURI is what uriOf finds in a header value.
type parsedURI struct {
	user, host, params string
}

// uriOf parses `<sip:user@host;params>` or `sip:user@host` out of a header value.
func uriOf(value string) (parsedURI, bool) {
	m := uriPattern.FindStringSubmatch(value)
	if m == nil {
		return parsedURI{}, false
	}
	return parsedURI{user: m[1], host: m[2], params: m[3]}, true
}
