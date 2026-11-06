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

package one

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/data"
)

// writeMethods are the Data API's writes, by the kind they write. A write
// that succeeds through the served API invalidates the cache (ROUTR3.md
// § 3.4); the writes themselves are Unimplemented until milestone 2, so the
// hook waits for them.
var writeMethods = map[string]data.Kind{
	acl.ACLService_Create_FullMethodName: data.KindACL,
	acl.ACLService_Update_FullMethodName: data.KindACL,
	acl.ACLService_Delete_FullMethodName: data.KindACL,

	agents.Agents_Create_FullMethodName: data.KindAgent,
	agents.Agents_Update_FullMethodName: data.KindAgent,
	agents.Agents_Delete_FullMethodName: data.KindAgent,

	credentials.CredentialsService_Create_FullMethodName: data.KindCredentials,
	credentials.CredentialsService_Update_FullMethodName: data.KindCredentials,
	credentials.CredentialsService_Delete_FullMethodName: data.KindCredentials,

	domains.Domains_Create_FullMethodName: data.KindDomain,
	domains.Domains_Update_FullMethodName: data.KindDomain,
	domains.Domains_Delete_FullMethodName: data.KindDomain,

	numbers.Numbers_Create_FullMethodName: data.KindNumber,
	numbers.Numbers_Update_FullMethodName: data.KindNumber,
	numbers.Numbers_Delete_FullMethodName: data.KindNumber,

	peers.Peers_Create_FullMethodName: data.KindPeer,
	peers.Peers_Update_FullMethodName: data.KindPeer,
	peers.Peers_Delete_FullMethodName: data.KindPeer,

	trunks.Trunks_Create_FullMethodName: data.KindTrunk,
	trunks.Trunks_Update_FullMethodName: data.KindTrunk,
	trunks.Trunks_Delete_FullMethodName: data.KindTrunk,
}

// invalidateOnWrite is the interceptor of the served Data API: after a
// write succeeds it drops from the cache the row written (the resource
// Create and Update answer with; the request's ref for Delete, which
// answers Empty) and every kind that embeds it.
func invalidateOnWrite(cache *FindCache) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		resp, err := handler(ctx, req)
		if err != nil {
			return resp, err
		}
		if kind, ok := writeMethods[info.FullMethod]; ok {
			cache.Invalidate(kind, writtenRow(req, resp))
		}
		return resp, nil
	}
}

// writtenRow is the message that names what a write touched: the answer,
// unless it is Empty, then the request.
func writtenRow(req, resp any) proto.Message {
	if row, ok := resp.(proto.Message); ok {
		if _, empty := resp.(*emptypb.Empty); !empty {
			return row
		}
	}
	row, _ := req.(proto.Message)
	return row
}
