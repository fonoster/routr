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

package service

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"log/slog"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
)

const testKey = "a-key-only-this-test-knows"

// serve runs a Processor behind the guard's options and returns its address.
func serve(t *testing.T, auth config.ServerAuth) string {
	t.Helper()
	log := slog.New(slog.DiscardHandler)
	opts, err := Secure(log, Guard{Name: "test", Section: "spec", BindAddr: "127.0.0.1:0", Auth: auth, Exposes: "it"})
	if err != nil {
		t.Fatal(err)
	}
	s, err := Listen(log, "test", "127.0.0.1:0", func(r grpc.ServiceRegistrar) { processor.RegisterProcessorServer(r, panicking{}) }, opts...)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Serve(ctx) }()
	t.Cleanup(func() {
		cancel()
		<-done
	})
	return s.Addr()
}

// call makes one call to the Processor and one to health, with these credentials.
func call(t *testing.T, addr string, auth config.ClientAuth) (callErr, healthErr error) {
	t.Helper()
	creds, err := DialCredentials(auth, addr)
	if err != nil {
		t.Fatal(err)
	}
	conn, err := grpc.NewClient(addr, creds...)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, callErr = processor.NewProcessorClient(conn).ProcessMessage(ctx, &processor.MessageRequest{})
	_, healthErr = healthpb.NewHealthClient(conn).Check(ctx, &healthpb.HealthCheckRequest{})
	return callErr, healthErr
}

func wantUnauthenticated(t *testing.T, err error) {
	t.Helper()
	if status.Code(err) != codes.Unauthenticated || status.Convert(err).Message() != "authentication required" {
		t.Errorf("want the fixed UNAUTHENTICATED: %v", err)
	}
}

func TestAPIKey(t *testing.T) {
	addr := serve(t, config.ServerAuth{APIKeys: []string{"another-key", testKey}})
	for name, key := range map[string]string{"no key": "", "bad key": "not-the-key", "a prefix of the key": testKey[:5]} {
		t.Run(name, func(t *testing.T) {
			callErr, healthErr := call(t, addr, config.ClientAuth{APIKey: key})
			wantUnauthenticated(t, callErr)
			if healthErr != nil {
				t.Errorf("health stays open: %v", healthErr)
			}
		})
	}
	t.Run("a known key", func(t *testing.T) {
		if callErr, _ := call(t, addr, config.ClientAuth{APIKey: testKey}); callErr != nil {
			t.Error(callErr)
		}
	})
}

func TestTheSchemeIsBearer(t *testing.T) {
	a := newAuthenticator([]string{testKey}, false)
	for value, want := range map[string]bool{
		"Bearer " + testKey: true,
		"bearer " + testKey: true,
		"Basic " + testKey:  false,
		testKey:             false,
		"Bearer ":           false,
		"":                  false,
	} {
		ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("authorization", value))
		if got := a.authorize(ctx, "/some.Service/Method") == nil; got != want {
			t.Errorf("%q: %v, want %v", value, got, want)
		}
	}
	if err := a.authorize(context.Background(), "/some.Service/Method"); err == nil {
		t.Error("no metadata at all passed")
	}
}

// Every key is compared, whatever the outcome, and always digests of one length.
func TestEveryComparisonIsTheSame(t *testing.T) {
	keys := []string{testKey, "short", strings.Repeat("long", 100)}
	a := newAuthenticator(keys, false)
	compared := 0
	real := a.compare
	a.compare = func(x, y []byte) int {
		compared++
		if len(x) != len(y) {
			t.Errorf("lengths differ: %d and %d", len(x), len(y))
		}
		return real(x, y)
	}
	for token, want := range map[string]bool{testKey: true, "short": true, "": false, "unknown": false} {
		compared = 0
		if got := a.knows(token); got != want {
			t.Errorf("%q: %v, want %v", token, got, want)
		}
		if compared != len(keys) {
			t.Errorf("%q: compared %d keys, want %d", token, compared, len(keys))
		}
	}
}

type streamWith struct {
	grpc.ServerStream
	ctx context.Context
}

func (s streamWith) Context() context.Context { return s.ctx }

func TestStreamsAreGuarded(t *testing.T) {
	a := newAuthenticator([]string{testKey}, false)
	ran := false
	handler := func(any, grpc.ServerStream) error {
		ran = true
		return nil
	}
	ctx := context.Background()
	wantUnauthenticated(t, a.stream(nil, streamWith{ctx: ctx}, &grpc.StreamServerInfo{FullMethod: "/some.Service/Watch"}, handler))
	if ran {
		t.Error("the handler ran with no key")
	}
	if err := a.stream(nil, streamWith{ctx: ctx}, &grpc.StreamServerInfo{FullMethod: "/grpc.health.v1.Health/Watch"}, handler); err != nil || !ran {
		t.Errorf("health is open to streams too: %v", err)
	}
}

