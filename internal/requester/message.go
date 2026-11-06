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

package requester

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/pb/common"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// reasonRequestTimeout is JAIN-SIP's reason phrase for a 408.
const reasonRequestTimeout = "Request timeout"

// hop is where a request goes next.
type hop struct {
	host      string
	port      int
	transport string
}

func (h hop) addr() string {
	return net.JoinHostPort(strings.Trim(h.host, "[]"), strconv.Itoa(h.port))
}

// buildRequest is RequestSender.sendRequest up to the send: the Request-URI
// made of the user and the target, the message's headers, and the Via and
// Contact of the listening point at host:port. A request missing a header
// SIPRequest.checkHeaders requires is refused, as JAIN-SIP refuses to send it.
func buildRequest(in *pb.SendMessageRequest, host string, port int) (*sip.Request, error) {
	switch in.GetMethod() {
	case ppb.Method_UNKNOWN, ppb.Method_ACK:
		return nil, fmt.Errorf("unsupported method %s", in.GetMethod())
	}
	transport, err := transportName(in.GetTransport())
	if err != nil {
		return nil, err
	}
	msg := in.GetMessage()
	if msg == nil {
		return nil, errors.New("the request has no message")
	}
	uri, err := requestURI(in.GetTarget(), msg.GetRequestUri().GetUser(), transport)
	if err != nil {
		return nil, err
	}

	// Via first: JAIN-SIP's addHeader puts a Via on top of the ones there
	headers := []sip.Header{viaHeader(transport, host, port)}
	for _, h := range sipconv.HeadersFromDTO(msg) {
		// Content-Length is computed
		if !strings.EqualFold(h.Name(), "Content-Length") {
			headers = append(headers, h)
		}
	}
	headers = append(headers, contactHeader(transport, host, port))

	req := sip.NewRequest(sip.RequestMethod(in.GetMethod().String()), uri)
	for _, h := range joinListHeaders(attachHeaders(headers)) {
		req.AppendHeader(h)
	}
	if err := checkHeaders(req); err != nil {
		return nil, err
	}
	var body []byte
	if msg.GetBody() != "" {
		if req.GetHeader("Content-Type") == nil {
			return nil, errors.New("the request has a body and no Content-Type")
		}
		body = []byte(msg.GetBody())
	}
	req.SetBody(body)

	next := nextHop(req)
	if next.transport != "UDP" && next.transport != "TCP" {
		return nil, fmt.Errorf("no listening point for transport %s", next.transport)
	}
	req.SetTransport(next.transport)
	req.SetDestination(next.addr())
	return req, nil
}

// transportName returns the listening point's name for a transport: the
// Requester listens on UDP and TCP only.
func transportName(t common.Transport) (string, error) {
	switch t {
	case common.Transport_UDP, common.Transport_TCP:
		return strings.ToLower(t.String()), nil
	}
	return "", fmt.Errorf("no listening point for transport %s", t)
}

// requestURI is sip:[user@]target;transport=<transport>.
func requestURI(target, user, transport string) (sip.Uri, error) {
	if target == "" {
		return sip.Uri{}, errors.New("the request has no target")
	}
	uri := sip.Uri{Scheme: "sip", User: user, Host: target, UriParams: sip.NewParams()}
	if h, p, err := net.SplitHostPort(target); err == nil {
		n, err := strconv.Atoi(p)
		if err != nil {
			return sip.Uri{}, fmt.Errorf("invalid target %q: expects port to be a number", target)
		}
		uri.Host, uri.Port = h, n
	} else if strings.Contains(strings.Trim(target, "[]"), ":") && net.ParseIP(strings.Trim(target, "[]")) == nil {
		return sip.Uri{}, fmt.Errorf("invalid target %q", target)
	}
	uri.Host = strings.Trim(uri.Host, "[]")
	uri.UriParams.Add("transport", transport)
	return uri, nil
}

// viaHeader is the listening point's Via with rport asked for. The branch goes
// after it, where getNewClientTransaction puts it.
func viaHeader(transport, host string, port int) *sip.ViaHeader {
	via := &sip.ViaHeader{
		ProtocolName:    "SIP",
		ProtocolVersion: "2.0",
		Transport:       strings.ToUpper(transport),
		Host:            host,
		Port:            port,
		Params:          sip.NewParams(),
	}
	via.Params.Add("rport", "")
	via.Params.Add("branch", newBranch())
	return via
}

