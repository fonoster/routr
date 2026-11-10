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
	"net/url"

	"google.golang.org/grpc"
	"google.golang.org/grpc/resolver"
)

// RoundRobin is the default service config of every connection to a peer:
// calls rotate over every address the name resolves to, so each replica
// behind a headless Service gets its share. gRPC's own default, pick_first,
// sends everything to the first.
const RoundRobin = `{"loadBalancingConfig":[{"round_robin":{}}]}`

// Target is the gRPC target for a peer's address: the address as given when
// it names a resolver gRPC knows (dns:///, unix:, passthrough:///, ...),
// dns:///addr otherwise, so a host:port resolves to all of its addresses.
func Target(addr string) string {
	if u, err := url.Parse(addr); err == nil && u.Scheme != "" && resolver.Get(u.Scheme) != nil {
		return addr
	}
	return "dns:///" + addr
}

// NewClient is grpc.NewClient on Target(addr), balancing round robin over
// the addresses the name resolves to. A service config the resolver returns
// takes precedence; opts come after the default, so a caller can override it.
func NewClient(addr string, opts ...grpc.DialOption) (*grpc.ClientConn, error) {
	return grpc.NewClient(Target(addr), append([]grpc.DialOption{grpc.WithDefaultServiceConfig(RoundRobin)}, opts...)...)
}
