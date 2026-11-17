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
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/fonoster/routr/internal/common/config"
)

const testCertCheck = 10 * time.Millisecond

// logBuffer is a log the EdgePort writes while the test reads it.
type logBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *logBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *logBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func (b *logBuffer) logger() *slog.Logger { return slog.New(slog.NewTextHandler(b, nil)) }

// replace overwrites path in place, as the guide's renewal does.
func replace(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
}

// servedCert is the leaf a new TLS handshake on port gets.
func servedCert(t *testing.T, port int) *x509.Certificate {
	t.Helper()
	conn, err := tls.Dial("tcp4", fmt.Sprintf("127.0.0.1:%d", port), &tls.Config{InsecureSkipVerify: true})
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	return conn.ConnectionState().PeerCertificates[0]
}

// startReloading starts an EdgePort on certFile and keyFile that checks them
// every testCertCheck and logs to log.
func startReloading(t *testing.T, certFile, keyFile string, log *logBuffer) (int, int) {
	t.Helper()
	tlsPort, wssPort, err := startTLSEdgePort(t, fmt.Sprintf("certFile: %s\n    keyFile: %s", certFile, keyFile),
		func(e *EdgePort) {
			e.certCheck = testCertCheck
			e.log = log.logger()
		})
	if err != nil {
		t.Fatal(err)
	}
	return tlsPort, wssPort
}

func TestARenewedPairIsServedWithoutARestart(t *testing.T) {
	a, b := issue(t, "pair-a", nil, false), issue(t, "pair-b", nil, false)
	certFile, keyFile := pemPair(t, a)
	log := &logBuffer{}
	tlsPort, wssPort := startReloading(t, certFile, keyFile, log)
	if !servedCert(t, tlsPort).Equal(a.cert) {
		t.Fatal("the EdgePort starts on pair A")
	}

	replace(t, keyFile, keyPEM(t, b))
	replace(t, certFile, certPEM(b))
	eventually(t, "pair B on tls", func() bool { return servedCert(t, tlsPort).Equal(b.cert) })
	if !servedCert(t, wssPort).Equal(b.cert) {
		t.Error("wss serves pair B too")
	}
	want := fmt.Sprintf(`msg="reloaded the TLS certificate" certFile=%s notAfter=%s`,
		certFile, b.cert.NotAfter.UTC().Format(time.RFC3339))
	eventually(t, "the info line", func() bool { return strings.Contains(log.String(), want) })
}

func TestAMismatchedPairKeepsTheCurrentOne(t *testing.T) {
	a, b := issue(t, "pair-a", nil, false), issue(t, "pair-b", nil, false)
	certFile, keyFile := pemPair(t, a)
	log := &logBuffer{}
	tlsPort, _ := startReloading(t, certFile, keyFile, log)

	// Half a renewal: the new key is in place, its certificate is not yet
	replace(t, keyFile, keyPEM(t, b))
	want := fmt.Sprintf(`level=WARN msg="unable to reload the TLS certificate; keeping the current one" certFile=%s keyFile=%s error=`,
		certFile, keyFile)
	eventually(t, "the warn line", func() bool { return strings.Contains(log.String(), want) })
	if !servedCert(t, tlsPort).Equal(a.cert) {
		t.Error("a mismatched pair keeps pair A")
	}

	replace(t, certFile, certPEM(b))
	eventually(t, "pair B once it matches", func() bool { return servedCert(t, tlsPort).Equal(b.cert) })
}

func TestOutboundPresentsTheRenewedPair(t *testing.T) {
	a, b := issue(t, "pair-a", nil, false), issue(t, "pair-b", nil, false)
	certFile, keyFile := pemPair(t, a)
	_, client, certs, err := TLSConfigs(&config.SecurityContext{
		CertFile: certFile, KeyFile: keyFile, Client: &config.Client{AuthType: "DisabledAll"},
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go certs.run(ctx, testCertCheck, discardLog())

	// A peer that asks for a client certificate
	presented := make(chan *x509.Certificate, 1)
	peer := &tls.Config{
		Certificates: []tls.Certificate{tlsCert(issue(t, "carrier", nil, false))},
		ClientAuth:   tls.RequireAnyClientCert,
		VerifyConnection: func(cs tls.ConnectionState) error {
			presented <- cs.PeerCertificates[0]
			return nil
		},
	}
	dial := func() *x509.Certificate {
		if _, clientErr, serverErr := handshake(t, peer, client); clientErr != nil || serverErr != nil {
			t.Fatalf("%v %v", clientErr, serverErr)
		}
		return <-presented
	}
	if !dial().Equal(a.cert) {
		t.Fatal("the EdgePort presents pair A")
	}
	replace(t, keyFile, keyPEM(t, b))
	replace(t, certFile, certPEM(b))
	eventually(t, "pair B outbound", func() bool { return dial().Equal(b.cert) })
}
