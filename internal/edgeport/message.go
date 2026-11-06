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
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

// reasonPhrases are JAIN-SIP's default reason phrases (SIPResponse.getReasonPhrase).
var reasonPhrases = map[int]string{
	100: "Trying", 180: "Ringing", 181: "Call is being forwarded", 182: "Queued",
	183: "Session progress", 200: "OK", 202: "Accepted", 300: "Multiple choices",
	301: "Moved permanently", 302: "Moved Temporarily", 305: "Use proxy",
	380: "Alternative service", 400: "Bad request", 401: "Unauthorized",
	402: "Payment required", 403: "Forbidden", 404: "Not found",
	405: "Method not allowed", 406: "Not acceptable",
	407: "Proxy Authentication required", 408: "Request timeout", 410: "Gone",
	413: "Request entity too large", 414: "Request-URI too large",
	415: "Unsupported media type", 416: "Unsupported URI Scheme",
	420: "Bad extension", 421: "Etension Required", 423: "Interval too brief",
	480: "Temporarily Unavailable", 481: "Call leg/Transaction does not exist",
	482: "Loop detected", 483: "Too many hops", 484: "Address incomplete",
	485: "Ambiguous", 486: "Busy here", 487: "Request Terminated",
	488: "Not Acceptable here", 489: "Bad Event", 491: "Request Pending",
	493: "Undecipherable", 500: "Server Internal Error", 501: "Not implemented",
	502: "Bad gateway", 503: "Service unavailable", 504: "Gateway timeout",
	505: "SIP version not supported", 513: "Message Too Large",
	600: "Busy everywhere", 603: "Decline", 604: "Does not exist anywhere",
	606: "Session Not acceptable",
}

// ReasonPhrase returns JAIN-SIP's default reason phrase for a code.
func ReasonPhrase(code int) string {
	if r, ok := reasonPhrases[code]; ok {
		return r
	}
	return "Unknown Status"
}

func isDialogCreating(method sip.RequestMethod) bool {
	return method == sip.INVITE || method == sip.SUBSCRIBE || method == sip.REFER
}

// NewResponse is JAIN-SIP's SIPRequest.createResponse: From, To, the Vias,
// Call-ID, CSeq and Timestamp of the request, and its Record-Route for a
// 101-299 to a dialog-creating request without a To tag. No To tag is added.
func NewResponse(req *sip.Request, code int, reason string) *sip.Response {
	res := sip.NewResponse(code, reason)
	res.SipVersion = req.SipVersion
	copyRR := code > 100 && code < 300 && isDialogCreating(req.Method) && !hasToTag(req)
	for _, h := range req.Headers() {
		switch sipconv.CanonicalName(h.Name()) {
		case "From", "To", "Via", "Call-ID", "CSeq", "Timestamp":
			res.AppendHeader(sip.HeaderClone(h))
		case "Record-Route":
			if copyRR {
				res.AppendHeader(sip.HeaderClone(h))
			}
		}
	}
	if code == 100 {
		if to := res.To(); to != nil {
			to.Params.Remove("tag")
		}
	}
	res.SetTransport(req.Transport())
	res.SetSource(req.Source())
	return res
}

func hasToTag(req *sip.Request) bool {
	to := req.To()
	if to == nil {
		return false
	}
	_, ok := to.Params.Get("tag")
	return ok
}

type headerList interface {
	Headers() []sip.Header
	AppendHeader(sip.Header)
	PrependHeader(...sip.Header)
	GetHeaders(string) []sip.Header
}

// AttachHeaders adds headers to a message as JAIN-SIP's SIPMessage.addHeader
// does: a Via or Record-Route goes on top of the ones already there, a header
// JAIN-SIP keeps one of is ignored when the message has it, and anything else
// is added after the headers of the same name.
//
// It returns the message's new header list; the caller rebuilds the message
// from it.
func AttachHeaders(existing []sip.Header, add []sip.Header) []sip.Header {
	out := append([]sip.Header(nil), existing...)
	names := func(h sip.Header) string { return strings.ToLower(sipconv.CanonicalName(h.Name())) }
	has := func(name string) bool {
		for _, h := range out {
			if names(h) == name {
				return true
			}
		}
		return false
	}
	// Vias and Record-Routes of the processor's list come in their order on top
	// (createHeadersFromMessage walks them backwards and puts each on top)
	var topVias, topRRs []sip.Header
	for _, h := range add {
		name := names(h)
		switch {
		case name == "via":
			topVias = append(topVias, h)
		case name == "record-route":
			topRRs = append(topRRs, h)
		case sipconv.IsSingleton(h.Name()) && has(name):
			// ignored, as SIPMessage.attachHeader ignores a duplicate
		default:
			last := -1
			for i, e := range out {
				if names(e) == name {
					last = i
				}
			}
			if last < 0 {
				out = append(out, h)
			} else {
				out = append(out[:last+1], append([]sip.Header{h}, out[last+1:]...)...)
			}
		}
	}
	if len(topRRs) > 0 {
		out = insertOnTop(out, "record-route", topRRs)
	}
	if len(topVias) > 0 {
		out = insertOnTop(out, "via", topVias)
	}
	return out
}

