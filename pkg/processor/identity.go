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

package processor

import (
	"encoding/base64"
	"regexp"
	"strconv"
	"strings"

	"github.com/fonoster/routr/pkg/processor/pb/location"
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The caller identity a processor rewrites toward a Trunk travels in the
// EdgePort's own Record-Route, so the dialog's later requests can be mapped
// back without state (mods/common/src/identity.ts and the identity
// alterations of mods/processor/src/alterations.ts).

// The identity parameter names: [r]ewritten [f]rom or [c]allee (To),
// [o]riginal/[n]ew. Not "rto": a parser that looks for a header by searching
// for its name (SIPp does) finds "To" inside "rto=" on the Record-Route line.
const (
	identityFromOriginal = "rfo"
	identityFromNew      = "rfn"
	identityToOriginal   = "rco"
	identityToNew        = "rcn"
)

// identityParameterNames are the names in the order they are written.
var identityParameterNames = []string{identityFromOriginal, identityFromNew, identityToOriginal, identityToNew}

var (
	identityValue    = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
	identityHostPort = regexp.MustCompile(`^(\[[^\]]*\]|[^:]*)(?::(\d+))?$`)
)

// identity is what a SIP URI carries of who it names, as stored in a
// Record-Route URI or parameter. A port of 0 names none.
type identity struct {
	user      string
	host      string
	port      int32
	userParam string
}

// uriPort is the port a SIP URI names, 0 when it names none (the EdgePort's
// converter spells "no port" as -1, an unset field reads 0).
func uriPort(uri *sipmessage.SipURI) int32 {
	if uri.GetPort() > 0 {
		return uri.GetPort()
	}
	return 0
}

// encodeIdentity writes user@host[:port][;user=...] as base64url, which keeps
// it a SIP token (RFC 3261 section 25.1) and unreserved in a URI user part: no
// quoting or escaping, and it survives every hop unchanged.
func encodeIdentity(uri *sipmessage.SipURI) string {
	var b strings.Builder
	b.WriteString(uri.GetUser())
	b.WriteByte('@')
	b.WriteString(uri.GetHost())
	if port := uriPort(uri); port != 0 {
		b.WriteByte(':')
		b.WriteString(strconv.Itoa(int(port)))
	}
	if uri.GetUserParam() != "" {
		b.WriteString(";user=")
		b.WriteString(uri.GetUserParam())
	}
	return base64.RawURLEncoding.EncodeToString([]byte(b.String()))
}

// decodeIdentity reads what encodeIdentity wrote; nil when the value is not
// an identity.
func decodeIdentity(value string) *identity {
	if value == "" {
		return nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil
	}
	address, userParam, _ := strings.Cut(string(decoded), ";user=")
	at := strings.LastIndexByte(address, '@')
	if at < 0 {
		return nil
	}
	out := &identity{user: address[:at], host: address[at+1:], userParam: userParam}
	// An IPv6 host keeps its brackets, so its port follows the last "]:"
	if m := identityHostPort.FindStringSubmatch(out.host); m != nil {
		out.host = m[1]
		if m[2] != "" {
			port, err := strconv.ParseInt(m[2], 10, 32)
			if err != nil {
				return nil
			}
			out.port = int32(port)
		}
	}
	return out
}

// identityUser writes an identity mapping as a Route URI user part,
// rfo.<b64>.rfn.<b64>.rco.<b64>.rcn.<b64>, absent pairs left out; empty when
// there are none.
func identityUser(values map[string]string) string {
	var pairs []string
	for _, name := range identityParameterNames {
		if v := values[name]; v != "" {
			pairs = append(pairs, name+"."+v)
		}
	}
	return strings.Join(pairs, ".")
}

// decodeIdentityUser reads the mapping from a Route URI user part of that
// form, each pair optional, in that order; nil when it is not of this form.
// The URI is what a user agent keeps of a Record-Route entry (RFC 3261 section
// 12.1.2), and "." is not in the base64url alphabet.
func decodeIdentityUser(user string) map[string]string {
	parts := strings.Split(user, ".")
	if len(parts) < 2 || len(parts)%2 != 0 {
		return nil
	}
	values := make(map[string]string, len(parts)/2)
	last := -1
	for i := 0; i < len(parts); i += 2 {
		order := -1
		for o, name := range identityParameterNames {
			if name == parts[i] {
				order = o
				break
			}
		}
		if order <= last || !identityValue.MatchString(parts[i+1]) {
			return nil
		}
		last = order
		values[parts[i]] = parts[i+1]
	}
	return values
}

// uriChanged tells whether the identity alterations changed anything the
// mapping has to remember.
func uriChanged(a, b *sipmessage.SipURI) bool {
	return a.GetUser() != b.GetUser() ||
		a.GetHost() != b.GetHost() ||
		uriPort(a) != uriPort(b) ||
		a.GetUserParam() != b.GetUserParam()
}

// IdentityRewriteParameters is the mapping that remembers how the identity
// alterations (NormalizeToE164, RewriteFromWithNumber) changed a request's
// From and To: rfo and rfn the original and the new From, rco and rcn the
// original and the new To, each the base64url of user@host[:port][;user=...].
// AddSelfRecordRoute writes it in its Record-Route URI. Both ends of the
// dialog copy Record-Route into the Route of their in-dialog requests, so the
// mapping comes back on every BYE, re-INVITE and ACK without any state in the
// processor (see SwapIdentityFromRouteSet). Empty when nothing changed.
//
// original must be a proto.Clone of the request taken before the rewrite.
// The alterations change the request in place, so passing the same request
// twice yields an empty map; then AddSelfRecordRoute writes no identity and
// the dialog's BYE can't be restored (RFC 3261 section 12.1.2).
func IdentityRewriteParameters(original, altered *MessageRequest) map[string]string {
	fromBefore := original.GetMessage().GetFrom().GetAddress().GetUri()
	fromAfter := altered.GetMessage().GetFrom().GetAddress().GetUri()
	toBefore := original.GetMessage().GetTo().GetAddress().GetUri()
	toAfter := altered.GetMessage().GetTo().GetAddress().GetUri()
	parameters := map[string]string{}
	if uriChanged(fromBefore, fromAfter) {
		parameters[identityFromOriginal] = encodeIdentity(fromBefore)
		parameters[identityFromNew] = encodeIdentity(fromAfter)
	}
	if uriChanged(toBefore, toAfter) {
		parameters[identityToOriginal] = encodeIdentity(toBefore)
		parameters[identityToNew] = encodeIdentity(toAfter)
	}
	return parameters
}

// NormalizeToE164 rewrites the From, To and Request-URI users that read as a
// phone number as +E.164, landlines included; the others stay. The Node twin
// takes a flag and does nothing when it is false: here that is the caller's
// if.
func NormalizeToE164(req *MessageRequest) {
	msg := req.GetMessage()
	for _, uri := range []*sipmessage.SipURI{msg.GetFrom().GetAddress().GetUri(), msg.GetTo().GetAddress().GetUri(), msg.GetRequestUri()} {
		if uri == nil {
			continue
		}
		if normalized, ok := normalizeToE164(uri.GetUser()); ok {
			uri.User = normalized
		}
	}
}

// IsAnonymous tells whether a From is the anonymous identity (RFC 3323,
// SIPconnect 1.1 section 9): the user anonymous or the host
// anonymous.invalid, in any case. A caller that asked for privacy keeps it,
// so such a From is never rewritten.
func IsAnonymous(uri *sipmessage.SipURI) bool {
	return strings.EqualFold(uri.GetUser(), "anonymous") || strings.EqualFold(uri.GetHost(), "anonymous.invalid")
}

// FromRewrite is the From a Trunk that authenticates by it is presented:
// the Number as the user, at the carrier's domain.
type FromRewrite struct {
	User, Host string
}

// RewriteFromWithNumber presents the Number as the caller toward a Trunk.
// Carriers that authenticate by the From header (WhatsApp Business Calling,
// many SIPconnect carriers) only accept a From that is the business number at
// their domain. The From URI gets from's user and host, user=phone and no
// port; the tag and display name stay, so the dialog is unchanged. An
// anonymous From is left as it is. A nil from does nothing.
//
// To moves to the trunk route's host and port, so it matches the Request-URI
// (RFC 3261 section 8.1.1.1): WhatsApp Business Calling answers 403 when the
// digest uri, the Request-URI, differs from To. Its user stays, and an
// anonymous From doesn't change that.
//
// In the Node twin the rewrite is the route's rewriteFrom, a decision Connect
// makes, not Location data; here it is an argument.
func RewriteFromWithNumber(req *MessageRequest, trunk *location.Route, from *FromRewrite) {
	if from == nil {
		return
	}
	if to := req.GetMessage().GetTo().GetAddress().GetUri(); to != nil {
		to.Host = trunk.GetHost()
		to.Port = portOf(trunk.GetPort())
	}
	uri := req.GetMessage().GetFrom().GetAddress().GetUri()
	if uri == nil || IsAnonymous(uri) {
		return
	}
	uri.User = from.User
	uri.Host = from.Host
	// The URI names a telephone number (RFC 3261 section 19.1.1)
	uri.UserParam = "phone"
	// The caller's own port has no meaning at the carrier's domain; -1 is how
	// the EdgePort's converter spells "no port"
	uri.Port = -1
}

// routeIdentityMapping is the mapping a Route entry carries: in its URI user
// part, which a user agent keeps (RFC 3261 section 12.1.2), else in its header
// parameters, which it may drop. Only the user part carries the port, so only
// it is applied exactly. Nil when the entry has none.
func routeIdentityMapping(entry *sipmessage.Route) (values map[string]string, exact bool) {
	hasMapping := func(v map[string]string) bool {
		return v[identityFromNew] != "" || v[identityToNew] != ""
	}
	if inUser := decodeIdentityUser(entry.GetAddress().GetUri().GetUser()); hasMapping(inUser) {
		return inUser, true
	}
	if hasMapping(entry.GetParameters()) {
		return entry.GetParameters(), false
	}
	return nil, false
}

func sameIdentity(uri *sipmessage.SipURI, id *identity) bool {
	return id != nil && uri.GetUser() == id.user && strings.EqualFold(uri.GetHost(), id.host)
}

func applyIdentity(uri *sipmessage.SipURI, id *identity, exact bool) {
	uri.User = id.user
	uri.Host = id.host
	uri.UserParam = id.userParam
	if exact {
		uri.Port = id.port
		if id.port == 0 {
			uri.Port = -1
		}
	}
}

// SwapIdentityFromRouteSet keeps each side of a dialog seeing the identities
// it knows. A request from the caller gets the From and To the Trunk saw on
// the INVITE; a request from the Trunk, whose To is the Number, gets the
// caller's own identity back. Some phones answer 481 to an in-dialog request
// whose To or From URI changed.
//
// The mapping is read from the first Route entry that carries one, in its URI
// user part or else its header parameters, and only when that entry points at
// this EdgePort: with two EdgePorts on the path, the one that rewrote the
// INVITE is the one that swaps, and the other leaves the request alone. Run
// it before RemoveSelfRoutes, which consumes that entry.
func SwapIdentityFromRouteSet(req *MessageRequest) {
	for _, entry := range req.GetMessage().GetRoute() {
		values, exact := routeIdentityMapping(entry)
		if values == nil {
			continue
		}
		if isSelfRoute(req, entry) {
			swapIdentity(req, values, exact)
		}
		return
	}
}

func swapIdentity(req *MessageRequest, values map[string]string, exact bool) {
	from := req.GetMessage().GetFrom().GetAddress().GetUri()
	to := req.GetMessage().GetTo().GetAddress().GetUri()
	if from == nil || to == nil {
		return
	}
	fromOriginal := decodeIdentity(values[identityFromOriginal])
	fromNew := decodeIdentity(values[identityFromNew])
	toOriginal := decodeIdentity(values[identityToOriginal])
	toNew := decodeIdentity(values[identityToNew])

	// From the caller: From is the caller, To is the callee
	if fromNew != nil && sameIdentity(from, fromOriginal) {
		applyIdentity(from, fromNew, exact)
	} else if toOriginal != nil && sameIdentity(from, toNew) {
		// From the Trunk: From is the callee as the Trunk knows it
		applyIdentity(from, toOriginal, exact)
	}
	if toNew != nil && sameIdentity(to, toOriginal) {
		applyIdentity(to, toNew, exact)
	} else if fromOriginal != nil && sameIdentity(to, fromNew) {
		// From the Trunk: To is the Number the caller was presented as
		applyIdentity(to, fromOriginal, exact)
	}
}
