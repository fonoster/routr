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
	"fmt"
	"log/slog"
	"os"
	"sync/atomic"
	"time"
)

// certCheckInterval is how often a running EdgePort reads certFile and keyFile
// for a renewed pair.
const certCheckInterval = 30 * time.Second

// certReloader holds the pair the TLS and WSS listening points serve and
// outbound connections present. Handshakes read it through GetCertificate and
// GetClientCertificate, so a renewed pair applies to new handshakes without a
// restart; open connections keep theirs.
type certReloader struct {
	certFile, keyFile string
	current           atomic.Pointer[tls.Certificate]
	// The bytes of the pair in current; only check uses them after the start
	certPEM, keyPEM []byte
}

// newCertReloader loads the pair in certFile and keyFile.
func newCertReloader(certFile, keyFile string) (*certReloader, error) {
	r := &certReloader{certFile: certFile, keyFile: keyFile}
	certPEM, keyPEM, err := r.read()
	if err == nil {
		err = r.load(certPEM, keyPEM)
	}
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (r *certReloader) read() ([]byte, []byte, error) {
	certPEM, err := os.ReadFile(r.certFile)
	if err != nil {
		return nil, nil, r.loadError(err)
	}
	keyPEM, err := os.ReadFile(r.keyFile)
	if err != nil {
		return nil, nil, r.loadError(err)
	}
	return certPEM, keyPEM, nil
}

// load parses the pair and makes it the current one.
func (r *certReloader) load(certPEM, keyPEM []byte) error {
	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return r.loadError(err)
	}
	r.certPEM, r.keyPEM = certPEM, keyPEM
	r.current.Store(&cert)
	return nil
}

func (r *certReloader) loadError(err error) error {
	return fmt.Errorf("unable to load certFile %s and keyFile %s: %w", r.certFile, r.keyFile, err)
}

func (r *certReloader) getCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	return r.current.Load(), nil
}

// getClientCertificate presents the pair when the peer accepts it and none
// otherwise, as tls.Config.Certificates does.
func (r *certReloader) getClientCertificate(cri *tls.CertificateRequestInfo) (*tls.Certificate, error) {
	cert := r.current.Load()
	if cri.SupportsCertificate(cert) != nil {
		return &tls.Certificate{}, nil
	}
	return cert, nil
}

// check loads the pair again when either file's bytes changed. A pair that
// fails to load leaves the current one in place; the next check tries again.
func (r *certReloader) check(log *slog.Logger) {
	certPEM, keyPEM, err := r.read()
	if err == nil {
		if bytes.Equal(certPEM, r.certPEM) && bytes.Equal(keyPEM, r.keyPEM) {
			return
		}
		err = r.load(certPEM, keyPEM)
	}
	if err != nil {
		log.Warn("unable to reload the TLS certificate; keeping the current one",
			"certFile", r.certFile, "keyFile", r.keyFile, "error", err)
		return
	}
	log.Info("reloaded the TLS certificate", "certFile", r.certFile,
		"notAfter", r.current.Load().Leaf.NotAfter.UTC().Format(time.RFC3339))
}

// run checks the files every interval until ctx is done.
func (r *certReloader) run(ctx context.Context, interval time.Duration, log *slog.Logger) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.check(log)
		}
	}
}
