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
	"log/slog"
	"sync"
)

// CallQueue runs the work of one call (one Call-ID) in arrival order and the
// work of different calls concurrently.
//
// The Java EdgePort handles every message on JAIN-SIP's single event thread,
// so a CANCEL can never overtake the INVITE it cancels and a response never
// overtakes the request it answers. Serializing per call keeps those orders
// without making unrelated calls wait for each other.
type CallQueue struct {
	log    *slog.Logger
	mu     sync.Mutex
	queues map[string][]func()
}

// NewCallQueue returns an empty queue that logs a recovered panic to log
// (slog.Default() when nil).
func NewCallQueue(log *slog.Logger) *CallQueue {
	if log == nil {
		log = slog.Default()
	}
	return &CallQueue{log: log, queues: map[string][]func(){}}
}

// Run queues fn behind the work already queued for the call and returns at
// once. A goroutine drains the call's queue and exits when it is empty.
func (q *CallQueue) Run(callID string, fn func()) {
	q.mu.Lock()
	pending, running := q.queues[callID]
	q.queues[callID] = append(pending, fn)
	q.mu.Unlock()
	if running {
		return
	}
	go q.drain(callID)
}

func (q *CallQueue) drain(callID string) {
	for {
		q.mu.Lock()
		pending := q.queues[callID]
		if len(pending) == 0 {
			delete(q.queues, callID)
			q.mu.Unlock()
			return
		}
		fn := pending[0]
		q.queues[callID] = pending[1:]
		q.mu.Unlock()
		safely(q.log, fn)
	}
}

// safely runs fn and recovers from a panic, so one bad message cannot stop
// the call's queue or the process.
func safely(log *slog.Logger, fn func()) {
	defer func() {
		if r := recover(); r != nil {
			log.Error("recovered from a panic while handling a message", "panic", r)
		}
	}()
	fn()
}

// Len returns the number of calls with work queued or running.
func (q *CallQueue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.queues)
}