func TestMutualTLS(t *testing.T) {
	dir := t.TempDir()
	ca := newCA(t)
	other := newCA(t)
	cert, key := ca.issue(t, dir, "server")
	clientCert, clientKey := ca.issue(t, dir, "client")
	strangerCert, strangerKey := other.issue(t, dir, "stranger")
	caFile := ca.write(t, dir, "ca.pem")

	addr := serve(t, config.ServerAuth{
		APIKeys: []string{testKey},
		TLS:     &config.ServerTLS{CertFile: cert, KeyFile: key, ClientCAFile: caFile},
	})
	trust := func(certFile, keyFile string) *config.ClientTLS {
		return &config.ClientTLS{CAFile: caFile, CertFile: certFile, KeyFile: keyFile, ServerName: "localhost"}
	}

	t.Run("a certificate of the CA suffices", func(t *testing.T) {
		if callErr, _ := call(t, addr, config.ClientAuth{TLS: trust(clientCert, clientKey)}); callErr != nil {
			t.Error(callErr)
		}
	})
	t.Run("so does a key over TLS", func(t *testing.T) {
		if callErr, _ := call(t, addr, config.ClientAuth{APIKey: testKey, TLS: trust("", "")}); callErr != nil {
			t.Error(callErr)
		}
	})
	t.Run("neither is refused, and health stays open", func(t *testing.T) {
		callErr, healthErr := call(t, addr, config.ClientAuth{TLS: trust("", "")})
		wantUnauthenticated(t, callErr)
		if healthErr != nil {
			t.Errorf("health stays open: %v", healthErr)
		}
	})
	t.Run("a certificate of another CA fails the handshake, even with a key", func(t *testing.T) {
		callErr, _ := call(t, addr, config.ClientAuth{APIKey: testKey, TLS: trust(strangerCert, strangerKey)})
		if callErr == nil {
			t.Error("the stranger got through")
		}
	})
	t.Run("a client that doesn't trust the server gets nowhere", func(t *testing.T) {
		callErr, _ := call(t, addr, config.ClientAuth{APIKey: testKey, TLS: &config.ClientTLS{ServerName: "localhost"}})
		if status.Code(callErr) != codes.Unavailable {
			t.Errorf("want UNAVAILABLE: %v", callErr)
		}
	})
	t.Run("plaintext gets nowhere", func(t *testing.T) {
		callErr, _ := call(t, addr, config.ClientAuth{APIKey: testKey})
		if callErr == nil {
			t.Error("plaintext reached a TLS listener")
		}
	})
}

func TestAClientCAAloneAuthenticates(t *testing.T) {
	dir := t.TempDir()
	ca := newCA(t)
	cert, key := ca.issue(t, dir, "server")
	addr := serve(t, config.ServerAuth{TLS: &config.ServerTLS{CertFile: cert, KeyFile: key, ClientCAFile: ca.write(t, dir, "ca.pem")}})
	callErr, _ := call(t, addr, config.ClientAuth{APIKey: testKey, TLS: &config.ClientTLS{CAFile: ca.write(t, dir, "ca.pem"), ServerName: "localhost"}})
	wantUnauthenticated(t, callErr)
}

func TestSecureRefusesAnExposedService(t *testing.T) {
	required := func(addr string, auth config.ServerAuth) error {
		_, err := Secure(slog.New(slog.DiscardHandler), Guard{Name: "data", Section: "spec.data", BindAddr: addr, Auth: auth, Exposes: ExposesData, Required: true})
		return err
	}
	err := required("0.0.0.0:51907", config.ServerAuth{})
	if err == nil {
		t.Fatal("started with nothing configured")
	}
	for _, want := range []string{"spec.data.apiKeys", "spec.data.tls.clientCAFile", "spec.data.insecure", "0.0.0.0:51907", ExposesData} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("the error names %q: %v", want, err)
		}
	}

	dir := t.TempDir()
	cert, key := newCA(t).issue(t, dir, "server")
	if err := required("10.0.0.1:51907", config.ServerAuth{TLS: &config.ServerTLS{CertFile: cert, KeyFile: key}}); err == nil {
		t.Error("TLS alone encrypts and authenticates nobody: it is refused")
	}
	for name, tc := range map[string]struct {
		addr string
		auth config.ServerAuth
	}{
		"loopback":     {"127.0.0.1:51907", config.ServerAuth{}},
		"localhost":    {"localhost:51907", config.ServerAuth{}},
		"IPv6":         {"[::1]:51907", config.ServerAuth{}},
		"insecure":     {"0.0.0.0:51907", config.ServerAuth{Insecure: true}},
		"an API key":   {"0.0.0.0:51907", config.ServerAuth{APIKeys: []string{testKey}}},
		"insecure key": {"0.0.0.0:51907", config.ServerAuth{APIKeys: []string{testKey}, Insecure: true}},
	} {
		if err := required(tc.addr, tc.auth); err != nil {
			t.Errorf("%s: %v", name, err)
		}
	}
	if _, err := Secure(slog.New(slog.DiscardHandler), Guard{Name: "location", Section: "spec", BindAddr: "0.0.0.0:51902", Exposes: ExposesLocation}); err != nil {
		t.Errorf("only what asks for it is refused: %v", err)
	}
}

