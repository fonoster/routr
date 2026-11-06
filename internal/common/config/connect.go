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
	"strings"
)

// DefaultConnectBindAddr is the Connect processor's Routr 2 port.
const DefaultConnectBindAddr = "0.0.0.0:51904"

// Defaults of the Connect settings, Routr 2's (mods/common/src/auth.ts
// NONCE_MAX_AGE_SECONDS, mods/connect REGISTER_DEFAULT_EXPIRES).
const (
	DefaultNonceMaxAge            = 300
	DefaultRegisterDefaultExpires = 3600
)

// ConnectSpec is spec.connect of routr.yaml and the settings part of
// connect.yaml: what the Connect processor takes.
type ConnectSpec struct {
	// BindAddr is where the processor serves gRPC; in routr.yaml an empty
	// string means it is not served.
	BindAddr string `yaml:"bindAddr"`
	// NonceMaxAge is how long, in seconds, a digest nonce stays valid; 0
	// accepts any nonce.
	NonceMaxAge int `yaml:"nonceMaxAge"`
	// RegisterDefaultExpires is the expiry, in seconds, granted to a REGISTER
	// that carries neither a Contact expires parameter nor an Expires header.
	RegisterDefaultExpires int `yaml:"registerDefaultExpires"`
	// VerifierAddr is the Verifier service that checks Connect Tokens over
	// gRPC (Routr 2's CONNECT_VERIFIER_ADDR). Exclusive with
	// VerifierPublicKeyPath; with neither, a Connect Token is not accepted.
	VerifierAddr string `yaml:"verifierAddr"`
	// VerifierPublicKeyPath is the PEM key Connect Tokens are verified with
	// in process (Routr 2's CONNECT_VERIFIER_PUBLIC_KEY_PATH).
	VerifierPublicKeyPath string `yaml:"verifierPublicKeyPath"`
	// VerifierIssuer, when set, is the iss a Connect Token verified with
	// VerifierPublicKeyPath must carry. The Verifier service checks its own.
	VerifierIssuer string `yaml:"verifierIssuer"`
	// VerifierAudience, when set, is what the aud of a Connect Token verified
	// with VerifierPublicKeyPath must name.
	VerifierAudience string `yaml:"verifierAudience"`
	// UntrustedHeadersToStrip are the platform headers removed from requests
	// of untrusted sources (Routr 2's UNTRUSTED_HEADERS_TO_STRIP). Absent is
	// the default list; empty strips nothing.
	UntrustedHeadersToStrip []string `yaml:"untrustedHeadersToStrip"`
}

// ConnectFileSpec is the spec of connect.yaml: the settings plus what only a
// standalone processor needs, the addresses of its peers and the peer
// EdgePorts it trusts.
type ConnectFileSpec struct {
	ConnectSpec `yaml:",inline"`
	// LocationAddr is the Location service.
	LocationAddr string `yaml:"locationAddr"`
	// APIAddr is the Data API.
	APIAddr string `yaml:"apiAddr"`
	// TrustedEdgePorts narrows which X-Edgeport-Ref values are honored;
	// empty means any ref from a trusted address.
	TrustedEdgePorts []string `yaml:"trustedEdgePorts"`
	// TrustedEdgePortAddresses are the peer EdgePorts, as IPs or CIDRs, whose
	// forwarded requests skip routing; empty, the default, trusts none.
	TrustedEdgePortAddresses []string `yaml:"trustedEdgePortAddresses"`
	// TrustedRegistryAddresses are the Requesters the Registry sends its
	// Trunk REGISTERs through, as IPs or CIDRs. They are honored for
	// X-Gateway-Auth and nothing else, never for X-Edgeport-Ref; empty, the
	// default, honors X-Gateway-Auth from nobody.
	TrustedRegistryAddresses []string `yaml:"trustedRegistryAddresses"`
}

