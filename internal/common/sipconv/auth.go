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

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// AuthParams is a parsed WWW-Authenticate, Proxy-Authenticate, Authorization or
// Proxy-Authorization value: the scheme and its parameters, unquoted, with the
// names lower-cased.
type AuthParams struct {
	Scheme string
	Params map[string]string
}

// ParseAuth parses `Digest realm="x", nonce="y", algorithm=MD5`.
func ParseAuth(value string) AuthParams {
	value = strings.TrimSpace(value)
	a := AuthParams{Params: map[string]string{}}
	idx := strings.IndexAny(value, " \t")
	if idx < 0 {
		a.Scheme = value
		return a
	}
	a.Scheme = value[:idx]
	for _, part := range SplitTopLevel(value[idx+1:], ',') {
		eq := strings.IndexByte(part, '=')
		if eq < 0 {
			a.Params[strings.ToLower(strings.TrimSpace(part))] = ""
			continue
		}
		name := strings.ToLower(strings.TrimSpace(part[:eq]))
		a.Params[name] = unquote(strings.TrimSpace(part[eq+1:]))
	}
	return a
}

// Get returns a parameter and whether it is present.
func (a AuthParams) Get(name string) (string, bool) {
	v, ok := a.Params[name]
	return v, ok
}

// WWWAuthenticateToDTO is WWWAuthenticateConverter.fromHeader.
func WWWAuthenticateToDTO(value string) *pb.WWWAuthenticate {
	a := ParseAuth(value)
	return &pb.WWWAuthenticate{
		Scheme:    a.Scheme,
		Realm:     a.Params["realm"],
		Domain:    a.Params["domain"],
		Nonce:     a.Params["nonce"],
		Algorithm: a.Params["algorithm"],
		Qop:       a.Params["qop"],
		Opaque:    a.Params["opaque"],
	}
}

// AuthorizationToDTO is AuthorizationConverter.fromHeader. The nonce count is
// -1 when absent (JAIN-SIP reads nc as hex).
func AuthorizationToDTO(value string) *pb.Authorization {
	a := ParseAuth(value)
	dto := &pb.Authorization{
		Scheme:     a.Scheme,
		Realm:      a.Params["realm"],
		CNonce:     a.Params["cnonce"],
		Nonce:      a.Params["nonce"],
		Algorithm:  a.Params["algorithm"],
		Qop:        a.Params["qop"],
		Opaque:     a.Params["opaque"],
		Response:   a.Params["response"],
		Username:   a.Params["username"],
		Uri:        a.Params["uri"],
		NonceCount: -1,
	}
	if nc, ok := a.Params["nc"]; ok {
		if n, err := strconv.ParseInt(nc, 16, 32); err == nil {
			dto.NonceCount = int32(n)
		}
	}
	return dto
}

type authParam struct {
	name   string
	value  string
	quoted bool
}

func encodeAuth(scheme string, params []authParam) string {
	var b strings.Builder
	b.WriteString(scheme)
	for i, p := range params {
		if i == 0 {
			b.WriteString(" ")
		} else {
			b.WriteString(",")
		}
		b.WriteString(p.name)
		b.WriteString("=")
		if p.quoted {
			b.WriteString("\"")
			b.WriteString(p.value)
			b.WriteString("\"")
		} else {
			b.WriteString(p.value)
		}
	}
	return b.String()
}

// EncodeWWWAuthenticate is WWWAuthenticateConverter.fromDTO: every parameter
// is set, even when empty, in the order the converter sets them.
func EncodeWWWAuthenticate(dto *pb.WWWAuthenticate) string {
	return encodeAuth(dto.GetScheme(), []authParam{
		{"realm", dto.GetRealm(), true},
		{"domain", dto.GetDomain(), true},
		{"nonce", dto.GetNonce(), true},
		{"algorithm", dto.GetAlgorithm(), false},
		{"qop", dto.GetQop(), true},
		{"opaque", dto.GetOpaque(), true},
	})
}

// EncodeAuthorization is AuthorizationConverter.fromDTO.
func EncodeAuthorization(dto *pb.Authorization) string {
	params := []authParam{
		{"realm", dto.GetRealm(), true},
		{"opaque", dto.GetOpaque(), true},
	}
	if dto.GetNonceCount() > -1 {
		params = append(params, authParam{"nc", fmt.Sprintf("%08x", dto.GetNonceCount()), false})
	}
	if dto.GetNonce() != "" {
		params = append(params, authParam{"nonce", dto.GetNonce(), true})
	}
	if dto.GetCNonce() != "" {
		params = append(params, authParam{"cnonce", dto.GetCNonce(), true})
	}
	if dto.GetAlgorithm() != "" {
		params = append(params, authParam{"algorithm", dto.GetAlgorithm(), false})
	}
	if dto.GetQop() != "" {
		params = append(params, authParam{"qop", dto.GetQop(), false})
	}
	if dto.GetResponse() != "" {
		params = append(params, authParam{"response", dto.GetResponse(), true})
	}
	if dto.GetUsername() != "" {
		params = append(params, authParam{"username", dto.GetUsername(), true})
	}
	if dto.GetUri() != "" {
		params = append(params, authParam{"uri", dto.GetUri(), true})
	}
	return encodeAuth(dto.GetScheme(), params)
}
