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

// Package registry sends the periodic REGISTER of the Trunks that ask for one
// (sendRegister), ported from mods/registry/src. Every interval a round asks
// the Data API for those Trunks, skips the ones with a live entry in the
// Store, sends the others' REGISTER through the Requester and stores what came
// back. It serves no gRPC.
package registry

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	requesterpb "github.com/fonoster/routr/internal/common/pb/requester"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// callTimeout bounds a call to the Data API or the Requester, so a peer that
// never answers can't keep a round alive. The Requester answers 408 itself
// when a provider stays silent (64*T1, 32 s).
const callTimeout = 60 * time.Second

// Dependencies are the peers of a Registry.
type Dependencies struct {
	Requester requesterpb.RequesterClient
	Trunks    trunks.TrunksClient
	// Store, when nil, is the one spec.cache names.
	Store Store
}

// Options are the optional parts of a Registry.
type Options struct {
	Logger *slog.Logger
	// Now defaults to time.Now.
	Now func() time.Time
}

// Registry is the registration loop. Its owner calls Run once and ends it
// through the context.
type Registry struct {
	spec     Spec
	interval time.Duration
	seconds  float64

	requester requesterpb.RequesterClient
	trunks    trunks.TrunksClient
	store     Store
	builder   *requestBuilder
	now       func() time.Time
	log       *slog.Logger
}

// New builds a Registry. It refuses a provider it has no store for, such as
// redis until milestone 3.
func New(spec Spec, deps Dependencies, opts Options) (*Registry, error) {
	if deps.Requester == nil {
		return nil, errors.New("the registry needs a Requester client")
	}
	if deps.Trunks == nil {
		return nil, errors.New("the registry needs a Trunks client")
	}
	seconds := spec.RegisterInterval
	if seconds == 0 {
		seconds = defaultRegisterInterval
	}
	interval := time.Duration(seconds * float64(time.Second))
	if interval <= 0 {
		return nil, errors.New("spec.registerInterval should be > 0")
	}
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	store := deps.Store
	if store == nil {
		var err error
		if store, err = newStore(spec.Cache, now); err != nil {
			return nil, err
		}
	}
	return &Registry{
		spec:      spec,
		interval:  interval,
		seconds:   seconds,
		requester: deps.Requester,
		trunks:    deps.Trunks,
		store:     store,
		builder:   newRequestBuilder(now),
		now:       now,
		log:       logger,
	}, nil
}

// Run starts a round every interval, the first one an interval from now, until
// ctx ends, then waits for the rounds still running. As in Routr 2 a slow
// round doesn't hold back the next one: a Trunk still unanswered is sent again.
func (r *Registry) Run(ctx context.Context) {
	r.log.Info("starting registry service", "registerInterval", r.seconds)
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	var rounds sync.WaitGroup
	defer rounds.Wait()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rounds.Go(func() { r.round(ctx) })
		}
	}
}

// round registers every Trunk that is due, in parallel, and returns when all
// of them have answered or failed.
func (r *Registry) round(ctx context.Context) {
	r.log.Debug("starting registration process")

	findCtx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	candidates, err := findTrunks(findCtx, r.trunks)
	if err != nil {
		r.log.Error("failed to retrieve trunks from API", "error", err)
		return
	}
	due, err := unregisteredTrunks(ctx, r.store, candidates)
	if err != nil {
		r.log.Error("failed to read the store", "error", err)
		return
	}

	var sends sync.WaitGroup
	for _, trunk := range due {
		// Built here, in order, so CSeq follows the order of the Trunks
		ref := trunk.GetRef()
		request, err := r.buildRequest(trunk)
		if err != nil {
			r.log.Error("request rejected", "trunkRef", ref, "error", err)
			continue
		}
		sends.Go(func() { r.send(ctx, ref, request) })
	}
	sends.Wait()
}

func (r *Registry) buildRequest(trunk *trunks.Trunk) (*requesterpb.SendMessageRequest, error) {
	params, err := requestParamsFromTrunk(trunk, r.spec)
	if err != nil {
		return nil, err
	}
	return r.builder.build(params)
}

// send sends one REGISTER and stores what came back.
func (r *Registry) send(ctx context.Context, ref string, request *requesterpb.SendMessageRequest) {
	sendCtx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	res, err := r.requester.SendMessage(sendCtx, request)
	if err != nil {
		r.log.Error("request rejected", "trunkRef", ref, "error", err)
		return
	}
	message := res.GetMessage()
	if message == nil {
		r.log.Error("request rejected", "trunkRef", ref, "error", "the Requester answered no message")
		return
	}

	entry := Entry{
		TrunkRef:               ref,
		TimeOfEntry:            r.now().UnixMilli(),
		RetentionTimeInSeconds: retentionSeconds(message, r.seconds),
		Status:                 statusOf(message),
	}
	r.log.Debug("storing trunk in registry", "trunkRef", ref, "status", entry.Status, "retentionTime", entry.RetentionTimeInSeconds)
	if err := r.store.Put(ctx, ref, entry); err != nil {
		r.log.Error("failed to store the trunk", "trunkRef", ref, "error", err)
	}
}

// retentionSeconds keeps a Trunk out of the rounds until one interval before
// its registration ends, so the next REGISTER goes out in time. A Contact
// without an expires parameter reads -1 and makes the Trunk due on the next
// round: the header decides whenever it is there, as in Routr 2.
func retentionSeconds(message *sipmessage.SIPMessage, intervalSeconds float64) float64 {
	expires := int32(defaultExpires)
	if contact := message.GetContact(); contact != nil {
		expires = contact.GetExpires()
	} else if header := message.GetExpires(); header != nil {
		expires = header.GetExpires()
	}
	return float64(expires) - intervalSeconds
}

func statusOf(message *sipmessage.SIPMessage) Status {
	if message.GetResponseType() == sipmessage.ResponseType_OK {
		return StatusRegistered
	}
	return StatusQuarantine
}
