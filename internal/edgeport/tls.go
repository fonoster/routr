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
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"software.sslmate.com/src/go-pkcs12"

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

// ResolveTLSSetting is resolveTlsSetting: the environment wins over the
// config, and the config over the default. Blank entries are dropped.
func ResolveTLSSetting(fromEnv, fromConfig, fallback []string) []string {
	clean := func(list []string) []string {
		var out []string
		for _, item := range list {
			if item = strings.TrimSpace(item); item != "" {
				out = append(out, item)
			}
		}
		return out
	}
	if env := clean(fromEnv); len(env) > 0 {
		return env
	}
	if cfg := clean(fromConfig); len(cfg) > 0 {
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

// loadKeyStore reads the PKCS12 keystore, or, when that fails, server.crt and
// server.key next to it (the files convert-to-p12.sh builds it from).
func loadKeyStore(sc *config.SecurityContext) (tls.Certificate, error) {
	if sc.KeyStore != "" {
		data, err := os.ReadFile(sc.KeyStore)
		if err == nil {
			key, cert, chain, perr := pkcs12.DecodeChain(data, sc.KeyStorePassword)
			if perr == nil {
				c := tls.Certificate{PrivateKey: key, Leaf: cert, Certificate: [][]byte{cert.Raw}}
				for _, ca := range chain {
					c.Certificate = append(c.Certificate, ca.Raw)
				}
				return c, nil
			}
			err = perr
		}
		dir := filepath.Dir(sc.KeyStore)
		if pair, perr := tls.LoadX509KeyPair(filepath.Join(dir, "server.crt"), filepath.Join(dir, "server.key")); perr == nil {
			return pair, nil
		}
		return tls.Certificate{}, fmt.Errorf("unable to read the keystore %s: %w", sc.KeyStore, err)
	}
	return tls.Certificate{}, errors.New("no keyStore in .spec.securityContext")
}

// loadTrustStore reads the truststore (PKCS12 or PEM) into a pool on top of the
// system roots. Without one, the system roots apply, as the JVM's cacerts do.
func loadTrustStore(sc *config.SecurityContext) (*x509.CertPool, error) {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	if sc == nil || sc.TrustStore == "" {
		return pool, nil
	}
	data, err := os.ReadFile(sc.TrustStore)
	if err != nil {
		return nil, err
	}
	if certs, perr := pkcs12.DecodeTrustStore(data, sc.TrustStorePassword); perr == nil {
		for _, c := range certs {
			pool.AddCert(c)
		}
		return pool, nil
	}
	if _, cert, perr := pkcs12.Decode(data, sc.TrustStorePassword); perr == nil && cert != nil {
		pool.AddCert(cert)
		return pool, nil
	}
	for block, rest := pem.Decode(data); block != nil; block, rest = pem.Decode(rest) {
		if c, perr := x509.ParseCertificate(block.Bytes); perr == nil {
			pool.AddCert(c)
		}
	}
	return pool, nil
}

// TLSConfigs builds the server (TLS and WSS listening points) and client
// (outbound TLS and WSS) configurations from spec.securityContext and the
// SECURITY_CONTEXT_CLIENT_* variables. authType follows JAIN-SIP's
// TLS_CLIENT_AUTH_TYPE: Enabled requires a client certificate, Want asks for
// one, Disabled asks for none, and DisabledAll also trusts any server
// certificate on outbound connections.
func TLSConfigs(sc *config.SecurityContext, env config.Env) (*tls.Config, *tls.Config, error) {
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
	protocols := ResolveTLSSetting(env.ClientProtocols, clientProtocols, DefaultTLSProtocols)
	suites := ResolveTLSSetting(env.ClientCipherSuites, clientSuites, DefaultTLSCipherSuites)
	lo, hi, err := versionRange(protocols)
	if err != nil {
		return nil, nil, err
	}

	roots, err := loadTrustStore(sc)
	if err != nil {
		return nil, nil, fmt.Errorf("unable to read the truststore: %w", err)
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

	cert, err := loadKeyStore(sc)
	if err != nil {
		return nil, client, err
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
