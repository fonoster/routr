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
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// param returns a parameter by name, ignoring case, and whether it is present.
func param(params sip.HeaderParams, name string) (string, bool) {
	for _, kv := range params {
		if strings.EqualFold(kv.K, name) {
			return kv.V, true
		}
	}
	return "", false
}

// knownURIParams are the URI parameters the DTO has a field for. maddr is not
// one: its field is never set, so it goes in Parameters with the rest.
var knownURIParams = []string{"lr", "transport", "method", "user", "ttl", "bnc"}

// URIToDTO is SipURIConverter.fromObject. Port and TTL are -1 when absent.
// Unlike the converter, the parameters without a field are kept, as
// received, in Parameters: a proxy relays a Record-Route with all of its URI
// parameters (RFC 3261 section 12.2.1.1).
func URIToDTO(uri *sip.Uri) *pb.SipURI {
	dto := &pb.SipURI{Port: -1, TtlParam: -1}
	if uri == nil {
		return dto
	}
	_, dto.LrParam = param(uri.UriParams, "lr")
	dto.Secure = strings.EqualFold(uri.Scheme, "sips")
	if uri.Port > 0 {
		dto.Port = int32(uri.Port)
	}
	dto.User = uri.User
	dto.Host = uri.Host
	if uri.Scheme != "" && !strings.EqualFold(uri.Scheme, "sip") &&
		!strings.EqualFold(uri.Scheme, "sips") {
		// JAIN-SIP casts to SipURI; a tel: or other URI is passed on as its
		// scheme-specific part in the user field so the request is not lost
		dto.User = uri.Raw()
	}
	dto.UserPassword = uri.Password
	if v, ok := param(uri.UriParams, "transport"); ok {
		dto.TransportParam = v
	}
	if v, ok := param(uri.UriParams, "method"); ok {
		dto.MethodParam = v
	}
	if v, ok := param(uri.UriParams, "user"); ok {
		dto.UserParam = v
	}
	if v, ok := param(uri.UriParams, "ttl"); ok {
		if ttl, err := strconv.Atoi(v); err == nil && ttl > 0 {
			dto.TtlParam = int32(ttl)
		}
	}
	if _, ok := param(uri.UriParams, "bnc"); ok {
		dto.BncParam = true
	}
	for _, kv := range uri.UriParams {
		if isKnownURIParam(kv.K) {
			continue
		}
		if dto.Parameters == nil {
			dto.Parameters = make(map[string]string, len(uri.UriParams))
		}
		dto.Parameters[kv.K] = kv.V
	}
	return dto
}

func isKnownURIParam(name string) bool {
	for _, k := range knownURIParams {
		if strings.EqualFold(k, name) {
			return true
		}
	}
	return false
}

// URIFromDTO is SipURIConverter.fromDTO: a sip (or sips) URI with the
// parameters in the order JAIN-SIP adds them (bnc, user, lr, transport,
// method, ttl), then the DTO's other parameters sorted by name. A port of -1
// means none.
func URIFromDTO(dto *pb.SipURI) sip.Uri {
	uri := sip.Uri{Scheme: "sip", UriParams: sip.NewParams()}
	if dto == nil {
		return uri
	}
	if dto.Secure {
		uri.Scheme = "sips"
	}
	uri.Host = dto.Host
	if dto.BncParam {
		uri.UriParams.Add("bnc", "")
	}
	uri.User = dto.User
	if dto.UserParam != "" {
		uri.UriParams.Add("user", dto.UserParam)
	}
	uri.Password = dto.UserPassword
	if dto.LrParam {
		uri.UriParams.Add("lr", "")
	}
	if dto.TransportParam != "" {
		// JAIN-SIP lower-cases the transport parameter
		uri.UriParams.Add("transport", strings.ToLower(dto.TransportParam))
	}
	if dto.MethodParam != "" {
		uri.UriParams.Add("method", dto.MethodParam)
	}
	if dto.TtlParam > 0 {
		uri.UriParams.Add("ttl", strconv.Itoa(int(dto.TtlParam)))
	}
	for _, kv := range sortedParams(dto.Parameters, "") {
		uri.UriParams.Add(kv.K, kv.V)
	}
	if dto.Port > 0 {
		uri.Port = int(dto.Port)
	}
	return uri
}

// RequestURIFromDTO is how GRPCSipListener rebuilds the Request-URI: a sip URI
// with the user, host and port only. Every parameter is dropped.
func RequestURIFromDTO(dto *pb.SipURI) sip.Uri {
	uri := sip.Uri{Scheme: "sip"}
	if dto == nil {
		return uri
	}
	uri.User = dto.User
	uri.Host = dto.Host
	if dto.Port > 0 {
		uri.Port = int(dto.Port)
	}
	return uri
}