// ConnectFile is connect.yaml, what a standalone Connect reads. Routr 2's
// Connect read these settings from the environment (mods/connect/src/
// envs.ts); the names are the same, in camelCase under spec.
type ConnectFile struct {
	Kind       string            `yaml:"kind"`
	APIVersion string            `yaml:"apiVersion"`
	Ref        string            `yaml:"ref"`
	Metadata   map[string]string `yaml:"metadata"`
	LogLevel   string            `yaml:"logLevel"`
	Spec       ConnectFileSpec   `yaml:"spec"`
}

// LoadConnect reads connect.yaml.
func LoadConnect(path string, opts ResolveOptions) (*ConnectFile, error) {
	cfg := newConnectFile()
	if err := Load(path, validateConnectFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseConnect is LoadConnect on the content of the file.
func ParseConnect(data []byte, opts ResolveOptions) (*ConnectFile, error) {
	cfg := newConnectFile()
	if err := Parse(data, validateConnectFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

func newConnectFile() *ConnectFile {
	return &ConnectFile{LogLevel: DefaultLogLevel, Spec: ConnectFileSpec{ConnectSpec: defaultConnectSpec()}}
}

func defaultConnectSpec() ConnectSpec {
	return ConnectSpec{
		BindAddr:               DefaultConnectBindAddr,
		NonceMaxAge:            DefaultNonceMaxAge,
		RegisterDefaultExpires: DefaultRegisterDefaultExpires,
	}
}

// validateConnectFile checks connect.yaml: a Routr 3 file, so unknown keys
// are rejected.
func validateConnectFile(raw map[string]any) error {
	if raw == nil {
		return errors.New("(root): should be object")
	}
	if err := knownKeys(raw, "", "apiVersion", "kind", "ref", "metadata", "logLevel", "spec"); err != nil {
		return err
	}
	if v, ok := raw["kind"]; ok {
		if kind, _ := v.(string); !strings.EqualFold(kind, "Connect") {
			return errors.New("kind: should be equal to constant Connect")
		}
	}
	if err := validateLogLevel(raw); err != nil {
		return err
	}
	if err := requiredKeys(raw, "", "spec"); err != nil {
		return err
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return errors.New("spec: should be object")
	}
	if err := knownKeys(spec, "spec", "bindAddr", "locationAddr", "apiAddr", "nonceMaxAge", "registerDefaultExpires", "verifierAddr", "verifierPublicKeyPath", "verifierIssuer", "verifierAudience", "untrustedHeadersToStrip", "trustedEdgePorts", "trustedEdgePortAddresses", "trustedRegistryAddresses"); err != nil {
		return err
	}
	if err := requiredKeys(spec, "spec", "locationAddr", "apiAddr"); err != nil {
		return err
	}
	for _, key := range []string{"bindAddr", "locationAddr", "apiAddr"} {
		if err := optionalString(spec, "spec", key, true); err != nil {
			return err
		}
	}
	if err := validateConnectSettings(spec, "spec"); err != nil {
		return err
	}
	for _, key := range []string{"trustedEdgePorts", "trustedEdgePortAddresses", "trustedRegistryAddresses"} {
		if err := validateStringArray(spec, "spec", key); err != nil {
			return err
		}
	}
	return nil
}

// validateConnectSettings checks the settings shared by spec.connect of
// routr.yaml and connect.yaml.
func validateConnectSettings(section map[string]any, path string) error {
	if err := optionalInteger(section, path, "nonceMaxAge", 0, 0); err != nil {
		return err
	}
	if err := optionalInteger(section, path, "registerDefaultExpires", 1, 0); err != nil {
		return err
	}
	for _, key := range []string{"verifierAddr", "verifierPublicKeyPath", "verifierIssuer", "verifierAudience"} {
		if err := optionalString(section, path, key, true); err != nil {
			return err
		}
	}
	// As Routr 2's assertOnlyOneEnvIsSet
	_, hasAddr := section["verifierAddr"]
	_, hasKey := section["verifierPublicKeyPath"]
	if hasAddr && hasKey {
		return fmt.Errorf("%s: only one of verifierAddr and verifierPublicKeyPath may be set", childPath(path, "verifierAddr"))
	}
	return validateStringArray(section, path, "untrustedHeadersToStrip")
}