// contactHeader is sip:<host>:<port>;transport=<transport>;bnc, the
// bulk-number Contact of SIPconnect's registration mode.
func contactHeader(transport, host string, port int) *sip.ContactHeader {
	uri := sip.Uri{Scheme: "sip", Host: host, Port: port, UriParams: sip.NewParams()}
	uri.UriParams.Add("transport", transport)
	uri.UriParams.Add("bnc", "")
	return &sip.ContactHeader{Address: uri, Params: sip.NewParams()}
}

// newBranch returns a random RFC 3261 branch.
func newBranch() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return sip.RFC3261BranchMagicCookie + hex.EncodeToString(b)
}

// checkHeaders is the part of SIPRequest.checkHeaders every method shares.
func checkHeaders(req *sip.Request) error {
	missing := ""
	switch {
	case req.CSeq() == nil:
		missing = "CSeq"
	case req.To() == nil:
		missing = "To"
	case req.From() == nil:
		missing = "From"
	case req.CallID() == nil:
		missing = "Call-ID"
	case req.GetHeader("Max-Forwards") == nil:
		missing = "Max-Forwards"
	default:
		return nil
	}
	return fmt.Errorf("the request has no %s header", missing)
}

// nextHop is JAIN-SIP's DefaultRouter.getNextHop: the first Route if there is
// one, else the Request-URI's maddr or the Request-URI. The transport is TLS
// for a sips URI, else the URI's transport parameter, else the top Via's.
func nextHop(req *sip.Request) hop {
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
	return hop{host: host, port: port, transport: transport}
}

// timeoutResponse is JAIN-SIP's createResponse(408, request): the request's
// From, To, Vias, Call-ID, CSeq and Timestamp, with no To tag added.
func timeoutResponse(req *sip.Request) *sip.Response {
	res := sip.NewResponse(sip.StatusRequestTimeout, reasonRequestTimeout)
	for _, h := range req.Headers() {
		switch sipconv.CanonicalName(h.Name()) {
		case "From", "To", "Via", "Call-ID", "CSeq", "Timestamp":
			res.AppendHeader(sip.HeaderClone(h))
		}
	}
	return res
}

// attachHeaders orders a new message's headers as JAIN-SIP's
// SIPMessage.addHeader does: Vias and Record-Routes on top, a header JAIN-SIP
// keeps one of only once, anything else after the headers of its name.
func attachHeaders(add []sip.Header) []sip.Header {
	var vias, recordRoutes, rest []sip.Header
	last := map[string]int{}
	for _, h := range add {
		name := strings.ToLower(sipconv.CanonicalName(h.Name()))
		switch {
		case name == "via":
			vias = append(vias, h)
			continue
		case name == "record-route":
			recordRoutes = append(recordRoutes, h)
			continue
		}
		at, seen := last[name]
		switch {
		case seen && sipconv.IsSingleton(h.Name()):
			// ignored, as SIPMessage.attachHeader ignores a duplicate
		case seen:
			rest = append(rest[:at+1], append([]sip.Header{h}, rest[at+1:]...)...)
			for other, index := range last {
				if index > at {
					last[other] = index + 1
				}
			}
			last[name] = at + 1
		default:
			rest = append(rest, h)
			last[name] = len(rest) - 1
		}
	}
	return append(append(vias, recordRoutes...), rest...)
}

// joinListHeaders encodes the elements of a JAIN-SIP list header on one line,
// comma separated (semicolon for Privacy), as SIPHeaderList.encode does. Via,
// Route, Record-Route, Contact and the authentication headers keep a line each.
func joinListHeaders(headers []sip.Header) []sip.Header {
	out := make([]sip.Header, 0, len(headers))
	first := map[string]int{}
	values := map[string][]string{}
	for _, h := range headers {
		name := sipconv.CanonicalName(h.Name())
		if sipconv.ListSeparator(name) == 0 {
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
	for key, index := range first {
		name := sipconv.CanonicalName(out[index].Name())
		out[index] = sip.NewHeader(name, strings.Join(values[key], string(sipconv.ListSeparator(name))))
	}
	return out
}
