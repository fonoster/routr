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

// Package auth is the SIP digest authentication Routr issues and verifies
// (RFC 3261 section 22, RFC 2617), ported from mods/common/src/auth.ts:
// the timestamped nonce, its freshness check and the response digest.
package auth

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// DefaultAlgorithm is the digest algorithm Routr challenges with.
const DefaultAlgorithm = "MD5"

// NonceMaxAgeSeconds is how long a nonce stays valid by default. A nonce
// carries the second it was issued, so a captured Authorization header stops
// working once this many seconds have passed (IsNonceFresh).
const NonceMaxAgeSeconds = 300

var hexDigits = regexp.MustCompile(`^[0-9a-f]+$`)

func md5hex(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])
}

// GenerateNonce issues a nonce of the form <hex seconds>.<md5>: the second it
// was issued, then a digest of the clock and a random value. A nil clock is
// time.Now.
func GenerateNonce(now func() time.Time) string {
	if now == nil {
		now = time.Now
	}
	t := now()
	issuedAt := strconv.FormatInt(t.Unix(), 16)
	var random [8]byte
	if _, err := rand.Read(random[:]); err != nil {
		// A clock-only nonce is still bound by the digest; never fail a challenge
		binary.BigEndian.PutUint64(random[:], uint64(t.UnixNano()))
	}
	return fmt.Sprintf("%s.%s", issuedAt, md5hex(fmt.Sprintf("%d%x", t.UnixMilli(), random)))
}

// IsNonceFresh tells whether a nonce was issued by GenerateNonce within the
// last maxAgeSeconds. A nonce in another format is never fresh, so a header
// captured before nonces carried their time can't be replayed either. A
// maxAgeSeconds of 0 accepts any nonce, which the corpus replay needs for its
// recorded requests. A nil clock is time.Now.
func IsNonceFresh(nonce string, maxAgeSeconds int, now func() time.Time) bool {
	if maxAgeSeconds == 0 {
		return true
	}
	if now == nil {
		now = time.Now
	}
	parts := strings.Split(nonce, ".")
	if len(parts) < 2 || parts[1] == "" || !hexDigits.MatchString(parts[0]) {
		return false
	}
	issuedAt, err := strconv.ParseInt(parts[0], 16, 64)
	if err != nil {
		return false
	}
	// A nonce dated ahead of this clock (another instance's) is only as fresh
	// as it gets: the digest binds it, so no one gains by choosing one
	age := now().Unix() - issuedAt
	return age <= int64(maxAgeSeconds)
}

// Credentials are what a resource authenticates with.
type Credentials struct {
	Username string
	Secret   string
}

// Challenge is the answer an endpoint gave to a WWW-Authenticate challenge:
// the Authorization header plus the request's method.
type Challenge struct {
	Realm      string
	Nonce      string
	NonceCount int32
	CNonce     string
	Qop        string
	URI        string
	Method     string
}

// CalculateResponse computes the digest an endpoint with the given
// credentials would send for the challenge (RFC 2617 section 3.2.2), with
// the qop=auth form when the endpoint chose it.
func CalculateResponse(c Challenge, credentials Credentials) string {
	a1 := fmt.Sprintf("%s:%s:%s", credentials.Username, c.Realm, credentials.Secret)
	a2 := fmt.Sprintf("%s:%s", strings.ToUpper(c.Method), c.URI)
	ha1 := md5hex(a1)
	ha2 := md5hex(a2)
	if c.Qop == "auth" {
		return md5hex(fmt.Sprintf("%s:%s:%s:%s:%s:%s", ha1, c.Nonce, nonceCountHex(c.NonceCount), c.CNonce, c.Qop, ha2))
	}
	return md5hex(fmt.Sprintf("%s:%s:%s", ha1, c.Nonce, ha2))
}

// nonceCountHex is the eight-digit hexadecimal nc value (RFC 2617 section
// 3.2.2): the last eight digits of the count plus 16^8, as the Node code
// spells it.
func nonceCountHex(count int32) string {
	s := strconv.FormatInt(int64(count)+1<<32, 16)
	return s[len(s)-8:]
}
