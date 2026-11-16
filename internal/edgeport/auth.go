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
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/emiago/sipgo/sip"

	"github.com/fonoster/routr/internal/common/sipconv"
)

// gatewayAuthHeader carries base64(username:password) from the processor. It
// is used to answer a challenge on the caller's behalf and never sent.
const gatewayAuthHeader = "x-gateway-auth"

// Credentials is io.routr.utils.AccountManagerImpl.
type Credentials struct {
	Username string
	Password string
	Host     string
}

// CredentialsFromHeaders is AuthenticationHandler.createAccountManager: the
// x-gateway-auth header of the processor's reply, if any.
func CredentialsFromHeaders(headers []sip.Header, host string) (*Credentials, error) {
	for _, h := range headers {
		if !strings.EqualFold(h.Name(), gatewayAuthHeader) {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(h.Value()))
		if err != nil {
			return nil, errors.New("invalid 'x-gateway-auth' header value; should be base64('username:password')")
		}
		parts := strings.Split(string(decoded), ":")
		if len(parts) != 2 {
			return nil, errors.New("invalid 'x-gateway-auth' header value; should be base64('username:password')")
		}
		return &Credentials{Username: parts[0], Password: parts[1], Host: host}, nil
	}
	return nil, nil
}

// isSupportedAlgorithm: JAIN-SIP (and this EdgePort) answer MD5 only. RFC 2617
// defaults to MD5 when the algorithm is absent.
func isSupportedAlgorithm(algorithm string) bool {
	return strings.TrimSpace(algorithm) == "" ||
		strings.EqualFold(algorithm, "MD5") ||
		strings.EqualFold(algorithm, "MD5-sess")
}

// SupportedChallenges is AuthenticationHandler.withSupportedChallenges: the
// challenges this EdgePort can answer, or all of them when it can answer every
// one or none (so the server's own error stays visible).
func SupportedChallenges(challenges []string) []string {
	var supported []string
	for _, c := range challenges {
		alg, _ := sipconv.ParseAuth(c).Get("algorithm")
		if isSupportedAlgorithm(alg) {
			supported = append(supported, c)
		}
	}
	if len(supported) == 0 || len(supported) == len(challenges) {
		return challenges
	}
	return supported
}

func md5hex(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])
}

func newCNonce() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// DigestAuthorization answers one challenge the way JAIN-SIP's
// AuthenticationHelperImpl.getAuthorization does: username, realm, nonce, uri,
// response, then algorithm and opaque when the challenge has them, then qop,
// cnonce and nc when it asks for qop.
func DigestAuthorization(challenge string, creds *Credentials, method, uri string, body []byte,
	cnonce string) (string, error) {
	c := sipconv.ParseAuth(challenge)
	if !strings.EqualFold(c.Scheme, "Digest") {
		return "", fmt.Errorf("unsupported scheme %q", c.Scheme)
	}
	realm := c.Params["realm"]
	nonce := c.Params["nonce"]
	algorithm, hasAlgorithm := c.Get("algorithm")
	opaque, hasOpaque := c.Get("opaque")

	qop := ""
	if offered, ok := c.Get("qop"); ok {
		for _, q := range strings.Split(offered, ",") {
			q = strings.TrimSpace(q)
			if strings.EqualFold(q, "auth") {
				qop = "auth"
				break
			}
			if strings.EqualFold(q, "auth-int") && qop == "" {
				qop = "auth-int"
			}
		}
	}

	const nc = "00000001"
	if qop != "" && cnonce == "" {
		cnonce = newCNonce()
	}

	ha1 := md5hex(creds.Username + ":" + realm + ":" + creds.Password)
	if strings.EqualFold(algorithm, "MD5-sess") {
		ha1 = md5hex(ha1 + ":" + nonce + ":" + cnonce)
	}
	ha2 := md5hex(method + ":" + uri)
	if qop == "auth-int" {
		ha2 = md5hex(method + ":" + uri + ":" + md5hex(string(body)))
	}
	var response string
	if qop != "" {
		response = md5hex(ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + ha2)
	} else {
		response = md5hex(ha1 + ":" + nonce + ":" + ha2)
	}

	var b strings.Builder
	b.WriteString(c.Scheme)
	fmt.Fprintf(&b, " username=\"%s\",realm=\"%s\",nonce=\"%s\",uri=\"%s\",response=\"%s\"",
		creds.Username, realm, nonce, uri, response)
	if hasAlgorithm {
		fmt.Fprintf(&b, ",algorithm=%s", algorithm)
	}
	if hasOpaque {
		fmt.Fprintf(&b, ",opaque=\"%s\"", opaque)
	}
	if qop != "" {
		fmt.Fprintf(&b, ",qop=%s,cnonce=\"%s\",nc=%s", qop, cnonce, nc)
	}
	return b.String(), nil
}

// isAuthChallenge is AuthenticationHandler.authenticationRequired.
func isAuthChallenge(res *sip.Response) bool {
	return res.StatusCode == sip.StatusUnauthorized || res.StatusCode == sip.StatusProxyAuthRequired
}
