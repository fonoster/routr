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
package cloak

import (
	"bytes"
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

// The vectors were produced with @47ng/cloak 1.2.0 (the version
// prisma-field-encryption 1.6.0 pins) through encryptStringSync.
const testKey = "k1.aesgcm256.DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZnCY="

const testFingerprint = "fcefa160"

var vectors = []struct {
	plain  string
	stored string
}{
	{"1234", "v1.aesgcm256.fcefa160.s0lCWtLiZE7EokhT.Dc8uP9-2kqivaKsOxJKpxnGuzNg="},
	{"", "v1.aesgcm256.fcefa160.mM7vHPuI_PsZ7Ehr.c1ArtSb6f1vRtAi5KcDJ-w=="},
	{"p@ss wörd ñ 🔐", "v1.aesgcm256.fcefa160.kVX6JWa5AAQC1Mpk.0XckqvmtEPUjgRs3m4eGprehWbmianQJiiQwMsMAAQndaQ=="},
	{strings.Repeat("a", 100), "v1.aesgcm256.fcefa160.ZpF5uFVNL97JiSaX.xENCKwt0BIFDbWfuwVYAOVD1XV_apgr1tGDRVDJREJ-9AxGNVafiSq9sn9gPyhh0zoWwWeFZbNnR6eIGWMzFC3k03JfJs7yrF07xgKvAy6XwDoP0X1ujlC4CZfyY_z9ZLJTVPwypZacr3kwu5ciMOPGooS0="},
}

func TestNew(t *testing.T) {
	c, err := New(testKey)
	if err != nil {
		t.Fatal(err)
	}
	if c.Fingerprint() != testFingerprint {
		t.Errorf("fingerprint %s, want %s", c.Fingerprint(), testFingerprint)
	}
	for name, key := range map[string]string{
		"empty":           "",
		"no prefix":       "DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZnCY=",
		"wrong version":   "k2.aesgcm256.DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZnCY=",
		"short":           "k1.aesgcm256.DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZ=",
		"standard base64": "k1.aesgcm256.DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZn/Y=",
		"a stored value":  vectors[0].stored,
	} {
		if _, err := New(key); !errors.Is(err, ErrKeyFormat) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestDecryptRoutr2Values(t *testing.T) {
	c, err := New(testKey)
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range vectors {
		got, err := c.Decrypt(v.stored)
		if err != nil || got != v.plain {
			t.Errorf("%s: got %q, %v", v.stored, got, err)
		}
	}
	// Node's base64 decoder ignores missing padding; so does Decrypt.
	unpadded := strings.TrimRight(vectors[0].stored, "=")
	if got, err := c.Decrypt(unpadded); err != nil || got != "1234" {
		t.Errorf("unpadded: got %q, %v", got, err)
	}
	upper := strings.Replace(vectors[0].stored, testFingerprint, strings.ToUpper(testFingerprint), 1)
	if got, err := c.Decrypt(upper); err != nil || got != "1234" {
		t.Errorf("upper-case fingerprint: got %q, %v", got, err)
	}
}

func TestEncryptMatchesRoutr2(t *testing.T) {
	// With the iv the library drew, Encrypt writes the exact same string.
	iv, _ := base64.URLEncoding.DecodeString("s0lCWtLiZE7EokhT")
	c, err := newCipher(testKey, bytes.NewReader(iv))
	if err != nil {
		t.Fatal(err)
	}
	got, err := c.Encrypt("1234")
	if err != nil || got != vectors[0].stored {
		t.Errorf("got %s, %v\nwant %s", got, err, vectors[0].stored)
	}
	if _, err := c.Encrypt("again"); err == nil {
		t.Error("an exhausted random source is an error, not a reused iv")
	}
}

func TestEncryptRoundTrip(t *testing.T) {
	c, err := New(testKey)
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range vectors {
		stored, err := c.Encrypt(v.plain)
		if err != nil {
			t.Fatal(err)
		}
		if !IsCloaked(stored) || !strings.HasPrefix(stored, "v1.aesgcm256."+testFingerprint+".") {
			t.Errorf("not in the cloak format: %s", stored)
		}
		if len(strings.Split(stored, ".")[4]) < minCiphertextLength {
			t.Errorf("Node refuses a ciphertext shorter than 24 chars: %s", stored)
		}
		got, err := c.Decrypt(stored)
		if err != nil || got != v.plain {
			t.Errorf("round trip of %q: got %q, %v", v.plain, got, err)
		}
	}
	a, _ := c.Encrypt("same")
	b, _ := c.Encrypt("same")
	if a == b {
		t.Error("two encryptions of one value share an iv")
	}
}

func TestDecryptPassesThroughPlainValues(t *testing.T) {
	c, err := New(testKey)
	if err != nil {
		t.Fatal(err)
	}
	for _, plain := range []string{
		"",
		"1234",
		"v1.aesgcm256",
		"v1.aesgcm256.fcefa160.s0lCWtLiZE7EokhT", // no ciphertext
		"v1.aesgcm256.fcefa160.s0lCWtLiZE7EokhT.AAAAAAAAAAAAAAAAAAAAAA",         // 22 chars, Node refuses it too
		"v1.aesgcm256.fcefa160.s0lCWtLiZE7EokhT.Dc8uP9-2kqivaKsOxJKpxnGuzNg=.x", // trailing part
		"v2.aesgcm256.fcefa160.s0lCWtLiZE7EokhT.Dc8uP9-2kqivaKsOxJKpxnGuzNg=",
		"v1.aesgcm256.fcefa16.s0lCWtLiZE7EokhT.Dc8uP9-2kqivaKsOxJKpxnGuzNg=",  // short fingerprint
		"v1.aesgcm256.fcefa160.s0lCWtLiZE7Eokh.Dc8uP9-2kqivaKsOxJKpxnGuzNg=",  // short iv
		"v1.aesgcm256.fcefa160.s0lCWtLiZE7EokhT.Dc8uP9+2kqivaKsOxJKpxnGuzNg=", // standard alphabet
	} {
		if IsCloaked(plain) {
			t.Errorf("%q counts as cloaked", plain)
		}
		got, err := c.Decrypt(plain)
		if err != nil || got != plain {
			t.Errorf("%q: got %q, %v", plain, got, err)
		}
	}
}

func TestDecryptFailures(t *testing.T) {
	c, err := New(testKey)
	if err != nil {
		t.Fatal(err)
	}
	other := "v1.aesgcm256.00000000.s0lCWtLiZE7EokhT.Dc8uP9-2kqivaKsOxJKpxnGuzNg="
	if _, err := c.Decrypt(other); err == nil || !strings.Contains(err.Error(), "00000000") {
		t.Errorf("another key's value: %v", err)
	}
	tampered := vectors[0].stored[:len(vectors[0].stored)-5] + "AAAA="
	if _, err := c.Decrypt(tampered); err == nil || strings.Contains(err.Error(), "1234") {
		t.Errorf("tampered: %v", err)
	}
	badIV := "v1.aesgcm256.fcefa160.s0lCWtLiZE7Eokh=.Dc8uP9-2kqivaKsOxJKpxnGuzNg="
	if got, err := c.Decrypt(badIV); err != nil || got != badIV {
		t.Errorf("a padded iv is not the cloak format, so it passes through: %q %v", got, err)
	}
}

func TestGenerateKey(t *testing.T) {
	key, err := GenerateKey()
	if err != nil {
		t.Fatal(err)
	}
	if !IsKey(key) {
		t.Errorf("not a cloak key: %s", key)
	}
	if _, err := New(key); err != nil {
		t.Error(err)
	}
	if other, _ := GenerateKey(); other == key {
		t.Error("two keys are the same")
	}
}

func TestFingerprint(t *testing.T) {
	if got := Fingerprint(testKey); got != testFingerprint {
		t.Errorf("got %s, want %s", got, testFingerprint)
	}
	if !IsKey(testKey) || IsKey("k1.aesgcm256.short") {
		t.Error("IsKey")
	}
}
