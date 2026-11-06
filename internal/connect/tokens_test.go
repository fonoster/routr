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
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"log/slog"
	"reflect"
	"strings"
	"testing"
	"time"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

func TestClaimsFromPayload(t *testing.T) {
	claims, err := claimsFromPayload(map[string]string{
		"ref": "agent-01", "aor": "sip:1001@sip.local", "aorLink": "sip:voice@sip.local", "domain": "sip.local", "domainRef": "domain-01",
		"allowedMethods": `["INVITE","REGISTER"]`, "maxContacts": "2",
	})
	if err != nil {
		t.Fatalf("claimsFromPayload() error = %v", err)
	}
	if claims.Ref != "agent-01" || claims.AOR != "sip:1001@sip.local" || claims.AORLink != "sip:voice@sip.local" || claims.Domain != "sip.local" || claims.DomainRef != "domain-01" {
		t.Errorf("claims = %+v", claims)
	}
	if !claims.allows(ppb.Method_INVITE) || !claims.allows(ppb.Method_REGISTER) || claims.allows(ppb.Method_BYE) {
		t.Errorf("allowedMethods = %v", claims.AllowedMethods)
	}
	if claims.maxContacts() != 2 {
		t.Errorf("maxContacts = %d", claims.maxContacts())
	}

	claims, err = claimsFromPayload(map[string]string{"allowedMethods": "INVITE, REGISTER"})
	if err != nil || !reflect.DeepEqual(claims.AllowedMethods, []string{"INVITE", "REGISTER"}) || claims.maxContacts() != -1 {
		t.Errorf("a comma-separated list = %+v, %v", claims, err)
	}
	if _, err := claimsFromPayload(map[string]string{"allowedMethods": "[not json"}); err == nil {
		t.Error("bad allowedMethods is an error")
	}
	if _, err := claimsFromPayload(map[string]string{"maxContacts": "many"}); err == nil {
		t.Error("bad maxContacts is an error")
	}
}

func TestGRPCTokenVerifier(t *testing.T) {
	fake := &fakeVerifier{payload: map[string]string{"ref": "agent-01"}}
	claims, err := grpcTokenVerifier(fake)(context.Background(), "token")
	if err != nil || claims.Ref != "agent-01" {
		t.Errorf("verify = %+v, %v", claims, err)
	}
	fake.err = errors.New("invalid")
	if _, err := grpcTokenVerifier(fake)(context.Background(), "token"); err == nil {
		t.Error("a refused token is an error")
	}
}

func signJWT(t *testing.T, key *rsa.PrivateKey, alg string, claims map[string]any) string {
	t.Helper()
	encode := func(v any) string {
		data, err := json.Marshal(v)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		return base64.RawURLEncoding.EncodeToString(data)
	}
	signed := encode(map[string]string{"alg": alg, "typ": "JWT"}) + "." + encode(claims)
	digest := sha256.Sum256([]byte(signed))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func TestPublicKeyTokenVerifier(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}
	pemKey := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})
	now := time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)
	verify, err := publicKeyTokenVerifier(pemKey, func() time.Time { return now }, tokenExpectations{}, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("publicKeyTokenVerifier() error = %v", err)
	}
	ctx := context.Background()

	claims, err := verify(ctx, signJWT(t, key, "RS256", map[string]any{
		"ref": "agent-01", "aorLink": "sip:voice@sip.local", "allowedMethods": []string{"INVITE"}, "maxContacts": 1, "exp": now.Add(time.Hour).Unix(),
	}))
	if err != nil {
		t.Fatalf("a good token: %v", err)
	}
	if claims.Ref != "agent-01" || !claims.allows(ppb.Method_INVITE) || claims.maxContacts() != 1 {
		t.Errorf("claims = %+v", claims)
	}

	other, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	refused := map[string]string{
		"another key":     signJWT(t, other, "RS256", map[string]any{"ref": "x"}),
		"another alg":     signJWT(t, key, "none", map[string]any{"ref": "x"}),
		"expired":         signJWT(t, key, "RS256", map[string]any{"exp": now.Add(-time.Second).Unix()}),
		"not yet active":  signJWT(t, key, "RS256", map[string]any{"nbf": now.Add(time.Hour).Unix()}),
		"not a jwt":       "token",
		"bad base64 head": "!.e30.e30",
	}
	for name, token := range refused {
		if _, err := verify(ctx, token); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
	if _, err := publicKeyTokenVerifier([]byte("not pem"), time.Now, tokenExpectations{}, slog.New(slog.DiscardHandler)); err == nil {
		t.Error("a key that is not PEM is an error")
	}
}

func TestVerifyJWTIssuerAudienceAndExpiry(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	now := time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)
	want := tokenExpectations{issuer: "https://issuer", audience: "routr"}
	for name, tc := range map[string]struct {
		want   tokenExpectations
		claims map[string]any
		pass   bool
	}{
		"nothing expected":      {tokenExpectations{}, map[string]any{"ref": "x"}, true},
		"both good":             {want, map[string]any{"iss": "https://issuer", "aud": "routr"}, true},
		"aud in a list":         {want, map[string]any{"iss": "https://issuer", "aud": []string{"other", "routr"}}, true},
		"another issuer":        {want, map[string]any{"iss": "https://other", "aud": "routr"}, false},
		"no issuer":             {want, map[string]any{"aud": "routr"}, false},
		"another audience":      {want, map[string]any{"iss": "https://issuer", "aud": "other"}, false},
		"not in the aud list":   {want, map[string]any{"iss": "https://issuer", "aud": []string{"other"}}, false},
		"no audience":           {want, map[string]any{"iss": "https://issuer"}, false},
		"an audience of a kind": {want, map[string]any{"iss": "https://issuer", "aud": 1}, false},
	} {
		_, err := verifyJWT(&key.PublicKey, signJWT(t, key, "RS256", tc.claims), now, tc.want)
		if (err == nil) != tc.pass {
			t.Errorf("%s: err = %v, want pass %v", name, err, tc.pass)
		}
	}

	// A token without exp stays accepted, with a Warn
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}
	var logged bytes.Buffer
	verify, err := publicKeyTokenVerifier(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}), func() time.Time { return now }, tokenExpectations{}, slog.New(slog.NewTextHandler(&logged, nil)))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := verify(context.Background(), signJWT(t, key, "RS256", map[string]any{"ref": "x", "exp": now.Add(time.Hour).Unix()})); err != nil || logged.Len() != 0 {
		t.Errorf("a token with exp: %v, logged %q", err, logged.String())
	}
	if _, err := verify(context.Background(), signJWT(t, key, "RS256", map[string]any{"ref": "x"})); err != nil {
		t.Errorf("a token without exp is refused: %v", err)
	}
	if !strings.Contains(logged.String(), "level=WARN") {
		t.Errorf("no Warn for a token without exp: %q", logged.String())
	}
}
