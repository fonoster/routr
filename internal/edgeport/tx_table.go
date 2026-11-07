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
	"errors"
	"fmt"
	"hash/maphash"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/emiago/sipgo/sip"
)

// errTxTableFull is what starting a transaction answers past the table's
// limit: the caller answers 503 where it can.
var errTxTableFull = errors.New("transaction table full")

const txShards = 64

// txTable is one direction's transactions by key: sharded maps, so the readers
// and the parsing workers rarely meet on a lock, with a limit on the whole.
type txTable[T any] struct {
	seed   maphash.Seed
	shards [txShards]txShard[T]
	count  atomic.Int64
	limit  int64
}

type txShard[T any] struct {
	mu    sync.RWMutex
	items map[string]T
	// A shard's lock on its own cache line
	_ [32]byte
}

func newTxTable[T any](limit int) *txTable[T] {
	t := &txTable[T]{seed: maphash.MakeSeed(), limit: int64(limit)}
	for i := range t.shards {
		t.shards[i].items = map[string]T{}
	}
	return t
}

func (t *txTable[T]) shard(key string) *txShard[T] {
	return &t.shards[maphash.String(t.seed, key)%txShards]
}

func (t *txTable[T]) get(key string) (T, bool) {
	s := t.shard(key)
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.items[key]
	return v, ok
}

// insert adds v under key unless the key is taken, which returns what holds it,
// or the table is full, which returns errTxTableFull.
func (t *txTable[T]) insert(key string, v T) (existing T, exists bool, err error) {
	s := t.shard(key)
	s.mu.Lock()
	defer s.mu.Unlock()
	if have, ok := s.items[key]; ok {
		return have, true, nil
	}
	if t.limit > 0 && t.count.Load() >= t.limit {
		return existing, false, errTxTableFull
	}
	s.items[key] = v
	t.count.Add(1)
	return existing, false, nil
}

func (t *txTable[T]) remove(key string) {
	s := t.shard(key)
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[key]; ok {
		delete(s.items, key)
		t.count.Add(-1)
	}
}

func (t *txTable[T]) len() int { return int(t.count.Load()) }

// snapshot lists the table, for Close alone: it is the one scan there is.
func (t *txTable[T]) snapshot() []T {
	var out []T
	for i := range t.shards {
		s := &t.shards[i]
		s.mu.RLock()
		for _, v := range s.items {
			out = append(out, v)
		}
		s.mu.RUnlock()
	}
	return out
}

func isRFC3261Branch(branch string) bool {
	return len(branch) > len(sip.RFC3261BranchMagicCookie) && strings.HasPrefix(branch, sip.RFC3261BranchMagicCookie)
}

// serverTxKey is the key RFC 3261 section 17.2.3 matches a request or an ACK on,
// sipgo's makeServerTxKey to the letter: asMethod matches a CANCEL to the INVITE
// it cancels. A request without an RFC 3261 branch is matched as RFC 2543 did.
func serverTxKey(msg sip.Message, asMethod sip.RequestMethod) (string, error) {
	via := msg.Via()
	if via == nil {
		return "", fmt.Errorf("'Via' header not found or empty")
	}
	cseq := msg.CSeq()
	if cseq == nil {
		return "", fmt.Errorf("'CSeq' header not found")
	}
	method := cseq.MethodName
	if method == sip.ACK {
		method = sip.INVITE
	}
	if asMethod != "" {
		method = asMethod
	}
	var b strings.Builder
	if branch, ok := via.Params.Get("branch"); ok && isRFC3261Branch(branch) {
		port := via.Port
		if port <= 0 {
			port = sip.DefaultPort(via.Transport)
		}
		b.Grow(len(branch) + len(via.Host) + len(method) + 16)
		b.WriteString(branch)
		b.WriteString(sip.TxSeperator)
		b.WriteString(via.Host)
		b.WriteString(sip.TxSeperator)
		b.WriteString(strconv.Itoa(port))
		b.WriteString(sip.TxSeperator)
		b.WriteString(string(method))
		return b.String(), nil
	}
	from := msg.From()
	if from == nil {
		return "", fmt.Errorf("'From' header not found")
	}
	tag, ok := from.Params.Get("tag")
	if !ok {
		return "", fmt.Errorf("'tag' param not found in 'From' header")
	}
	id := msg.CallID()
	if id == nil {
		return "", fmt.Errorf("'Call-ID' header not found")
	}
	b.WriteString(tag)
	b.WriteString(sip.TxSeperator)
	id.StringWrite(&b)
	b.WriteString(sip.TxSeperator)
	b.WriteString(string(method))
	b.WriteString(sip.TxSeperator)
	b.WriteString(strconv.Itoa(int(cseq.SeqNo)))
	b.WriteString(sip.TxSeperator)
	via.StringWrite(&b)
	b.WriteString(sip.TxSeperator)
	return b.String(), nil
}
