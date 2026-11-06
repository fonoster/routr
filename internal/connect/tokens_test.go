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
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"reflect"
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
	verify, err := publicKeyTokenVerifier(pemKey, func() time.Time { return now })
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
	if _, err := publicKeyTokenVerifier([]byte("not pem"), time.Now); err == nil {
		t.Error("a key that is not PEM is an error")
	}
}
