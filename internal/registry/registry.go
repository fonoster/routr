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
	"strconv"
	"strings"
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

// failedRefreshBackoff is how long, in seconds, a Trunk the provider refused
// waits for its next REGISTER. Routr 2 kept it out for the 600 s of a REGISTER
// that worked, minus the interval: that long with no DIDs after a blip.
const failedRefreshBackoff = 30

// minExpiresHeader names what a 423 asks for (RFC 3261 section 10.3).
const minExpiresHeader = "Min-Expires"

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

	mu sync.Mutex
	// inFlight are the Trunks with a REGISTER on its way
	inFlight map[string]struct{}
	// minExpires are the Expires the providers of Trunks asked for with a 423
	minExpires map[string]int32
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

		inFlight:   map[string]struct{}{},
		minExpires: map[string]int32{},
	}, nil
}

// Run starts a round every interval, the first one an interval from now, until
// ctx ends, then waits for the rounds still running. As in Routr 2 a slow
// round doesn't hold back the next one, but a Trunk still unanswered is not sent
// again (Routr 2 did: two REGISTERs at once, with different Call-IDs).
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
		if !r.acquire(ref) {
			r.log.Debug("the last REGISTER is still unanswered", "trunkRef", ref)
			continue
		}
		request, err := r.buildRequest(trunk)
		if err != nil {
			r.release(ref)
			r.log.Error("request rejected", "trunkRef", ref, "error", err)
			continue
		}
		sends.Go(func() {
			defer r.release(ref)
			r.send(ctx, ref, request)
		})
	}
	sends.Wait()
}

// acquire takes the Trunk's in-flight slot; false when a REGISTER holds it.
func (r *Registry) acquire(ref string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, busy := r.inFlight[ref]; busy {
		return false
	}
	r.inFlight[ref] = struct{}{}
	return true
}

func (r *Registry) release(ref string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.inFlight, ref)
}

func (r *Registry) buildRequest(trunk *trunks.Trunk) (*requesterpb.SendMessageRequest, error) {
	params, err := requestParamsFromTrunk(trunk, r.spec)
	if err != nil {
		return nil, err
	}
	r.mu.Lock()
	params.Expires = r.minExpires[trunk.GetRef()]
	r.mu.Unlock()
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
		RetentionTimeInSeconds: r.retention(ref, message),
		Status:                 statusOf(message),
	}
	r.log.Debug("storing trunk in registry", "trunkRef", ref, "status", entry.Status, "retentionTime", entry.RetentionTimeInSeconds)
	if err := r.store.Put(ctx, ref, entry); err != nil {
		r.log.Error("failed to store the trunk", "trunkRef", ref, "error", err)
	}
}

// retention is how long a Trunk stays out of the rounds after this answer. A
// 423 that names what it wants goes out again on the next round, asking for it;
// any other refusal waits failedRefreshBackoff.
func (r *Registry) retention(ref string, message *sipmessage.SIPMessage) float64 {
	if statusOf(message) == StatusRegistered {
		return retentionSeconds(message, r.seconds)
	}
	if message.GetResponseType() == sipmessage.ResponseType_INTERVAL_TOO_BRIEF {
		if minExpires := minExpiresOf(message); minExpires > 0 {
			r.mu.Lock()
			r.minExpires[ref] = minExpires
			r.mu.Unlock()
			return 0
		}
	}
	return failedRefreshBackoff
}

// minExpiresOf reads a response's Min-Expires, 0 when it has none that reads.
func minExpiresOf(message *sipmessage.SIPMessage) int32 {
	for _, extension := range message.GetExtensions() {
		if strings.EqualFold(extension.GetName(), minExpiresHeader) {
			n, err := strconv.ParseInt(strings.TrimSpace(extension.GetValue()), 10, 32)
			if err != nil || n <= 0 {
				return 0
			}
			return int32(n)
		}
	}
	return 0
}

// retentionSeconds keeps a Trunk out of the rounds until one interval before
// its registration ends, so the next REGISTER goes out in time. The Contact's
// expires parameter decides, else the Expires header, else what the REGISTER
// asked for. A Contact without the parameter reads -1; Routr 2 took that as is
// and sent a REGISTER every round.
func retentionSeconds(message *sipmessage.SIPMessage, intervalSeconds float64) float64 {
	expires := int32(defaultExpires)
	if contact := message.GetContact(); contact != nil && contact.GetExpires() > -1 {
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
