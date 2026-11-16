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

package dispatcher

import (
	"math"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/trace"
)

// versionMetadataKey is the gRPC metadata key under which @routr/processor
// announces its version. A component called in process announces nothing.
const versionMetadataKey = "routr-component-version"

// hopEvent is what the message path keeps of one component call. It holds the
// messages, which nobody changes after they were handed over (ROUTR3.md § 3.1),
// so diffing and redacting wait for the Recorder's goroutine.
type hopEvent struct {
	component  string
	kind       trace.HopKind
	version    string
	durationMs float64
	// matched marks the Dispatcher choosing a processor
	matched bool
	// isCall marks a call that returned; before and after are its messages
	isCall   bool
	before   *sipmessage.SIPMessage
	after    *sipmessage.SIPMessage
	metadata map[string]string
	err      string
}

// hopCollector collects what happened to one message while it crossed the
// Dispatcher. One per message, nil when nothing is recorded: every method does
// nothing on a nil collector, so the path pays nothing with recording off.
type hopCollector struct {
	startedAt time.Time
	hops      []hopEvent
}

func newHopCollector() *hopCollector {
	return &hopCollector{startedAt: time.Now(), hops: make([]hopEvent, 0, 4)}
}

// roundMs rounds to a tenth of a millisecond, as the Node recorder's records have it.
func roundMs(d time.Duration) float64 {
	return math.Round(float64(d)/float64(time.Millisecond)*10) / 10
}

// start is the clock of a hop.
func (c *hopCollector) start() time.Time {
	if c == nil {
		return time.Time{}
	}
	return time.Now()
}

// callOptions asks gRPC for the headers a component announces its version in.
func (c *hopCollector) callOptions(header *metadata.MD) []grpc.CallOption {
	if c == nil {
		return nil
	}
	return []grpc.CallOption{grpc.Header(header)}
}

func (c *hopCollector) addMatched(startedAt time.Time) {
	if c == nil {
		return
	}
	c.hops = append(c.hops, hopEvent{
		component:  "dispatcher",
		kind:       trace.HopDispatcher,
		durationMs: roundMs(time.Since(startedAt)),
		matched:    true,
	})
}

func (c *hopCollector) addCall(component string, kind trace.HopKind, header metadata.MD, startedAt time.Time, before, after *sipmessage.SIPMessage, md map[string]string) {
	if c == nil {
		return
	}
	version := ""
	if values := header.Get(versionMetadataKey); len(values) > 0 {
		version = values[0]
	}
	c.hops = append(c.hops, hopEvent{
		component:  component,
		kind:       kind,
		version:    version,
		durationMs: roundMs(time.Since(startedAt)),
		isCall:     true,
		before:     before,
		after:      after,
		metadata:   md,
	})
}

func (c *hopCollector) addError(component string, kind trace.HopKind, startedAt time.Time, message string) {
	if c == nil {
		return
	}
	c.hops = append(c.hops, hopEvent{
		component:  component,
		kind:       kind,
		durationMs: roundMs(time.Since(startedAt)),
		err:        message,
	})
}

// hop turns the event into a record's hop. It runs on the Recorder's goroutine.
func (h *hopEvent) hop(redact bool) trace.Hop {
	out := trace.Hop{Component: h.component, Kind: h.kind, Version: h.version, DurationMs: h.durationMs}
	switch {
	case h.matched:
		out.Action = trace.ActionMatched
	case !h.isCall:
		out.Action = trace.ActionError
		out.Error = h.err
	case h.after == nil:
		// A component that answered with no message at all
		out.Action = trace.ActionError
		out.Metadata = trace.Split(h.metadata).Hop
	default:
		before, after := h.before, h.after
		if redact {
			before, after = trace.RedactMessage(before), trace.RedactMessage(after)
		}
		out.Diff = trace.DiffMessages(before, after)
		out.Action = hopAction(before, after, out.Diff)
		out.Metadata = trace.Split(h.metadata).Hop
	}
	return out
}

func hopAction(before, after *sipmessage.SIPMessage, diff *trace.Diff) trace.HopAction {
	switch {
	case trace.IsResponse(after) && trace.IsResponse(before):
		return trace.ActionRelayed
	case trace.IsResponse(after):
		return trace.ActionResponded
	case diff.IsEmpty():
		return trace.ActionPassThrough
	}
	return trace.ActionForwarded
}