func insertOnTop(headers []sip.Header, name string, top []sip.Header) []sip.Header {
	idx := -1
	for i, h := range headers {
		if strings.EqualFold(sipconv.CanonicalName(h.Name()), name) {
			idx = i
			break
		}
	}
	if idx < 0 {
		// A new header list goes first (SIPMessage.attachHeader, top = true)
		return append(append([]sip.Header(nil), top...), headers...)
	}
	out := append([]sip.Header(nil), headers[:idx]...)
	out = append(out, top...)
	return append(out, headers[idx:]...)
}

// JoinListHeaders encodes the elements of a JAIN-SIP list header on one line,
// comma separated (semicolon for Privacy), as SIPHeaderList.encode does. Via,
// Route, Record-Route, Contact and the authentication headers keep a line each.
func JoinListHeaders(headers []sip.Header) []sip.Header {
	out := make([]sip.Header, 0, len(headers))
	first := map[string]int{}
	values := map[string][]string{}
	for _, h := range headers {
		name := sipconv.CanonicalName(h.Name())
		sep := sipconv.ListSeparator(name)
		if sep == 0 {
			out = append(out, h)
			continue
		}
		key := strings.ToLower(name)
		if _, ok := first[key]; !ok {
			first[key] = len(out)
			out = append(out, h)
		}
		values[key] = append(values[key], sipconv.ExtensionValues(name, h.Value())...)
	}
	for key, idx := range first {
		name := sipconv.CanonicalName(out[idx].Name())
		out[idx] = sip.NewHeader(name, strings.Join(values[key], string(sipconv.ListSeparator(name))))
	}
	return out
}

// newBranch returns a random RFC 3261 branch.
func newBranch() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return sip.RFC3261BranchMagicCookie + hex.EncodeToString(b)
}

// statelessBranch derives a branch for a request forwarded statelessly (an ACK
// for a 2xx) from the request it forwards, so a retransmission gets the same
// one (RFC 3261 section 16.11).
func statelessBranch(req *sip.Request) string {
	h := md5.New()
	if v := req.Via(); v != nil {
		h.Write([]byte(v.Value()))
	}
	if id := req.CallID(); id != nil {
		h.Write([]byte(id.Value()))
	}
	if cseq := req.CSeq(); cseq != nil {
		h.Write([]byte(cseq.Value()))
	}
	h.Write([]byte(req.Recipient.String()))
	return sip.RFC3261BranchMagicCookie + hex.EncodeToString(h.Sum(nil))[:24]
}

// Hop is where a request goes next.
type Hop struct {
	Host      string
	Port      int
	Transport string
}

func (h Hop) addr() string {
	if strings.Contains(h.Host, ":") && !strings.HasPrefix(h.Host, "[") {
		return "[" + h.Host + "]:" + strconv.Itoa(h.Port)
	}
	return h.Host + ":" + strconv.Itoa(h.Port)
}

// NextHop is JAIN-SIP's DefaultRouter.getNextHop: the first Route if there is
// one, else the Request-URI's maddr or the Request-URI. The transport is TLS for
// a sips URI, else the URI's transport parameter, else the top Via's transport.
// The port defaults to 5061 for TLS and 5060 otherwise.
func NextHop(req *sip.Request) Hop {
	uri := req.Recipient
	if routes := req.GetHeaders("Route"); len(routes) > 0 {
		if parts := sipconv.SplitTopLevel(routes[0].Value(), ','); len(parts) > 0 {
			var r sip.Uri
			var params sip.HeaderParams
			if _, err := sip.ParseAddressValue(parts[0], &r, &params); err == nil {
				uri = r
			}
		}
	}
	transport := ""
	if strings.EqualFold(uri.Scheme, "sips") {
		transport = "TLS"
	} else if v, ok := uri.UriParams.Get("transport"); ok && v != "" {
		transport = strings.ToUpper(v)
	} else if via := req.Via(); via != nil {
		transport = strings.ToUpper(via.Transport)
	}
	if transport == "" {
		transport = "UDP"
	}
	port := uri.Port
	if port <= 0 {
		port = 5060
		if transport == "TLS" {
			port = 5061
		}
	}
	host := uri.Host
	if maddr, ok := uri.UriParams.Get("maddr"); ok && maddr != "" {
		host = maddr
	}
	return Hop{Host: host, Port: port, Transport: transport}
}

