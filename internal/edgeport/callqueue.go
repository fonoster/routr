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

const (
	// DefaultMaxCallQueued bounds the work waiting for one call: far above what a
	// call does, far below what a looping peer sends.
	DefaultMaxCallQueued = 256
	// DefaultMaxQueued bounds the work waiting across calls.
	DefaultMaxQueued = 256 * 1024
)

// CallQueue runs the work of one call (one Call-ID) in arrival order and the
// work of different calls concurrently.
//
// The Java EdgePort handles every message on JAIN-SIP's single event thread,
// so a CANCEL can never overtake the INVITE it cancels and a response never
// overtakes the request it answers. Serializing per call keeps those orders
// without making unrelated calls wait for each other.
//
// It is bounded, per call and over all: past a limit Run says no and the caller
// answers for it. The goroutines it runs on are one per call with work, so the
// same limits bound them.
type CallQueue struct {
	log     *slog.Logger
	maxCall int
	maxAll  int
	mu      sync.Mutex
	queues  map[string][]func()
	queued  int
}

// NewCallQueue returns an empty queue with the default limits that logs a
// recovered panic to log (slog.Default() when nil).
func NewCallQueue(log *slog.Logger) *CallQueue {
	return NewBoundedCallQueue(log, DefaultMaxCallQueued, DefaultMaxQueued)
}

// NewBoundedCallQueue is NewCallQueue with the limits given; zero or less takes
// the default.
func NewBoundedCallQueue(log *slog.Logger, maxCall, maxAll int) *CallQueue {
	if log == nil {
		log = slog.Default()
	}
	if maxCall <= 0 {
		maxCall = DefaultMaxCallQueued
	}
	if maxAll <= 0 {
		maxAll = DefaultMaxQueued
	}
	return &CallQueue{log: log, maxCall: maxCall, maxAll: maxAll, queues: map[string][]func(){}}
}

// Run queues fn behind the work already queued for the call and returns at
// once, or returns false with fn dropped when a limit is reached. A goroutine
// drains the call's queue and exits when it is empty.
func (q *CallQueue) Run(callID string, fn func()) bool {
	return q.add(callID, fn, false)
}

// RunAlways is Run for what releases state: refusing it would leak more than it
// saves, and the transactions it releases bound it.
func (q *CallQueue) RunAlways(callID string, fn func()) {
	q.add(callID, fn, true)
}

func (q *CallQueue) add(callID string, fn func(), always bool) bool {
	q.mu.Lock()
	pending, running := q.queues[callID]
	if !always && (len(pending) >= q.maxCall || q.queued >= q.maxAll) {
		q.mu.Unlock()
		return false
	}
	q.queues[callID] = append(pending, fn)
	q.queued++
	q.mu.Unlock()
	if !running {
		go q.drain(callID)
	}
	return true
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
		pending[0] = nil
		q.queues[callID] = pending[1:]
		q.queued--
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
