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
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// testCert is a certificate and its key, generated for a test.
type testCert struct {
	cert *x509.Certificate
	key  *ecdsa.PrivateKey
}

// issue makes a certificate for 127.0.0.1 signed by parent, or self-signed
// when parent is nil. A CA can sign others.
func issue(t *testing.T, name string, parent *testCert, isCA bool) *testCert {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	serial, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: name},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		IPAddresses:  []net.IP{net.IPv4(127, 0, 0, 1)},
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	if isCA {
		template.IsCA = true
		template.BasicConstraintsValid = true
		template.KeyUsage |= x509.KeyUsageCertSign
	}
	signer, signerKey := template, key
	if parent != nil {
		signer, signerKey = parent.cert, parent.key
	}
	der, err := x509.CreateCertificate(rand.Reader, template, signer, &key.PublicKey, signerKey)
	if err != nil {
		t.Fatal(err)
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	return &testCert{cert: cert, key: key}
}

func certPEM(certs ...*testCert) []byte {
	var out bytes.Buffer
	for _, c := range certs {
		_ = pem.Encode(&out, &pem.Block{Type: "CERTIFICATE", Bytes: c.cert.Raw})
	}
	return out.Bytes()
}

func keyPEM(t *testing.T, c *testCert) []byte {
	t.Helper()
	der, err := x509.MarshalPKCS8PrivateKey(c.key)
	if err != nil {
		t.Fatal(err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
}

func writeFile(t *testing.T, name string, data []byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

// pemPair writes the chain (leaf first) and the leaf's key, and returns
// their paths.
func pemPair(t *testing.T, chain ...*testCert) (string, string) {
	t.Helper()
	return writeFile(t, "server.crt", certPEM(chain...)), writeFile(t, "server.key", keyPEM(t, chain[0]))
}

func tlsCert(c *testCert) tls.Certificate {
	return tls.Certificate{Certificate: [][]byte{c.cert.Raw}, PrivateKey: c.key}
}

// handshake serves one TLS connection with server, dials it with client, and
// returns the client's view and the server's handshake error.
func handshake(t *testing.T, server, client *tls.Config) (tls.ConnectionState, error, error) {
	t.Helper()
	l, err := tls.Listen("tcp4", "127.0.0.1:0", server)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	served := make(chan error, 1)
	go func() {
		conn, err := l.Accept()
		if err != nil {
			served <- err
			return
		}
		defer conn.Close()
		served <- conn.(*tls.Conn).Handshake()
	}()
	conn, clientErr := tls.Dial("tcp4", l.Addr().String(), client)
	var state tls.ConnectionState
	if clientErr == nil {
		state = conn.ConnectionState()
		defer conn.Close()
	}
	return state, clientErr, <-served
}

// startTLSEdgePort starts an EdgePort with tls and wss transports and the
// securityContext given, and returns the two ports and Start's error (nil
// while it serves). Each opt adjusts the EdgePort before it starts.
func startTLSEdgePort(t *testing.T, securityContext string, opts ...func(*EdgePort)) (int, int, error) {
	t.Helper()
	tlsPort, wssPort := freeTCPPort(t), freeTCPPort(t)
	cfg, err := config.ParseEdgePort([]byte(fmt.Sprintf(`
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-test
spec:
  bindAddr: 127.0.0.1
  processor:
    addr: 127.0.0.1:1
  methods: [INVITE]
  externalAddrs: [127.0.0.1]
  localnets: [127.0.0.1/8]
  transport:
    - protocol: udp
      port: %d
    - protocol: tls
      port: %d
    - protocol: wss
      port: %d
  securityContext:
    %s
`, freeUDPPort(t), tlsPort, wssPort, securityContext)), config.ResolveOptions{Env: config.EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	conn, err := grpc.NewClient("127.0.0.1:1", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	ep, err := New(cfg, Options{Processor: ppb.NewProcessorClient(conn), Logger: discardLog(), Version: "test"})
	if err != nil {
		t.Fatal(err)
	}
	for _, opt := range opts {
		opt(ep)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	started := make(chan error, 1)
	go func() { started <- ep.Start(ctx) }()
	select {
	case err := <-started:
		return tlsPort, wssPort, err
	case <-time.After(300 * time.Millisecond):
		return tlsPort, wssPort, nil
	}
}

func TestTLSAndWSSServeTheCertFile(t *testing.T) {
	leaf := issue(t, "edgeport", nil, false)
	certFile, keyFile := pemPair(t, leaf)
	tlsPort, wssPort, err := startTLSEdgePort(t, fmt.Sprintf("certFile: %s\n    keyFile: %s", certFile, keyFile))
	if err != nil {
		t.Fatal(err)
	}
	for name, port := range map[string]int{"tls": tlsPort, "wss": wssPort} {
		conn, err := tls.Dial("tcp4", fmt.Sprintf("127.0.0.1:%d", port), &tls.Config{InsecureSkipVerify: true})
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		peers := conn.ConnectionState().PeerCertificates
		_ = conn.Close()
		if len(peers) != 1 || !peers[0].Equal(leaf.cert) {
			t.Errorf("%s serves %d certificates, not certFile's", name, len(peers))
		}
	}
}

func TestStartFailsOnAnUnloadablePair(t *testing.T) {
	leaf, other := issue(t, "edgeport", nil, false), issue(t, "other", nil, false)
	certFile, _ := pemPair(t, leaf)
	_, otherKey := pemPair(t, other)
	missing := filepath.Join(t.TempDir(), "server.key")
	for name, keyFile := range map[string]string{"mismatched": otherKey, "unreadable": missing} {
		_, _, err := startTLSEdgePort(t, fmt.Sprintf("certFile: %s\n    keyFile: %s", certFile, keyFile))
		want := fmt.Sprintf("unable to load certFile %s and keyFile %s: ", certFile, keyFile)
		if err == nil || !strings.HasPrefix(err.Error(), want) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestCertFileServesItsChain(t *testing.T) {
	root := issue(t, "root", nil, true)
	intermediate := issue(t, "intermediate", root, true)
	leaf := issue(t, "edgeport", intermediate, false)
	certFile, keyFile := pemPair(t, leaf, intermediate)
	server, _, _, err := TLSConfigs(&config.SecurityContext{CertFile: certFile, KeyFile: keyFile})
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(root.cert)
	state, clientErr, _ := handshake(t, server, &tls.Config{RootCAs: roots})
	if clientErr != nil {
		t.Fatalf("a client that trusts only the root verifies the chain: %v", clientErr)
	}
	if peers := state.PeerCertificates; len(peers) != 2 || !peers[0].Equal(leaf.cert) || !peers[1].Equal(intermediate.cert) {
		t.Errorf("the handshake presents the leaf and the intermediate: %d certificates", len(peers))
	}
}

func TestCAFileTrustsAPrivateCAOutbound(t *testing.T) {
	ca := issue(t, "carrier-ca", nil, true)
	carrier := &tls.Config{Certificates: []tls.Certificate{tlsCert(issue(t, "carrier", ca, false))}}
	caFile := writeFile(t, "carrier-ca.crt", certPEM(ca))
	client := &config.Client{AuthType: "Disabled", Protocols: []string{"TLSv1.3"}}

	_, withCA, _, err := TLSConfigs(&config.SecurityContext{CAFile: caFile, Client: client})
	if err != nil {
		t.Fatal(err)
	}
	if _, err, _ := handshake(t, carrier, withCA); err != nil {
		t.Errorf("caFile trusts the carrier: %v", err)
	}
	_, without, _, err := TLSConfigs(&config.SecurityContext{Client: client})
	if err != nil {
		t.Fatal(err)
	}
	if _, err, _ := handshake(t, carrier, without); err == nil {
		t.Error("without caFile the carrier fails verification")
	}
}

func TestClientAuthEnabledVerifiesAgainstCAFile(t *testing.T) {
	ca := issue(t, "client-ca", nil, true)
	certFile, keyFile := pemPair(t, issue(t, "edgeport", nil, false))
	server, _, _, err := TLSConfigs(&config.SecurityContext{
		CertFile: certFile, KeyFile: keyFile, CAFile: writeFile(t, "ca.crt", certPEM(ca)),
		Client: &config.Client{AuthType: "Enabled"},
	})
	if err != nil {
		t.Fatal(err)
	}
	phone := tlsCert(issue(t, "phone", ca, false))
	if _, _, err := handshake(t, server, &tls.Config{InsecureSkipVerify: true, Certificates: []tls.Certificate{phone}}); err != nil {
		t.Errorf("a client certificate signed by caFile is accepted: %v", err)
	}
	if _, _, err := handshake(t, server, &tls.Config{InsecureSkipVerify: true}); err == nil {
		t.Error("a client with no certificate is rejected")
	}
}

func TestCAFileErrors(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "nope.crt")
	notPEM := writeFile(t, "ca.crt", []byte("not a certificate\n"))
	for path, want := range map[string]string{
		missing: "unable to read caFile " + missing + ": ",
		notPEM:  "unable to read caFile " + notPEM + ": no PEM certificate in it",
	} {
		_, _, _, err := TLSConfigs(&config.SecurityContext{CAFile: path})
		if err == nil || !strings.HasPrefix(err.Error(), want) {
			t.Errorf("%s: %v", path, err)
		}
	}
}

// A securityContext without certFile is valid: it serves nothing, and
// outbound TLS still has its client config.
func TestNoCertFileServesNothing(t *testing.T) {
	server, client, _, err := TLSConfigs(&config.SecurityContext{Client: &config.Client{AuthType: "DisabledAll"}})
	if err != nil || server != nil || client == nil || !client.InsecureSkipVerify {
		t.Errorf("%v %v %+v", err, server, client)
	}
}