// ResponseHop is where a response goes (RFC 3261 section 18.2.2, as
// SIPServerTransaction.sendMessage does it): the top Via's maddr, received or
// sent-by host, at its rport, port or the transport's default.
func ResponseHop(res *sip.Response) (Hop, bool) {
	via := res.Via()
	if via == nil {
		return Hop{}, false
	}
	transport := strings.ToUpper(via.Transport)
	port := 0
	if rport, ok := via.Params.Get("rport"); ok && rport != "" {
		port, _ = strconv.Atoi(rport)
	}
	if port <= 0 {
		port = via.Port
	}
	if port <= 0 {
		port = 5060
		if transport == "TLS" {
			port = 5061
		}
	}
	host := via.Host
	if received, ok := via.Params.Get("received"); ok && received != "" {
		host = received
	}
	if maddr, ok := via.Params.Get("maddr"); ok && maddr != "" {
		host = maddr
	}
	return Hop{Host: host, Port: port, Transport: transport}, true
}

// NewCancel is JAIN-SIP's SIPClientTransaction.createCancel: the INVITE's
// Request-URI, top Via, Route set, Call-ID, From, To, Max-Forwards and CSeq
// number, with CANCEL as the method.
func NewCancel(invite *sip.Request) *sip.Request {
	cancel := sip.NewRequest(sip.CANCEL, *invite.Recipient.Clone())
	cancel.SipVersion = invite.SipVersion
	if via := invite.Via(); via != nil {
		cancel.AppendHeader(via.Clone())
	}
	for _, h := range invite.GetHeaders("Route") {
		cancel.AppendHeader(sip.HeaderClone(h))
	}
	if mf := invite.GetHeader("Max-Forwards"); mf != nil {
		cancel.AppendHeader(sip.HeaderClone(mf))
	}
	if id := invite.CallID(); id != nil {
		cancel.AppendHeader(sip.HeaderClone(id))
	}
	if from := invite.From(); from != nil {
		cancel.AppendHeader(sip.HeaderClone(from))
	}
	if to := invite.To(); to != nil {
		cancel.AppendHeader(sip.HeaderClone(to))
	}
	if cseq := invite.CSeq(); cseq != nil {
		cancel.AppendHeader(&sip.CSeqHeader{SeqNo: cseq.SeqNo, MethodName: sip.CANCEL})
	}
	cancel.SetBody(nil)
	cancel.SetTransport(invite.Transport())
	cancel.SetDestination(invite.Destination())
	cancel.Laddr = invite.Laddr
	return cancel
}

// RestoreIdentity is ResponseHelper.restoreIdentity: the response gets the From
// and To of the caller's request, keeping the To tag the far end added.
func RestoreIdentity(headers []sip.Header, original *sip.Request) []sip.Header {
	if original == nil {
		return headers
	}
	out := append([]sip.Header(nil), headers...)
	var answeredTag string
	for _, h := range out {
		if to, ok := h.(*sip.ToHeader); ok {
			answeredTag, _ = to.Params.Get("tag")
			break
		}
	}
	for i, h := range out {
		switch h.(type) {
		case *sip.FromHeader:
			if from := original.From(); from != nil {
				out[i] = sip.HeaderClone(from)
			}
		case *sip.ToHeader:
			if to := original.To(); to != nil {
				restored := sip.HeaderClone(to).(*sip.ToHeader)
				if answeredTag != "" {
					if restored.Params == nil {
						restored.Params = sip.NewParams()
					}
					restored.Params.Add("tag", answeredTag)
				}
				out[i] = restored
			}
		}
	}
	return out
}

// ReplaceCSeq sets the CSeq of a header list.
func ReplaceCSeq(headers []sip.Header, cseq *sip.CSeqHeader) []sip.Header {
	out := append([]sip.Header(nil), headers...)
	for i, h := range out {
		if _, ok := h.(*sip.CSeqHeader); ok {
			out[i] = &sip.CSeqHeader{SeqNo: cseq.SeqNo, MethodName: cseq.MethodName}
			return out
		}
	}
	return append(out, &sip.CSeqHeader{SeqNo: cseq.SeqNo, MethodName: cseq.MethodName})
}

// rebuildResponse makes a response with the given headers and body.
func rebuildResponse(from *sip.Response, reason string, headers []sip.Header, body []byte) *sip.Response {
	res := sip.NewResponse(from.StatusCode, reason)
	res.SipVersion = from.SipVersion
	for _, h := range JoinListHeaders(headers) {
		if _, ok := h.(*sip.ContentLengthHeader); ok {
			continue
		}
		res.AppendHeader(h)
	}
	res.SetBody(body)
	res.SetTransport(from.Transport())
	res.SetSource(from.Source())
	return res
}

// withoutHeaders returns the headers without the given names.
func withoutHeaders(headers []sip.Header, names ...string) []sip.Header {
	out := make([]sip.Header, 0, len(headers))
	for _, h := range headers {
		name := sipconv.CanonicalName(h.Name())
		skip := false
		for _, n := range names {
			if strings.EqualFold(name, n) {
				skip = true
				break
			}
		}
		if !skip {
			out = append(out, h)
		}
	}
	return out
}

func cloneHeaders(headers []sip.Header) []sip.Header {
	out := make([]sip.Header, len(headers))
	for i, h := range headers {
		out[i] = sip.HeaderClone(h)
	}
	return out
}
