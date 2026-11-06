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

// Package cloak reads and writes the field-encryption format Routr 2 stores
// through prisma-field-encryption 1.6, which delegates to @47ng/cloak 1.2:
//
//	key:    k1.aesgcm256.<base64url of 32 random bytes>
//	stored: v1.aesgcm256.<fingerprint>.<iv>.<ciphertext>
//
// where the fingerprint is the first 8 hex digits of the SHA-256 of the
// serialized key text, the iv is 12 random bytes and the ciphertext is
// AES-256-GCM output followed by its 16-byte tag, both base64url with '='
// padding (Node's Buffer.toString("base64") with +/ swapped for -_). A value
// Routr 2 wrote decrypts here and one written here decrypts in Routr 2.
package cloak

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const (
	keyPrefix     = "k1.aesgcm256."
	messagePrefix = "v1.aesgcm256."
	keyLength     = 32
	ivLength      = 12
	tagLength     = 16
	// fingerprintLength is FINGERPRINT_LENGTH in @47ng/cloak: hex digits.
	fingerprintLength = 8
	// minCiphertextLength is the padded base64url of an empty message plus
	// its tag; @47ng/cloak refuses anything shorter.
	minCiphertextLength = 24
)

// cloakKeyRegex is @47ng/cloak's: 43 base64url chars and optional padding.
var cloakKeyRegex = regexp.MustCompile(`^k1\.aesgcm256\.([A-Za-z0-9_-]{43}=?)$`)

var (
	fingerprintRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}$`)
	ivRegex          = regexp.MustCompile(`^[A-Za-z0-9_-]{16}$`)
	ciphertextRegex  = regexp.MustCompile(`^[A-Za-z0-9_-]+={0,2}$`)
)

// ErrKeyFormat is returned by New for a key that is not a cloak key.
var ErrKeyFormat = errors.New("cloak: unknown key format (expected k1.aesgcm256.<base64url key>)")

// Cipher encrypts and decrypts strings with one cloak key.
type Cipher interface {
	// Encrypt returns plain in the stored format, with a fresh iv each call.
	Encrypt(plain string) (string, error)
	// Decrypt returns the plaintext of a stored value. A value that is not in
	// the cloak format comes back unchanged, as Routr 2 reads a column written
	// before the key was set. A cloaked value that this key cannot open is an
	// error; the error never carries the value.
	Decrypt(stored string) (string, error)
	// Fingerprint is the key's fingerprint, the one its stored values carry.
	Fingerprint() string
}

type aesCipher struct {
	aead        cipher.AEAD
	fingerprint string
	random      io.Reader
}

// New parses a cloak key (k1.aesgcm256.<base64url>) into a Cipher.
func New(key string) (Cipher, error) {
	return newCipher(key, rand.Reader)
}

func newCipher(key string, random io.Reader) (Cipher, error) {
	raw, err := parseKey(key)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(raw)
	if err != nil {
		return nil, fmt.Errorf("cloak: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("cloak: %w", err)
	}
	return &aesCipher{aead: aead, fingerprint: Fingerprint(key), random: random}, nil
}

// IsKey tells whether key is in the cloak key format.
func IsKey(key string) bool {
	return cloakKeyRegex.MatchString(key)
}

// Fingerprint is the first 8 hex digits of the SHA-256 of the serialized key
// text, what @47ng/cloak's getKeyFingerprint computes.
func Fingerprint(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])[:fingerprintLength]
}

// GenerateKey returns a new random key in the cloak key format.
func GenerateKey() (string, error) {
	raw := make([]byte, keyLength)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return "", fmt.Errorf("cloak: %w", err)
	}
	return keyPrefix + base64.URLEncoding.EncodeToString(raw), nil
}

func parseKey(key string) ([]byte, error) {
	match := cloakKeyRegex.FindStringSubmatch(key)
	if match == nil {
		return nil, ErrKeyFormat
	}
	raw, err := decodeBase64(match[1])
	if err != nil || len(raw) != keyLength {
		return nil, ErrKeyFormat
	}
	return raw, nil
}

// decodeBase64 decodes base64url with or without padding, as Node's
// Buffer.from(input, "base64") does for the strings @47ng/cloak writes.
func decodeBase64(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(strings.TrimRight(s, "="))
}

func (c *aesCipher) Fingerprint() string {
	return c.fingerprint
}

func (c *aesCipher) Encrypt(plain string) (string, error) {
	iv := make([]byte, ivLength)
	if _, err := io.ReadFull(c.random, iv); err != nil {
		return "", fmt.Errorf("cloak: %w", err)
	}
	// Seal appends the 16-byte tag after the ciphertext, the WebCrypto layout
	// @47ng/cloak reproduces on Node.
	sealed := c.aead.Seal(nil, iv, []byte(plain), nil)
	return strings.Join([]string{
		"v1",
		"aesgcm256",
		c.fingerprint,
		base64.URLEncoding.EncodeToString(iv),
		base64.URLEncoding.EncodeToString(sealed),
	}, "."), nil
}

// cloaked is the parse of a stored value (parseCloakedString in @47ng/cloak).
type cloaked struct {
	fingerprint string
	iv          string
	ciphertext  string
}

// parse returns the parts of a stored value, or ok=false when the value is not
// in the cloak format.
func parse(stored string) (parts cloaked, ok bool) {
	if !strings.HasPrefix(stored, messagePrefix) {
		return cloaked{}, false
	}
	fields := strings.Split(stored, ".")
	if len(fields) != 5 {
		return cloaked{}, false
	}
	parts = cloaked{fingerprint: fields[2], iv: fields[3], ciphertext: fields[4]}
	if !fingerprintRegex.MatchString(parts.fingerprint) ||
		!ivRegex.MatchString(parts.iv) ||
		!ciphertextRegex.MatchString(parts.ciphertext) ||
		len(parts.ciphertext) < minCiphertextLength {
		return cloaked{}, false
	}
	return parts, true
}

// IsCloaked tells whether stored is in the cloak format.
func IsCloaked(stored string) bool {
	_, ok := parse(stored)
	return ok
}

func (c *aesCipher) Decrypt(stored string) (string, error) {
	parts, ok := parse(stored)
	if !ok {
		return stored, nil
	}
	if !strings.EqualFold(parts.fingerprint, c.fingerprint) {
		return "", fmt.Errorf("cloak: key is not available for fingerprint %s (have %s)", parts.fingerprint, c.fingerprint)
	}
	iv, err := decodeBase64(parts.iv)
	if err != nil || len(iv) != ivLength {
		return "", errors.New("cloak: malformed iv")
	}
	sealed, err := decodeBase64(parts.ciphertext)
	if err != nil || len(sealed) < tagLength {
		return "", errors.New("cloak: malformed ciphertext")
	}
	plain, err := c.aead.Open(nil, iv, sealed, nil)
	if err != nil {
		return "", errors.New("cloak: authentication failed")
	}
	return string(plain), nil
}
