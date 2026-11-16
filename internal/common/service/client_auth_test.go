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
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
)

// callWith makes one call to the Processor at addr over these dial options,
// whatever address they were made for.
func callWith(t *testing.T, addr string, opts []grpc.DialOption) error {
	t.Helper()
	conn, err := grpc.NewClient(addr, opts...)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = processor.NewProcessorClient(conn).ProcessMessage(ctx, &processor.MessageRequest{})
	return err
}

func TestDialCredentialsRefusesAKeyInClearBeyondLoopback(t *testing.T) {
	const remote = "10.0.0.5:51907"
	keyed := serve(t, config.ServerAuth{APIKeys: []string{testKey}})

	t.Run("refused", func(t *testing.T) {
		for _, addr := range []string{remote, "apiserver:51907", "dns:///localhost:51907", "0.0.0.0:51907", ":51907"} {
			opts, err := DialCredentials(config.ClientAuth{APIKey: testKey}, addr)
			want := "apiKey would go in clear to " + addr + "; set tls, or insecure: true to accept that"
			if err == nil || err.Error() != want || opts != nil {
				t.Errorf("%s: got %v, want %q", addr, err, want)
			}
			if err != nil && strings.Contains(err.Error(), testKey) {
				t.Errorf("%s: the error carries the key: %v", addr, err)
			}
		}
	})

	t.Run("loopback", func(t *testing.T) {
		for _, addr := range []string{"127.0.0.1:51907", "127.8.9.10:51907", "localhost:51907", "[::1]:51907"} {
			opts, err := DialCredentials(config.ClientAuth{APIKey: testKey}, addr)
			if err != nil {
				t.Errorf("%s: %v", addr, err)
				continue
			}
			if err := callWith(t, keyed, opts); err != nil {
				t.Errorf("%s: the key in clear: %v", addr, err)
			}
		}
	})

	t.Run("insecure: true", func(t *testing.T) {
		opts, err := DialCredentials(config.ClientAuth{APIKey: testKey, Insecure: true}, remote)
		if err != nil {
			t.Fatal(err)
		}
		if err := callWith(t, keyed, opts); err != nil {
			t.Errorf("plaintext with the key: %v", err)
		}
	})

	t.Run("tls with insecure: true stays verified TLS", func(t *testing.T) {
		dir := t.TempDir()
		ca, other := newCA(t), newCA(t)
		cert, key := ca.issue(t, dir, "server")
		secured := serve(t, config.ServerAuth{APIKeys: []string{testKey}, TLS: &config.ServerTLS{CertFile: cert, KeyFile: key}})
		dial := func(caFile string) []grpc.DialOption {
			auth := config.ClientAuth{APIKey: testKey, Insecure: true, TLS: &config.ClientTLS{CAFile: caFile, ServerName: "localhost"}}
			opts, err := DialCredentials(auth, remote)
			if err != nil {
				t.Fatal(err)
			}
			return opts
		}
		trusted := dial(ca.write(t, dir, "ca.pem"))
		if err := callWith(t, secured, trusted); err != nil {
			t.Errorf("over TLS: %v", err)
		}
		if err := callWith(t, keyed, trusted); err == nil {
			t.Error("reached a plaintext server: insecure turned TLS off")
		}
		if err := callWith(t, secured, dial(other.write(t, dir, "other.pem"))); err == nil {
			t.Error("a certificate of another CA passed: insecure turned verification off")
		}
	})

	t.Run("no key", func(t *testing.T) {
		opts, err := DialCredentials(config.ClientAuth{}, remote)
		if err != nil {
			t.Fatal(err)
		}
		if err := callWith(t, serve(t, config.ServerAuth{}), opts); err != nil {
			t.Errorf("plaintext with no key: %v", err)
		}
	})
}
