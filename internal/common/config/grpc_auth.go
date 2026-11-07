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
package config

import (
	"errors"
	"fmt"
)

// The gRPC authentication settings (ROUTR3.md § 6). A server takes
// tls, apiKeys and insecure in its own section; a client takes one ClientAuth
// per peer, spec.apiAuth, spec.locationAuth and so on.

// ServerTLS is the tls key of a server's section.
type ServerTLS struct {
	// CertFile and KeyFile are the PEM files of the server's certificate.
	CertFile string `yaml:"certFile"`
	KeyFile  string `yaml:"keyFile"`
	// ClientCAFile, when set, authenticates the callers whose certificate this
	// CA signed. A certificate it did not sign fails the handshake.
	ClientCAFile string `yaml:"clientCAFile"`
}

// ServerAuth is what a gRPC server's section of routr.yaml and its standalone
// file take. A caller passes with an API key or a client certificate; either
// suffices. With neither configured nothing authenticates callers.
type ServerAuth struct {
	TLS *ServerTLS `yaml:"tls"`
	// APIKeys are the keys accepted as "authorization: Bearer <key>", written
	// as secret:// references and resolved by the time they get here. More than
	// one lets a key be rotated with no downtime.
	APIKeys []string `yaml:"apiKeys"`
	// Insecure accepts serving the Data API or the Requester beyond loopback
	// with no authentication, which they otherwise refuse.
	Insecure bool `yaml:"insecure"`
}

// Authenticated says whether callers have to prove who they are. TLS alone
// encrypts and does not.
func (a ServerAuth) Authenticated() bool {
	return len(a.APIKeys) > 0 || (a.TLS != nil && a.TLS.ClientCAFile != "")
}

// ClientTLS is the tls key of a ClientAuth. Present turns TLS on.
type ClientTLS struct {
	// CAFile verifies the server; the system's roots when empty.
	CAFile string `yaml:"caFile"`
	// CertFile and KeyFile are the client's certificate, for mutual TLS.
	CertFile string `yaml:"certFile"`
	KeyFile  string `yaml:"keyFile"`
	// ServerName is what the server's certificate has to name, when that isn't
	// the host of the address dialed.
	ServerName string `yaml:"serverName"`
}

// ClientAuth is how a component reaches one peer. The zero value is plaintext
// with no key, what a peer with no authentication expects.
type ClientAuth struct {
	// APIKey is sent as "authorization: Bearer <key>" on every call, written as
	// a secret:// reference.
	APIKey string     `yaml:"apiKey"`
	TLS    *ClientTLS `yaml:"tls"`
}

// serverAuthKeys are the keys ServerAuth adds to a section.
var serverAuthKeys = []string{"tls", "apiKeys", "insecure"}

// withServerAuth is keys plus the ones ServerAuth adds, for knownKeys.
func withServerAuth(keys ...string) []string {
	return append(keys, serverAuthKeys...)
}

// ValidateServerAuth checks the keys of ServerAuth in a section. Its errors
// name the key, never a value.
func ValidateServerAuth(section map[string]any, path string) error {
	if v, ok := section["insecure"]; ok {
		if _, isBool := v.(bool); !isBool {
			return fmt.Errorf("%s: should be boolean", childPath(path, "insecure"))
		}
	}
	if v, ok := section["apiKeys"]; ok {
		keys, isList := v.([]any)
		if !isList {
			return fmt.Errorf("%s: should be array", childPath(path, "apiKeys"))
		}
		for i, key := range keys {
			if s, isString := key.(string); !isString || s == "" {
				return fmt.Errorf("%s[%d]: should be a non-empty string", childPath(path, "apiKeys"), i)
			}
		}
	}
	tls, present, err := optionalObject(section, path, "tls")
	if err != nil || !present {
		return err
	}
	at := childPath(path, "tls")
	if err := knownKeys(tls, at, "certFile", "keyFile", "clientCAFile"); err != nil {
		return err
	}
	if err := requiredKeys(tls, at, "certFile", "keyFile"); err != nil {
		return err
	}
	return nonEmptyStrings(tls, at, "certFile", "keyFile", "clientCAFile")
}

// ValidateClientAuth checks the ClientAuth at key of a section, when present.
func ValidateClientAuth(section map[string]any, path, key string) error {
	auth, present, err := optionalObject(section, path, key)
	if err != nil || !present {
		return err
	}
	at := childPath(path, key)
	if err := knownKeys(auth, at, "apiKey", "tls"); err != nil {
		return err
	}
	if err := optionalString(auth, at, "apiKey", true); err != nil {
		return err
	}
	tls, present, err := optionalObject(auth, at, "tls")
	if err != nil || !present {
		return err
	}
	at = childPath(at, "tls")
	if err := knownKeys(tls, at, "caFile", "certFile", "keyFile", "serverName"); err != nil {
		return err
	}
	if err := nonEmptyStrings(tls, at, "caFile", "certFile", "keyFile", "serverName"); err != nil {
		return err
	}
	_, hasCert := tls["certFile"]
	_, hasKey := tls["keyFile"]
	if hasCert != hasKey {
		return errors.New(at + ": certFile and keyFile go together")
	}
	return nil
}

func nonEmptyStrings(section map[string]any, path string, keys ...string) error {
	for _, key := range keys {
		if err := optionalString(section, path, key, true); err != nil {
			return err
		}
	}
	return nil
}
