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

package registry

import (
	"context"
	"sync"
	"time"
)

// defaultMaxPutsBeforeCleanup is how many puts pass between sweeps of the
// expired entries.
const defaultMaxPutsBeforeCleanup = 10000

// memoryStore is the in-memory Store. It holds one entry per Trunk.
type memoryStore struct {
	now                  func() time.Time
	maxPutsBeforeCleanup int

	mu      sync.Mutex
	entries map[string]Entry
	puts    int
}

func newMemoryStore(maxPutsBeforeCleanup int, now func() time.Time) *memoryStore {
	return &memoryStore{
		now:                  now,
		maxPutsBeforeCleanup: maxPutsBeforeCleanup,
		entries:              map[string]Entry{},
	}
}

// Put implements Store.
func (s *memoryStore) Put(_ context.Context, key string, entry Entry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries[key] = entry

	// Sweep every so often so expired entries don't build up
	s.puts++
	if s.puts >= s.maxPutsBeforeCleanup {
		s.puts = 0
		s.cleanupLocked()
	}
	return nil
}

// Get implements Store.
func (s *memoryStore) Get(_ context.Context, key string) (Entry, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.entries[key]
	if !ok || entry.expired(s.now()) {
		return Entry{}, false, nil
	}
	return entry, true, nil
}

// Delete implements Store.
func (s *memoryStore) Delete(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, key)
	return nil
}

// List implements Store.
func (s *memoryStore) List(_ context.Context) ([]Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	entries := make([]Entry, 0, len(s.entries))
	for _, entry := range s.entries {
		if !entry.expired(now) {
			entries = append(entries, entry)
		}
	}
	return entries, nil
}

// cleanup removes the expired entries.
func (s *memoryStore) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cleanupLocked()
}

func (s *memoryStore) cleanupLocked() {
	now := s.now()
	for key, entry := range s.entries {
		if entry.expired(now) {
			delete(s.entries, key)
		}
	}
}
