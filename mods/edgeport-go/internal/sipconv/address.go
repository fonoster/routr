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
	"sort"
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"

	pb "github.com/fonoster/routr/mods/edgeport-go/internal/pb/sipmessage"
)

// AddressToDTO is AddressConverter.fromObject.
func AddressToDTO(displayName string, uri *sip.Uri) *pb.Address {
	return &pb.Address{
		DisplayName: unquote(displayName),
		Wildcard:    uri != nil && uri.Wildcard,
		Uri:         URIToDTO(uri),
	}
}

func unquote(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}

// paramsToMap turns header parameters into the map a From, To, Route or
// Record-Route DTO carries (the tag included, as JAIN-SIP lists it).
func paramsToMap(params sip.HeaderParams) map[string]string {
	if len(params) == 0 {
		return nil
	}
	m := make(map[string]string, len(params))
	for _, kv := range params {
		m[kv.K] = kv.V
	}
	return m
}

// sortedParams returns the parameters of a DTO map in a stable order. Go maps
// have no order and the Java protobuf map's order is the wire order of the
// processor's reply, so the names are sorted.
func sortedParams(m map[string]string, skip string) sip.HeaderParams {
	keys := make([]string, 0, len(m))
	for k := range m {
		if !strings.EqualFold(k, skip) {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	params := sip.NewParams()
	for _, k := range keys {
		params.Add(k, m[k])
	}
	return params
}

// RouteToDTO parses one Route value (name-addr with header parameters).
func RouteToDTO(value string) (*pb.Route, error) {
	uri := sip.Uri{}
	params := sip.NewParams()
	display, err := sip.ParseAddressValue(value, &uri, &params)
	if err != nil {
		return nil, err
	}
	return &pb.Route{Address: AddressToDTO(display, &uri), Parameters: paramsToMap(params)}, nil
}

// RecordRouteToDTO parses one Record-Route value.
func RecordRouteToDTO(value string) (*pb.RecordRoute, error) {
	r, err := RouteToDTO(value)
	if err != nil {
		return nil, err
	}
	return &pb.RecordRoute{Address: r.Address, Parameters: r.Parameters}, nil
}

// EncodeAddress is JAIN-SIP's AddressImpl.encode for an address built by
// AddressFactory.createAddress(uri): always in angle brackets, the display name
// quoted.
func EncodeAddress(addr *pb.Address) string {
	var b strings.Builder
	if addr.GetWildcard() {
		return "*"
	}
	if addr.GetDisplayName() != "" {
		b.WriteString("\"")
		b.WriteString(addr.GetDisplayName())
		b.WriteString("\" ")
	}
	uri := URIFromDTO(addr.GetUri())
	b.WriteString("<")
	b.WriteString(uri.String())
	b.WriteString(">")
	return b.String()
}

// encodeParams writes ;k=v pairs (a flag parameter has no value).
func encodeParams(b *strings.Builder, params sip.HeaderParams) {
	for _, kv := range params {
		b.WriteString(";")
		b.WriteString(kv.K)
		if kv.V != "" {
			b.WriteString("=")
			b.WriteString(kv.V)
		}
	}
}

// EncodeRoute is RouteConverter.fromDTO (and RecordRouteConverter.fromDTO).
func EncodeRoute(addr *pb.Address, params map[string]string) string {
	var b strings.Builder
	b.WriteString(EncodeAddress(addr))
	encodeParams(&b, sortedParams(params, ""))
	return b.String()
}

// formatQ writes a float the way Java's Float.toString does for the usual
// q-values (1.0, 0.5, 0.25).
func formatQ(q float32) string {
	s := strconv.FormatFloat(float64(q), 'f', -1, 32)
	if !strings.Contains(s, ".") {
		s += ".0"
	}
	return s
}
