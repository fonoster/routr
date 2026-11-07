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
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
)

// errUnauthenticated is the one answer a caller gets, whatever it got wrong.
var errUnauthenticated = status.Error(codes.Unauthenticated, "authentication required")

const bearerPrefix = "Bearer "

// What an unauthenticated caller reaches, for Guard.Exposes.
const (
	ExposesData      = "the Data API, with decrypted credentials and writes"
	ExposesRequester = "the Requester, which sends arbitrary SIP"
	ExposesLocation  = "the Location, its bindings and writes to them"
	ExposesProcessor = "the Processor service, which routes any SIP message it is handed"
)

// Guard says how a server's listener is protected and what is at stake.
type Guard struct {
	// Name is the service's name, as Listen is given it.
	Name string
	// Section is where its settings live, spec.data or spec, for the messages.
	Section string
	// BindAddr is where it will listen.
	BindAddr string
	// Auth is its section's settings.
	Auth config.ServerAuth
	// Exposes names what an unauthenticated caller reaches.
	Exposes string
	// Required refuses a listener beyond loopback that authenticates nobody,
	// unless Auth.Insecure says otherwise.
	Required bool
}

// Secure checks the guard and returns the server options that enforce it, to
// go before any other interceptor the caller passes to Listen. It reads the
// certificates: a file that can't be used stops the start. It logs a warning
// when the listener doesn't authenticate its callers or sends a key in clear.
func Secure(log *slog.Logger, g Guard) ([]grpc.ServerOption, error) {
	if log == nil {
		log = slog.Default()
	}
	loopback := isLoopback(g.BindAddr)
	if !g.Auth.Authenticated() {
		if g.Required && !loopback && !g.Auth.Insecure {
			return nil, fmt.Errorf("%[1]s: refusing to serve %[2]s on %[3]s with no authentication: set %[1]s.apiKeys or %[1]s.tls.clientCAFile, or %[1]s.insecure: true to accept that", g.Section, g.Exposes, g.BindAddr)
		}
		log.Warn("this gRPC service authenticates nobody", "service", g.Name, "bindAddr", g.BindAddr, "exposes", g.Exposes)
	}
	var opts []grpc.ServerOption
	mtls := false
	if g.Auth.TLS != nil {
		cfg, err := serverTLS(*g.Auth.TLS, g.Section)
		if err != nil {
			return nil, err
		}
		opts = append(opts, grpc.Creds(credentials.NewTLS(cfg)))
		mtls = cfg.ClientCAs != nil
	} else if len(g.Auth.APIKeys) > 0 && !loopback {
		log.Warn("this gRPC service takes API keys over plaintext: set tls so they cross the network encrypted", "service", g.Name, "bindAddr", g.BindAddr)
	}
	if !g.Auth.Authenticated() {
		return opts, nil
	}
	a := newAuthenticator(g.Auth.APIKeys, mtls)
	return append(opts, grpc.ChainUnaryInterceptor(a.unary), grpc.ChainStreamInterceptor(a.stream)), nil
}

// isLoopback says whether bindAddr only listens on this host. An empty or
// unspecified host listens everywhere; so may a name other than localhost.
func isLoopback(bindAddr string) bool {
	host, _, err := net.SplitHostPort(bindAddr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// serverTLS loads the certificates. A client certificate is verified when
// given, not demanded: the health service stays open to a probe with none and
// a caller may use an API key instead. The authenticator then requires one of
// the two. Its errors name the key, never the content of a file.
func serverTLS(spec config.ServerTLS, section string) (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(spec.CertFile, spec.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("%s.tls: unable to load certFile and keyFile: %w", section, err)
	}
	cfg := &tls.Config{MinVersion: tls.VersionTLS12, Certificates: []tls.Certificate{cert}}
	if spec.ClientCAFile == "" {
		return cfg, nil
	}
	pool, err := certPool(spec.ClientCAFile)
	if err != nil {
		return nil, fmt.Errorf("%s.tls.clientCAFile: %w", section, err)
	}
	cfg.ClientCAs = pool
	cfg.ClientAuth = tls.VerifyClientCertIfGiven
	return cfg, nil
}

func certPool(path string) (*x509.CertPool, error) {
	pem, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pem) {
		return nil, errors.New("holds no PEM certificate")
	}
	return pool, nil
}

// openMethods need no authentication: an orchestrator's probe has no key.
var openMethods = map[string]bool{
	"/" + healthpb.Health_ServiceDesc.ServiceName + "/Check": true,
	"/" + healthpb.Health_ServiceDesc.ServiceName + "/List":  true,
	"/" + healthpb.Health_ServiceDesc.ServiceName + "/Watch": true,
}

// authenticator lets a call through with a verified client certificate or a
// known API key. The keys are kept as digests, so every comparison is of the
// same length and nothing about a key's length or content shows in its timing.
type authenticator struct {
	digests [][sha256.Size]byte
	mtls    bool
	compare func(x, y []byte) int
}

func newAuthenticator(keys []string, mtls bool) *authenticator {
	digests := make([][sha256.Size]byte, len(keys))
	for i, key := range keys {
		digests[i] = sha256.Sum256([]byte(key))
	}
	return &authenticator{digests: digests, mtls: mtls, compare: subtle.ConstantTimeCompare}
}

func (a *authenticator) unary(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	if err := a.authorize(ctx, info.FullMethod); err != nil {
		return nil, err
	}
	return handler(ctx, req)
}

func (a *authenticator) stream(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	if err := a.authorize(ss.Context(), info.FullMethod); err != nil {
		return err
	}
	return handler(srv, ss)
}

func (a *authenticator) authorize(ctx context.Context, method string) error {
	if openMethods[method] || (a.mtls && hasVerifiedCert(ctx)) || a.knows(bearerToken(ctx)) {
		return nil
	}
	return errUnauthenticated
}

// knows compares the token with every key, even after a match, so the time
// taken doesn't say which key matched or whether one did.
func (a *authenticator) knows(token string) bool {
	digest := sha256.Sum256([]byte(token))
	matched := 0
	for i := range a.digests {
		matched |= a.compare(a.digests[i][:], digest[:])
	}
	return matched == 1
}

// bearerToken is the key of the call's authorization metadata; "" when it has
// none. Keys are never empty, so "" matches nothing.
func bearerToken(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	values := md.Get("authorization")
	if len(values) == 0 || len(values[0]) < len(bearerPrefix) || !strings.EqualFold(values[0][:len(bearerPrefix)], bearerPrefix) {
		return ""
	}
	return values[0][len(bearerPrefix):]
}

// hasVerifiedCert says whether the caller's certificate chained to the client
// CA. tls.VerifyClientCertIfGiven fails the handshake of one that doesn't.
func hasVerifiedCert(ctx context.Context) bool {
	p, ok := peer.FromContext(ctx)
	if !ok {
		return false
	}
	info, ok := p.AuthInfo.(credentials.TLSInfo)
	return ok && len(info.State.VerifiedChains) > 0
}
