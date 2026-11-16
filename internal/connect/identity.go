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

package connect

import (
	"encoding/base64"
	"regexp"
	"strconv"
	"strings"

	"google.golang.org/protobuf/proto"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The caller identity Routr rewrites toward a Trunk travels in its own
// Record-Route, so the dialog's later requests can be mapped back without
// state (mods/common/src/identity.ts and the identity alterations of
// mods/processor/src/alterations.ts).

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
func uriPort(uri *spb.SipURI) int32 {
	if uri.GetPort() > 0 {
		return uri.GetPort()
	}
	return 0
}

// encodeIdentity writes user@host[:port][;user=...] as base64url, which keeps
// it a SIP token (RFC 3261 section 25.1) and unreserved in a URI user part: no
// quoting or escaping, and it survives every hop unchanged.
func encodeIdentity(uri *spb.SipURI) string {
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
func uriChanged(a, b *spb.SipURI) bool {
	return a.GetUser() != b.GetUser() ||
		a.GetHost() != b.GetHost() ||
		uriPort(a) != uriPort(b) ||
		a.GetUserParam() != b.GetUserParam()
}

// identityRewriteParameters is the mapping that remembers how the identity
// alterations changed a request's From and To; addSelfRecordRoute writes it in
// its Record-Route URI. Both ends of the dialog copy Record-Route into the
// Route of their in-dialog requests, so the mapping comes back to Routr on
// every BYE, re-INVITE and ACK without any state in Routr. Empty when nothing
// changed.
func identityRewriteParameters(fromBefore, toBefore, fromAfter, toAfter *spb.SipURI) map[string]string {
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

// isAnonymous tells whether a From is the anonymous identity (RFC 3323,
// SIPconnect 1.1 section 9). A caller that asked for privacy keeps it, so such
// a From is never rewritten.
func isAnonymous(uri *spb.SipURI) bool {
	return strings.EqualFold(uri.GetUser(), "anonymous") || strings.EqualFold(uri.GetHost(), "anonymous.invalid")
}

// rewriteFromWithNumber presents the Number as the caller toward a Trunk with
// rewriteFromWithNumber. Carriers that authenticate by the From header
// (WhatsApp Business Calling, many SIPconnect carriers) only accept a From that
// is the business number at their domain. The tag and display name stay, so the
// dialog is unchanged for Routr, which matches on tags and Call-ID. An anonymous
// From is left as it is.
//
// To moves to the Trunk URI's host and port, so it matches the Request-URI (RFC
// 3261 section 8.1.1.1): WhatsApp Business Calling answers 403 when the digest
// uri, the Request-URI, differs from To. Its user stays, and an anonymous From
// doesn't change that.
func rewriteFromWithNumber(req *ppb.MessageRequest, r *route) {
	if r.rewriteFrom == nil {
		return
	}
	if to := req.GetMessage().GetTo().GetAddress().GetUri(); to != nil {
		to.Host = r.host
		to.Port = r.port
	}
	from := req.GetMessage().GetFrom().GetAddress().GetUri()
	if from == nil || isAnonymous(from) {
		return
	}
	from.User = r.rewriteFrom.user
	from.Host = r.rewriteFrom.host
	// The URI names a telephone number (RFC 3261 section 19.1.1), as the
	// P-Asserted-Identity Connect adds toward the Trunk does
	from.UserParam = "phone"
	// The caller's own port has no meaning at the carrier's domain; -1 is how
	// the EdgePort's converter spells "no port"
	from.Port = -1
}

// applyTrunkIdentity is tailor.applyTrunkIdentity: the caller identity the
// route's Trunk asks for, and the numbers written in its formats, applied to
// the request on its way out. It returns the mapping Record-Route carries so
// Routr can map the identities back on the dialog's later requests, nil when
// the route asks for nothing.
func applyTrunkIdentity(req *ppb.MessageRequest, r *route) map[string]string {
	if r.formats == nil && r.rewriteFrom == nil {
		return nil
	}
	from := req.GetMessage().GetFrom().GetAddress().GetUri()
	to := req.GetMessage().GetTo().GetAddress().GetUri()
	if from == nil || to == nil {
		return nil
	}
	fromBefore := proto.Clone(from).(*spb.SipURI)
	toBefore := proto.Clone(to).(*spb.SipURI)
	rewriteFromWithNumber(req, r)
	formatCalledNumbers(req, r)
	if r.rewriteFrom != nil && r.rewriteFrom.noUserPhone && !isAnonymous(fromBefore) {
		from.UserParam = ""
	}
	return identityRewriteParameters(fromBefore, toBefore, from, to)
}

// routeIdentityMapping is the mapping a Route entry carries: in its URI user
// part, which a user agent keeps (RFC 3261 section 12.1.2), else in its header
// parameters, which it may drop. Only the user part carries the port, so only
// it is applied exactly. Nil when the entry has none.
func routeIdentityMapping(entry *spb.Route) (values map[string]string, exact bool) {
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

func sameIdentity(uri *spb.SipURI, id *identity) bool {
	return id != nil && uri.GetUser() == id.user && strings.EqualFold(uri.GetHost(), id.host)
}

func applyIdentity(uri *spb.SipURI, id *identity, exact bool) {
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

// swapIdentityFromRouteSet keeps each side of a dialog seeing the identities it
// knows. A request from the caller gets the From and To the Trunk saw on the
// INVITE; a request from the Trunk, whose To is the Number, gets the caller's
// own identity back. Some phones answer 481 to an in-dialog request whose To or
// From URI changed.
//
// The mapping is read from the first Route entry that carries one, and only
// when that entry points at this EdgePort: with two EdgePorts on the path, the
// one that rewrote the INVITE is the one that swaps, and the other leaves the
// request alone.
func swapIdentityFromRouteSet(req *ppb.MessageRequest) {
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

func swapIdentity(req *ppb.MessageRequest, values map[string]string, exact bool) {
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
