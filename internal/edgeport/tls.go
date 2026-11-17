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
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strings"

	"github.com/fonoster/routr/internal/common/config"
)

// The defaults of mods/edgeport/src/tls.ts.
var (
	DefaultTLSProtocols    = []string{"TLSv1.3"}
	DefaultTLSCipherSuites = []string{
		"TLS_AES_256_GCM_SHA384",
		"TLS_AES_128_GCM_SHA256",
		"TLS_CHACHA20_POLY1305_SHA256",
		"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
		"TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
		"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
		"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
		"TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
		"TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256",
	}
)

// ResolveTLSSetting is resolveTlsSetting: the config, or the default when
// it says nothing. Blank entries are dropped.
func ResolveTLSSetting(fromConfig, fallback []string) []string {
	var cfg []string
	for _, item := range fromConfig {
		if item = strings.TrimSpace(item); item != "" {
			cfg = append(cfg, item)
		}
	}
	if len(cfg) > 0 {
		return cfg
	}
	return fallback
}

var tlsVersions = map[string]uint16{
	"TLSv1":   tls.VersionTLS10,
	"TLSv1.1": tls.VersionTLS11,
	"TLSv1.2": tls.VersionTLS12,
	"TLSv1.3": tls.VersionTLS13,
}

// versionRange returns the lowest and highest of the JDK protocol names.
func versionRange(protocols []string) (uint16, uint16, error) {
	var lo, hi uint16
	for _, p := range protocols {
		v, ok := tlsVersions[p]
		if !ok {
			return 0, 0, fmt.Errorf("unsupported TLS protocol %q", p)
		}
		if lo == 0 || v < lo {
			lo = v
		}
		if v > hi {
			hi = v
		}
	}
	return lo, hi, nil
}

// cipherSuites maps the JDK (IANA) names to Go's TLS 1.2 suites. TLS 1.3
// suites are not configurable in Go and are skipped.
func cipherSuites(names []string) []uint16 {
	byName := map[string]uint16{}
	for _, s := range tls.CipherSuites() {
		byName[s.Name] = s.ID
	}
	for _, s := range tls.InsecureCipherSuites() {
		byName[s.Name] = s.ID
	}
	var ids []uint16
	for _, n := range names {
		if id, ok := byName[n]; ok && !strings.HasPrefix(n, "TLS_AES_") && !strings.HasPrefix(n, "TLS_CHACHA20_") {
			ids = append(ids, id)
		}
	}
	return ids
}

// loadCAFile adds the PEM certificates of caFile to the system roots. Without
// one, the system roots apply.
func loadCAFile(caFile string) (*x509.CertPool, error) {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	if caFile == "" {
		return pool, nil
	}
	data, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("unable to read caFile %s: %w", caFile, err)
	}
	if !pool.AppendCertsFromPEM(data) {
		return nil, fmt.Errorf("unable to read caFile %s: no PEM certificate in it", caFile)
	}
	return pool, nil
}

// TLSConfigs builds the server (TLS and WSS listening points) and client
// (outbound TLS and WSS) configurations from spec.securityContext and the
// SECURITY_CONTEXT_CLIENT_* variables. authType follows JAIN-SIP's
// TLS_CLIENT_AUTH_TYPE: Enabled requires a client certificate, Want asks for
// one, Disabled asks for none, and DisabledAll also trusts any server
// certificate on outbound connections.
func TLSConfigs(sc *config.SecurityContext) (*tls.Config, *tls.Config, error) {
	if sc == nil {
		return nil, &tls.Config{}, nil
	}
	var clientProtocols, clientSuites []string
	authType := ""
	if sc.Client != nil {
		clientProtocols = sc.Client.Protocols
		clientSuites = sc.Client.CipherSuites
		authType = sc.Client.AuthType
	}
	protocols := ResolveTLSSetting(clientProtocols, DefaultTLSProtocols)
	suites := ResolveTLSSetting(clientSuites, DefaultTLSCipherSuites)
	lo, hi, err := versionRange(protocols)
	if err != nil {
		return nil, nil, err
	}

	roots, err := loadCAFile(sc.CAFile)
	if err != nil {
		return nil, nil, err
	}

	client := &tls.Config{
		MinVersion:   lo,
		MaxVersion:   hi,
		CipherSuites: cipherSuites(suites),
		RootCAs:      roots,
	}
	if strings.EqualFold(authType, "DisabledAll") {
		client.InsecureSkipVerify = true
	}

	// No certFile: nothing to serve TLS or WSS with (the config refuses those
	// transports without one), but outbound TLS still has its client config
	if sc.CertFile == "" {
		return nil, client, nil
	}
	cert, err := tls.LoadX509KeyPair(sc.CertFile, sc.KeyFile)
	if err != nil {
		return nil, client, fmt.Errorf("unable to load certFile %s and keyFile %s: %w", sc.CertFile, sc.KeyFile, err)
	}
	client.Certificates = []tls.Certificate{cert}

	server := &tls.Config{
		MinVersion:   lo,
		MaxVersion:   hi,
		CipherSuites: cipherSuites(suites),
		Certificates: []tls.Certificate{cert},
		ClientCAs:    roots,
	}
	switch strings.ToLower(authType) {
	case "enabled":
		server.ClientAuth = tls.RequireAndVerifyClientCert
	case "want":
		server.ClientAuth = tls.VerifyClientCertIfGiven
	default:
		server.ClientAuth = tls.NoClientCert
	}
	return server, client, nil
}
