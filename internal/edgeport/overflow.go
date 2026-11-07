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
package edgeport

import (
	"context"
	"sync/atomic"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// overflowKind names a bounded thing that refused something. Every table and
// queue of the EdgePort has a limit and an answer past it; this is the counter
// and the log that goes with the answer.
type overflowKind int

const (
	// overflowUDPQueue: a datagram no parsing worker had room for. Dropped; SIP retransmits.
	overflowUDPQueue overflowKind = iota
	// overflowTransactions: a transaction the table had no room for. 503 for a
	// request received, and for the request a forwarded one answers.
	overflowTransactions
	// overflowCallQueue: work a call or the whole queue had no room for. 503
	// for a request with a transaction; a response is dropped, and retransmitted.
	overflowCallQueue
	// overflowDialogs: a new dialog the table had no room for. 503 to its INVITE.
	overflowDialogs
	// overflowAsyncSends: a 100 Trying over a stream with too many waiting.
	overflowAsyncSends
	overflowKinds
)

var overflowNames = [overflowKinds]string{
	overflowUDPQueue:     "udp_queue",
	overflowTransactions: "transactions",
	overflowCallQueue:    "call_queue",
	overflowDialogs:      "dialogs",
	overflowAsyncSends:   "async_sends",
}

// overflowLogEvery spaces the log of an overflow: under one, it can't become the
// next thing that saturates.
const overflowLogEvery = 1000

// overflowCounters counts per kind, with no lock on the message path.
type overflowCounters [overflowKinds]atomic.Uint64

// overflowed counts one; the first and every overflowLogEvery-th are logged.
func (e *EdgePort) overflowed(kind overflowKind) {
	n := e.overflows[kind].Add(1)
	if n%overflowLogEvery == 1 {
		e.log.Warn("edgeport limit reached", "limit", overflowNames[kind], "count", n)
	}
	if e.tel != nil {
		e.tel.overflows.Add(context.Background(), 1, metric.WithAttributes(attribute.String("limit", overflowNames[kind])))
	}
}

// Overflows is how many times each limit said no since the start, by name.
func (e *EdgePort) Overflows() map[string]uint64 {
	out := make(map[string]uint64, overflowKinds)
	for kind := range e.overflows {
		out[overflowNames[kind]] = e.overflows[kind].Load()
	}
	return out
}
