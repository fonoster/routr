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

	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/data"
)

// The cached clients are the Data API clients Connect and the Registry use: the
// in-process adapter with the FindCache in front of FindBy, the lookup Connect makes on
// every call. Get and List go straight through, as they did in Routr 2.

// findCached runs one FindBy through the cache, typed.
func findCached[R any](c *FindCache, kind data.Kind, field, value string, load func() (R, error), isEmpty func(R) bool) (R, error) {
	v, err := c.GetOrLoad(kind, field, value,
		func() (any, error) { return load() },
		func(v any) bool { return isEmpty(v.(R)) })
	if err != nil {
		var zero R
		return zero, err
	}
	return v.(R), nil
}

// cachedAgents is an agents.AgentsClient whose FindBy answers come from the
// cache.
type cachedAgents struct {
	agents.AgentsClient
	cache *FindCache
}

func (c cachedAgents) FindBy(ctx context.Context, in *agents.FindByRequest, opts ...grpc.CallOption) (*agents.FindByResponse, error) {
	return findCached(c.cache, data.KindAgent, in.GetFieldName(), in.GetFieldValue(),
		func() (*agents.FindByResponse, error) { return c.AgentsClient.FindBy(ctx, in, opts...) },
		func(r *agents.FindByResponse) bool { return len(r.GetItems()) == 0 })
}

// cachedDomains is a domains.DomainsClient whose FindBy answers come from
// the cache.
type cachedDomains struct {
	domains.DomainsClient
	cache *FindCache
}

func (c cachedDomains) FindBy(ctx context.Context, in *domains.FindByRequest, opts ...grpc.CallOption) (*domains.FindByResponse, error) {
	return findCached(c.cache, data.KindDomain, in.GetFieldName(), in.GetFieldValue(),
		func() (*domains.FindByResponse, error) { return c.DomainsClient.FindBy(ctx, in, opts...) },
		func(r *domains.FindByResponse) bool { return len(r.GetItems()) == 0 })
}

// cachedTrunks is a trunks.TrunksClient whose FindBy answers come from the
// cache.
type cachedTrunks struct {
	trunks.TrunksClient
	cache *FindCache
}

func (c cachedTrunks) FindBy(ctx context.Context, in *trunks.FindByRequest, opts ...grpc.CallOption) (*trunks.FindByResponse, error) {
	return findCached(c.cache, data.KindTrunk, in.GetFieldName(), in.GetFieldValue(),
		func() (*trunks.FindByResponse, error) { return c.TrunksClient.FindBy(ctx, in, opts...) },
		func(r *trunks.FindByResponse) bool { return len(r.GetItems()) == 0 })
}

// cachedNumbers is a numbers.NumbersClient whose FindBy answers come from the
// cache.
type cachedNumbers struct {
	numbers.NumbersClient
	cache *FindCache
}

func (c cachedNumbers) FindBy(ctx context.Context, in *numbers.FindByRequest, opts ...grpc.CallOption) (*numbers.FindByResponse, error) {
	return findCached(c.cache, data.KindNumber, in.GetFieldName(), in.GetFieldValue(),
		func() (*numbers.FindByResponse, error) { return c.NumbersClient.FindBy(ctx, in, opts...) },
		func(r *numbers.FindByResponse) bool { return len(r.GetItems()) == 0 })
}

// cachedPeers is a peers.PeersClient whose FindBy answers come from the cache.
type cachedPeers struct {
	peers.PeersClient
	cache *FindCache
}

func (c cachedPeers) FindBy(ctx context.Context, in *peers.FindByRequest, opts ...grpc.CallOption) (*peers.FindByResponse, error) {
	return findCached(c.cache, data.KindPeer, in.GetFieldName(), in.GetFieldValue(),
		func() (*peers.FindByResponse, error) { return c.PeersClient.FindBy(ctx, in, opts...) },
		func(r *peers.FindByResponse) bool { return len(r.GetItems()) == 0 })
}