func TestInsecureDoesNotTurnAuthenticationOff(t *testing.T) {
	addr := serve(t, config.ServerAuth{APIKeys: []string{testKey}, Insecure: true})
	callErr, _ := call(t, addr, config.ClientAuth{})
	wantUnauthenticated(t, callErr)
}

func TestSecureWarnsAndNeverLogsAKey(t *testing.T) {
	var out bytes.Buffer
	log := slog.New(slog.NewTextHandler(&out, nil))
	if _, err := Secure(log, Guard{Name: "location", Section: "spec", BindAddr: "0.0.0.0:51902", Exposes: ExposesLocation}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "level=WARN") || !strings.Contains(out.String(), ExposesLocation) {
		t.Errorf("a warning names what is exposed:\n%s", out.String())
	}

	out.Reset()
	if _, err := Secure(log, Guard{Name: "data", Section: "spec.data", BindAddr: "0.0.0.0:51907", Auth: config.ServerAuth{APIKeys: []string{testKey}}, Required: true}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "plaintext") {
		t.Errorf("a key over plaintext gets a warning:\n%s", out.String())
	}
	if strings.Contains(out.String(), testKey) {
		t.Errorf("the key was logged:\n%s", out.String())
	}
}

func TestSecureStopsOnABadFile(t *testing.T) {
	dir := t.TempDir()
	cert, key := newCA(t).issue(t, dir, "server")
	notPEM := filepath.Join(dir, "not.pem")
	if err := os.WriteFile(notPEM, []byte("no certificate here"), 0o600); err != nil {
		t.Fatal(err)
	}
	for name, tc := range map[string]struct {
		spec config.ServerTLS
		want string
	}{
		"no cert":   {config.ServerTLS{CertFile: filepath.Join(dir, "missing"), KeyFile: key}, "spec.tls"},
		"no CA":     {config.ServerTLS{CertFile: cert, KeyFile: key, ClientCAFile: filepath.Join(dir, "missing")}, "spec.tls.clientCAFile"},
		"bad CA":    {config.ServerTLS{CertFile: cert, KeyFile: key, ClientCAFile: notPEM}, "spec.tls.clientCAFile"},
		"bad chain": {config.ServerTLS{CertFile: notPEM, KeyFile: key}, "spec.tls"},
	} {
		spec := tc.spec
		_, err := Secure(slog.New(slog.DiscardHandler), Guard{Name: "x", Section: "spec", BindAddr: "127.0.0.1:0", Auth: config.ServerAuth{TLS: &spec}})
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: names %s: %v", name, tc.want, err)
		}
	}
}

func TestDialCredentialsStopsOnABadFile(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing")
	for name, spec := range map[string]config.ClientTLS{
		"no CA":   {CAFile: missing},
		"no cert": {CertFile: missing, KeyFile: missing},
	} {
		if _, err := DialCredentials(config.ClientAuth{TLS: &spec}, "127.0.0.1:51907"); err == nil {
			t.Errorf("%s: no error", name)
		}
	}
}

// testCA issues the test's certificates.
type testCA struct {
	cert *x509.Certificate
	der  []byte
	key  *ecdsa.PrivateKey
}

func newCA(t *testing.T) *testCA {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber:          big.NewInt(time.Now().UnixNano()),
		Subject:               pkix.Name{CommonName: "routr test CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	return &testCA{cert: cert, der: der, key: key}
}

func (ca *testCA) write(t *testing.T, dir, name string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	writePEM(t, path, "CERTIFICATE", ca.der)
	return path
}

// issue writes a certificate for localhost, good for either end of a connection,
// and returns its files.
func (ca *testCA) issue(t *testing.T, dir, name string) (certFile, keyFile string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: name},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		DNSNames:     []string{"localhost"},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, ca.cert, &key.PublicKey, ca.key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	certFile, keyFile = filepath.Join(dir, name+".crt"), filepath.Join(dir, name+".key")
	writePEM(t, certFile, "CERTIFICATE", der)
	writePEM(t, keyFile, "EC PRIVATE KEY", keyDER)
	return certFile, keyFile
}

func writePEM(t *testing.T, path, kind string, der []byte) {
	t.Helper()
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: kind, Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
}

var _ credentials.PerRPCCredentials = bearer("")
