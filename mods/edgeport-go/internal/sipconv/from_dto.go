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

	pb "github.com/fonoster/routr/mods/edgeport-go/internal/pb/sipmessage"
)

// ViaFromDTO is ViaConverter.fromDTO. Parameters go in the order the converter
// sets them: branch, received, maddr, ttl, rport.
func ViaFromDTO(dto *pb.Via) *sip.ViaHeader {
	v := &sip.ViaHeader{
		ProtocolName:    "SIP",
		ProtocolVersion: "2.0",
		Transport:       strings.ToUpper(dto.GetTransport()),
		Host:            dto.GetHost(),
		Params:          sip.NewParams(),
	}
	if dto.GetPort() > 0 {
		v.Port = int(dto.GetPort())
	}
	if dto.GetBranch() != "" {
		v.Params.Add("branch", dto.GetBranch())
	}
	if dto.GetReceived() != "" {
		v.Params.Add("received", dto.GetReceived())
	}
	if dto.GetMAddr() != "" {
		v.Params.Add("maddr", dto.GetMAddr())
	}
	if dto.GetTtl() > 0 {
		v.Params.Add("ttl", strconv.Itoa(int(dto.GetTtl())))
	}
	if dto.GetRPortFlag() {
		v.Params.Add("rport", "")
	}
	if dto.GetRPort() > 0 {
		v.Params.Add("rport", strconv.Itoa(int(dto.GetRPort())))
	}
	return v
}

// FromFromDTO is FromConverter.fromDTO: the tag first, then the parameters.
func FromFromDTO(dto *pb.From) *sip.FromHeader {
	return &sip.FromHeader{
		DisplayName: dto.GetAddress().GetDisplayName(),
		Address:     URIFromDTO(dto.GetAddress().GetUri()),
		Params:      tagAndParams(dto.GetTag(), dto.GetParameters()),
	}
}

// ToFromDTO is ToConverter.fromDTO.
func ToFromDTO(dto *pb.To) *sip.ToHeader {
	return &sip.ToHeader{
		DisplayName: dto.GetAddress().GetDisplayName(),
		Address:     URIFromDTO(dto.GetAddress().GetUri()),
		Params:      tagAndParams(dto.GetTag(), dto.GetParameters()),
	}
}

func tagAndParams(tag string, params map[string]string) sip.HeaderParams {
	out := sip.NewParams()
	if tag == "" {
		tag = params["tag"]
	}
	if tag != "" {
		out.Add("tag", tag)
	}
	for _, kv := range sortedParams(params, "tag") {
		out.Add(kv.K, kv.V)
	}
	return out
}

// ContactFromDTO is ContactConverter.fromDTO: expires and q are added when
// they are not -1.
func ContactFromDTO(dto *pb.Contact) *sip.ContactHeader {
	c := &sip.ContactHeader{
		DisplayName: dto.GetAddress().GetDisplayName(),
		Address:     URIFromDTO(dto.GetAddress().GetUri()),
		Params:      sip.NewParams(),
	}
	if dto.GetAddress().GetWildcard() {
		c.Address = sip.Uri{Wildcard: true}
	}
	if dto.GetExpires() > -1 {
		c.Params.Add("expires", strconv.Itoa(int(dto.GetExpires())))
	}
	if dto.GetQValue() > -1 {
		c.Params.Add("q", formatQ(dto.GetQValue()))
	}
	return c
}

// ExtensionFromDTO is ExtensionConverter.fromDTO: HeaderFactory.createHeader.
// CSeq, Content-Type and Max-Forwards come back typed, the rest as is.
func ExtensionFromDTO(name, value string) (sip.Header, error) {
	name = CanonicalName(name)
	value = strings.TrimSpace(value)
	switch name {
	case "CSeq":
		parts := strings.Fields(value)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid CSeq %q", value)
		}
		n, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			return nil, fmt.Errorf("invalid CSeq %q", value)
		}
		return &sip.CSeqHeader{SeqNo: uint32(n), MethodName: sip.RequestMethod(parts[1])}, nil
	case "Content-Type":
		ct := sip.ContentTypeHeader(value)
		return &ct, nil
	case "Call-ID":
		id := sip.CallIDHeader(value)
		return &id, nil
	case "Max-Forwards":
		n, err := strconv.ParseUint(value, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("invalid Max-Forwards %q", value)
		}
		mf := sip.MaxForwardsHeader(n)
		return &mf, nil
	}
	return sip.NewHeader(name, value), nil
}

// HeadersFromDTO is MessageConverter.createHeadersFromMessage: the headers of a
// processor's reply in the order the Java EdgePort adds them (Via, Route,
// Record-Route, Max-Forwards, Call-ID, WWW-Authenticate, Authorization, From,
// To, Contact, Expires, then the extensions). An extension that does not parse
// is skipped, as Java skips it.
func HeadersFromDTO(dto *pb.SIPMessage) []sip.Header {
	var headers []sip.Header
	for _, v := range dto.GetVia() {
		headers = append(headers, ViaFromDTO(v))
	}
	for _, r := range dto.GetRoute() {
		headers = append(headers, sip.NewHeader("Route", EncodeRoute(r.GetAddress(), r.GetParameters())))
	}
	for _, r := range dto.GetRecordRoute() {
		headers = append(headers, sip.NewHeader("Record-Route", EncodeRoute(r.GetAddress(), r.GetParameters())))
	}
	if mf := dto.GetMaxForwards(); mf != nil {
		v := sip.MaxForwardsHeader(uint32(max(mf.GetMaxForwards(), 0)))
		headers = append(headers, &v)
	}
	if id := dto.GetCallId(); id != nil {
		v := sip.CallIDHeader(id.GetCallId())
		headers = append(headers, &v)
	}
	if w := dto.GetWwwAuthenticate(); w != nil {
		headers = append(headers, sip.NewHeader("WWW-Authenticate", EncodeWWWAuthenticate(w)))
	}
	if a := dto.GetAuthorization(); a != nil {
		headers = append(headers, sip.NewHeader("Authorization", EncodeAuthorization(a)))
	}
	if f := dto.GetFrom(); f != nil {
		headers = append(headers, FromFromDTO(f))
	}
	if t := dto.GetTo(); t != nil {
		headers = append(headers, ToFromDTO(t))
	}
	if c := dto.GetContact(); c != nil {
		headers = append(headers, ContactFromDTO(c))
	}
	if e := dto.GetExpires(); e != nil {
		headers = append(headers, sip.NewHeader("Expires", strconv.Itoa(int(e.GetExpires()))))
	}
	for _, ext := range dto.GetExtensions() {
		h, err := ExtensionFromDTO(ext.GetName(), ext.GetValue())
		if err != nil {
			continue
		}
		headers = append(headers, h)
	}
	return headers
}
