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

package connect

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/verifier"
)

// tokenClaims are the claims of a Connect Token (CONNECT.md, X-Connect-Token).
type tokenClaims struct {
	Ref            string   `json:"ref"`
	AOR            string   `json:"aor"`
	AORLink        string   `json:"aorLink"`
	Domain         string   `json:"domain"`
	DomainRef      string   `json:"domainRef"`
	AllowedMethods []string `json:"allowedMethods"`
	MaxContacts    *int32   `json:"maxContacts"`
}

// allows tells whether the token permits the method.
func (t *tokenClaims) allows(method ppb.Method) bool {
	return contains(t.AllowedMethods, method.String())
}

// maxContacts is the claim, -1 (no limit) when the token has none.
func (t *tokenClaims) maxContacts() int32 {
	if t.MaxContacts == nil {
		return -1
	}
	return *t.MaxContacts
}

// tokenVerifier verifies a Connect Token and returns its claims.
type tokenVerifier func(ctx context.Context, token string) (*tokenClaims, error)

// grpcTokenVerifier verifies tokens through the Verifier service, whose answer
// carries the claims as a map of strings.
func grpcTokenVerifier(client verifier.VerifierClient) tokenVerifier {
	return func(ctx context.Context, token string) (*tokenClaims, error) {
		res, err := client.Verify(ctx, &verifier.VerifyRequest{Token: token})
		if err != nil {
			return nil, err
		}
		return claimsFromPayload(res.GetPayload())
	}
}

// claimsFromPayload reads the claims from the Verifier's string map. A list or
// a number arrives as its JSON; allowedMethods also reads as a comma-separated
// list.
func claimsFromPayload(payload map[string]string) (*tokenClaims, error) {
	claims := &tokenClaims{
		Ref:       payload["ref"],
		AOR:       payload["aor"],
		AORLink:   payload["aorLink"],
		Domain:    payload["domain"],
		DomainRef: payload["domainRef"],
	}
	methods := strings.TrimSpace(payload["allowedMethods"])
	if strings.HasPrefix(methods, "[") {
		if err := json.Unmarshal([]byte(methods), &claims.AllowedMethods); err != nil {
			return nil, fmt.Errorf("allowedMethods: %w", err)
		}
	} else if methods != "" {
		for _, m := range strings.Split(methods, ",") {
			claims.AllowedMethods = append(claims.AllowedMethods, strings.TrimSpace(m))
		}
	}
	if v, ok := payload["maxContacts"]; ok && v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("maxContacts: %w", err)
		}
		maxContacts := int32(n)
		claims.MaxContacts = &maxContacts
	}
	return claims, nil
}

// parseRSAPublicKey reads an RSA public key from PEM: a PKIX key, a PKCS#1 key
// or a certificate.
func parseRSAPublicKey(data []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("not PEM")
	}
	var key any
	if parsed, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		key = parsed
	} else if parsed, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		key = parsed
	} else if cert, err := x509.ParseCertificate(block.Bytes); err == nil {
		key = cert.PublicKey
	} else {
		return nil, errors.New("not a public key or certificate")
	}
	rsaKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not an RSA key")
	}
	return rsaKey, nil
}

// publicKeyTokenVerifier verifies tokens in process, as RS256 JWTs (Routr 2's
// CONNECT_VERIFIER_PUBLIC_KEY_PATH with its default options).
func publicKeyTokenVerifier(pemKey []byte, now func() time.Time) (tokenVerifier, error) {
	key, err := parseRSAPublicKey(pemKey)
	if err != nil {
		return nil, err
	}
	return func(_ context.Context, token string) (*tokenClaims, error) {
		return verifyJWT(key, token, now())
	}, nil
}

// verifyJWT checks an RS256 JWT's signature and its exp and nbf, when it has
// them, and returns its claims. Only RS256 is accepted, so a token can't choose
// its own algorithm.
func verifyJWT(key *rsa.PublicKey, token string, now time.Time) (*tokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("jwt malformed")
	}
	rawHeader, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("jwt header: %w", err)
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(rawHeader, &header); err != nil {
		return nil, fmt.Errorf("jwt header: %w", err)
	}
	if header.Alg != "RS256" {
		return nil, fmt.Errorf("jwt algorithm %q not allowed", header.Alg)
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("jwt signature: %w", err)
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature); err != nil {
		return nil, errors.New("invalid signature")
	}
	rawClaims, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("jwt payload: %w", err)
	}
	var times struct {
		Exp *float64 `json:"exp"`
		Nbf *float64 `json:"nbf"`
	}
	if err := json.Unmarshal(rawClaims, &times); err != nil {
		return nil, fmt.Errorf("jwt payload: %w", err)
	}
	seconds := float64(now.Unix())
	if times.Exp != nil && seconds >= *times.Exp {
		return nil, errors.New("jwt expired")
	}
	if times.Nbf != nil && seconds < *times.Nbf {
		return nil, errors.New("jwt not active")
	}
	claims := &tokenClaims{}
	if err := json.Unmarshal(rawClaims, claims); err != nil {
		return nil, fmt.Errorf("jwt payload: %w", err)
	}
	return claims, nil
}
