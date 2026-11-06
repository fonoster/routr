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

package auth

import (
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

func at(seconds int64) func() time.Time {
	return func() time.Time { return time.Unix(seconds, 0) }
}

func TestGenerateNonce(t *testing.T) {
	now := at(1761255805)
	nonce := GenerateNonce(now)
	if !regexp.MustCompile(`^[0-9a-f]+\.[0-9a-f]{32}$`).MatchString(nonce) {
		t.Fatalf("nonce %q is not <hex seconds>.<md5>", nonce)
	}
	issuedAt, err := strconv.ParseInt(strings.Split(nonce, ".")[0], 16, 64)
	if err != nil || issuedAt != 1761255805 {
		t.Fatalf("nonce %q does not carry its issue time", nonce)
	}
	if GenerateNonce(now) == nonce {
		t.Fatal("two nonces issued the same second are equal")
	}
	if GenerateNonce(nil) == "" {
		t.Fatal("a nil clock is time.Now")
	}
}

func TestIsNonceFresh(t *testing.T) {
	issued := int64(1761255805)
	fresh := GenerateNonce(at(issued))
	tests := []struct {
		name   string
		nonce  string
		maxAge int
		now    func() time.Time
		want   bool
	}{
		{"within the max age", fresh, 300, at(issued + 300), true},
		{"past the max age", fresh, 300, at(issued + 301), false},
		{"issued ahead of this clock, within the skew", fresh, 300, at(issued - 60), true},
		{"issued further ahead than the skew is never fresh", fresh, 300, at(issued - 61), false},
		{"issued far ahead is never fresh, however long the max age", fresh, 86400, at(issued - 3600), false},
		{"max age 0 accepts a nonce issued far ahead", fresh, 0, at(issued - 3600), true},
		{"max age 0 accepts any nonce", "971eb9f40135923aad3186c7adedd185", 0, at(issued), true},
		{"a nonce without a time is never fresh", "971eb9f40135923aad3186c7adedd185", 300, at(issued), false},
		{"an empty nonce is never fresh", "", 300, at(issued), false},
		{"a non-hex time is never fresh", "xyz.abc", 300, at(issued), false},
		{"a missing digest is never fresh", "68fa9b7d.", 300, at(issued), false},
		{"a nil clock is time.Now", GenerateNonce(nil), 300, nil, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsNonceFresh(tt.nonce, tt.maxAge, tt.now); got != tt.want {
				t.Fatalf("IsNonceFresh(%q, %d) = %v, want %v", tt.nonce, tt.maxAge, got, tt.want)
			}
		})
	}
}

func TestCalculateResponse(t *testing.T) {
	// The digests SIPp sent in the agent-to-agent corpus recording
	// (etc/corpus/seet-agent-1001_rr-1.1.2-agent-to-agent_agent-1002_20261023.jsonl
	// and the REGISTER before it), for the passwords in config/resources
	tests := []struct {
		name      string
		challenge Challenge
		creds     Credentials
		want      string
	}{
		{
			"qop auth, the REGISTER of agent 1002",
			Challenge{Realm: "sip.local", Nonce: "971eb9f40135923aad3186c7adedd185", NonceCount: 1, CNonce: "698e100", Qop: "auth", URI: "sip:10.111.221.2:5060", Method: "REGISTER"},
			Credentials{Username: "1002", Secret: "1234"},
			"3a07a2ef86a4d831d5f0d30ffaba637e",
		},
		{
			"qop auth, the INVITE of agent 1001",
			Challenge{Realm: "sip.local", Nonce: "06e779de49386c77ce99d5575b9b263e", NonceCount: 1, CNonce: "562119b6", Qop: "auth", URI: "sip:10.111.221.2:5060", Method: "INVITE"},
			Credentials{Username: "1001", Secret: "1234"},
			"e28cbf77d71edeb69d4d1f753286d813",
		},
		{
			"the method is upper-cased",
			Challenge{Realm: "sip.local", Nonce: "06e779de49386c77ce99d5575b9b263e", NonceCount: 1, CNonce: "562119b6", Qop: "auth", URI: "sip:10.111.221.2:5060", Method: "invite"},
			Credentials{Username: "1001", Secret: "1234"},
			"e28cbf77d71edeb69d4d1f753286d813",
		},
		{
			// The value RFC 2069 printed was wrong (RFC 2617 section 3.5 notes it)
			"no qop, the RFC 2069 section 2.4 example",
			Challenge{Realm: "testrealm@host.com", Nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093", URI: "/dir/index.html", Method: "GET"},
			Credentials{Username: "Mufasa", Secret: "CircleOfLife"},
			"1949323746fe6a43ef61f9606e7febea",
		},
		{
			"wrong secret",
			Challenge{Realm: "sip.local", Nonce: "06e779de49386c77ce99d5575b9b263e", NonceCount: 1, CNonce: "562119b6", Qop: "auth", URI: "sip:10.111.221.2:5060", Method: "INVITE"},
			Credentials{Username: "1001", Secret: "4321"},
			"ffd1a4e5e7fb9ff19b58ed3faac35c8f",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateResponse(tt.challenge, tt.creds)
			if tt.name == "wrong secret" {
				if got == "e28cbf77d71edeb69d4d1f753286d813" {
					t.Fatal("a wrong secret computed the right digest")
				}
				return
			}
			if got != tt.want {
				t.Fatalf("CalculateResponse() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestNonceCountHex(t *testing.T) {
	tests := []struct {
		count int32
		want  string
	}{
		{1, "00000001"},
		{13, "0000000d"},
		{0, "00000000"},
		{-1, "ffffffff"},
	}
	for _, tt := range tests {
		if got := nonceCountHex(tt.count); got != tt.want {
			t.Errorf("nonceCountHex(%d) = %s, want %s", tt.count, got, tt.want)
		}
	}
}
