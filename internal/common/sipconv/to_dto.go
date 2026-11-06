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
package sipconv

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// ViaToDTO is ViaConverter.fromHeader: port, rport and ttl are -1 when absent.
func ViaToDTO(v *sip.ViaHeader) *pb.Via {
	dto := &pb.Via{
		Host:      v.Host,
		Port:      -1,
		Transport: v.Transport,
		RPort:     -1,
		Ttl:       -1,
	}
	if v.Port > 0 {
		dto.Port = int32(v.Port)
	}
	if branch, ok := param(v.Params, "branch"); ok {
		dto.Branch = branch
	}
	if received, ok := param(v.Params, "received"); ok {
		dto.Received = received
	}
	if maddr, ok := param(v.Params, "maddr"); ok {
		dto.MAddr = maddr
	}
	if ttl, ok := param(v.Params, "ttl"); ok {
		if n, err := strconv.Atoi(ttl); err == nil {
			dto.Ttl = int32(n)
		}
	}
	if rport, ok := param(v.Params, "rport"); ok {
		dto.RPortFlag = true
		if n, err := strconv.Atoi(rport); err == nil {
			dto.RPort = int32(n)
		}
	}
	return dto
}

func fromToDTO(display string, uri *sip.Uri, params sip.HeaderParams) (*pb.Address, string, map[string]string) {
	tag, _ := param(params, "tag")
	return AddressToDTO(display, uri), tag, paramsToMap(params)
}

// ContactToDTO is ContactConverter.fromHeader: expires and q are -1 when
// absent, and the other parameters are not carried.
func ContactToDTO(c *sip.ContactHeader) *pb.Contact {
	dto := &pb.Contact{
		Address: AddressToDTO(c.DisplayName, &c.Address),
		Expires: -1,
		QValue:  -1,
	}
	if v, ok := param(c.Params, "expires"); ok {
		if n, err := strconv.Atoi(v); err == nil {
			dto.Expires = int32(n)
		}
	}
	if v, ok := param(c.Params, "q"); ok {
		if q, err := strconv.ParseFloat(v, 32); err == nil {
			dto.QValue = float32(q)
		}
	}
	return dto
}

type headerGroup struct {
	name    string
	headers []sip.Header
}

// groupHeaders groups a message's headers by name in the order each name first
// appears, as JAIN-SIP's SIPMessage.getHeaderNames lists them.
func groupHeaders(headers []sip.Header) []*headerGroup {
	var groups []*headerGroup
	index := map[string]*headerGroup{}
	for _, h := range headers {
		name := CanonicalName(h.Name())
		key := strings.ToLower(name)
		g, ok := index[key]
		if !ok {
			g = &headerGroup{name: name}
			index[key] = g
			groups = append(groups, g)
		}
		g.headers = append(g.headers, h)
	}
	return groups
}

// ExtensionValues splits a header value the way JAIN-SIP splits a list header
// into its elements; any other header is a single value.
func ExtensionValues(name, value string) []string {
	switch CanonicalName(name) {
	case "Proxy-Authenticate", "Proxy-Authorization":
		// JAIN-SIP re-encodes the parameters comma separated, without spaces
		scheme, rest, _ := strings.Cut(strings.TrimSpace(value), " ")
		return []string{scheme + " " + strings.Join(SplitTopLevel(rest, ','), ",")}
	}
	if sep := ListSeparator(name); sep != 0 {
		if parts := SplitTopLevel(value, sep); len(parts) > 0 {
			return parts
		}
	}
	return []string{strings.TrimSpace(value)}
}

// MessageToDTO is MessageConverter.convertToMessageDTO.
func MessageToDTO(msg sip.Message) (*pb.SIPMessage, error) {
	dto := &pb.SIPMessage{}
	var headers []sip.Header

	switch m := msg.(type) {
	case *sip.Request:
		dto.MessageType = &pb.SIPMessage_RequestUri{RequestUri: URIToDTO(&m.Recipient)}
		headers = m.Headers()
	case *sip.Response:
		t, _ := TypeOf(m.StatusCode)
		dto.MessageType = &pb.SIPMessage_ResponseType{ResponseType: t}
		dto.ReasonPhrase = m.Reason
		headers = m.Headers()
	default:
		return nil, fmt.Errorf("unsupported message type %T", msg)
	}

	if body := msg.Body(); len(body) > 0 {
		dto.Body = string(body)
	}
	// JAIN-SIP gives every message a Content-Length
	dto.ContentLength = &pb.ContentLength{ContentLength: int32(len(msg.Body()))}

	for _, g := range groupHeaders(headers) {
		first := g.headers[0]
		switch g.name {
		case "Via":
			for _, h := range g.headers {
				if v, ok := h.(*sip.ViaHeader); ok {
					dto.Via = append(dto.Via, ViaToDTO(v))
				}
			}
		case "Route":
			for _, h := range g.headers {
				for _, part := range SplitTopLevel(h.Value(), ',') {
					r, err := RouteToDTO(part)
					if err != nil {
						return nil, fmt.Errorf("invalid Route %q: %w", part, err)
					}
					dto.Route = append(dto.Route, r)
				}
			}
		case "Record-Route":
			for _, h := range g.headers {
				for _, part := range SplitTopLevel(h.Value(), ',') {
					r, err := RecordRouteToDTO(part)
					if err != nil {
						return nil, fmt.Errorf("invalid Record-Route %q: %w", part, err)
					}
					dto.RecordRoute = append(dto.RecordRoute, r)
				}
			}
		case "From":
			if f, ok := first.(*sip.FromHeader); ok {
				addr, tag, params := fromToDTO(f.DisplayName, &f.Address, f.Params)
				dto.From = &pb.From{Address: addr, Tag: tag, Parameters: params}
			}
		case "To":
			if t, ok := first.(*sip.ToHeader); ok {
				addr, tag, params := fromToDTO(t.DisplayName, &t.Address, t.Params)
				dto.To = &pb.To{Address: addr, Tag: tag, Parameters: params}
			}
		case "Contact":
			if c, ok := first.(*sip.ContactHeader); ok {
				dto.Contact = ContactToDTO(c)
			}
		case "Call-ID":
			dto.CallId = &pb.CallID{CallId: first.Value()}
		case "Content-Length":
			if n, err := strconv.Atoi(strings.TrimSpace(first.Value())); err == nil {
				dto.ContentLength = &pb.ContentLength{ContentLength: int32(n)}
			}
		case "Expires":
			if n, err := strconv.Atoi(strings.TrimSpace(first.Value())); err == nil {
				dto.Expires = &pb.Expires{Expires: int32(n)}
			}
		case "Max-Forwards":
			if n, err := strconv.Atoi(strings.TrimSpace(first.Value())); err == nil {
				dto.MaxForwards = &pb.MaxForwards{MaxForwards: int32(n)}
			}
		case "WWW-Authenticate":
			dto.WwwAuthenticate = WWWAuthenticateToDTO(first.Value())
		case "Authorization":
			dto.Authorization = AuthorizationToDTO(first.Value())
		default:
			// Each header keeps its own name (an unknown header keeps its case)
			for _, h := range g.headers {
				name := CanonicalName(h.Name())
				for _, v := range ExtensionValues(name, h.Value()) {
					dto.Extensions = append(dto.Extensions, &pb.Extension{Name: name, Value: v})
				}
			}
		}
	}
	return dto, nil
}
