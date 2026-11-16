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
	"crypto/tls"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
)

// DialCredentials are the dial options for the peer at addr: TLS when auth.TLS
// is there, plaintext otherwise, and the API key on every call when there is
// one. A key that would go in clear to a host that isn't loopback is refused
// unless auth.Insecure accepts that; Insecure never changes a TLS connection.
// Loopback is what addr says (localhost, 127.0.0.0/8, ::1), never what a name
// resolves to. Only a cmd dials, and it reads the file. Its errors name what
// failed and the address, never a value.
func DialCredentials(auth config.ClientAuth, addr string) ([]grpc.DialOption, error) {
	if auth.APIKey != "" && auth.TLS == nil && !auth.Insecure && !isLoopback(addr) {
		return nil, fmt.Errorf("apiKey would go in clear to %s; set tls, or insecure: true to accept that", addr)
	}
	transport := insecure.NewCredentials()
	if auth.TLS != nil {
		cfg, err := clientTLS(*auth.TLS)
		if err != nil {
			return nil, err
		}
		transport = credentials.NewTLS(cfg)
	}
	opts := []grpc.DialOption{grpc.WithTransportCredentials(transport)}
	if auth.APIKey != "" {
		opts = append(opts, grpc.WithPerRPCCredentials(bearer(auth.APIKey)))
	}
	return opts, nil
}

func clientTLS(spec config.ClientTLS) (*tls.Config, error) {
	cfg := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: spec.ServerName}
	if spec.CAFile != "" {
		pool, err := certPool(spec.CAFile)
		if err != nil {
			return nil, fmt.Errorf("tls.caFile: %w", err)
		}
		cfg.RootCAs = pool
	}
	if spec.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(spec.CertFile, spec.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("tls: unable to load certFile and keyFile: %w", err)
		}
		cfg.Certificates = []tls.Certificate{cert}
	}
	return cfg, nil
}

// bearer sends an API key. It works over plaintext as well: DialCredentials
// decides when that is allowed, toward loopback or with insecure: true.
type bearer string

// GetRequestMetadata implements credentials.PerRPCCredentials.
func (b bearer) GetRequestMetadata(context.Context, ...string) (map[string]string, error) {
	return map[string]string{"authorization": bearerPrefix + string(b)}, nil
}

// RequireTransportSecurity implements credentials.PerRPCCredentials.
func (bearer) RequireTransportSecurity() bool {
	return false
}
