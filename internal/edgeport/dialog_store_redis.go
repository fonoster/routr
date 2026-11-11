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
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/redis/go-redis/v9"

	"github.com/fonoster/routr/internal/common/redisx"
)

// redisDialogPrefix names the dialog keys: "routr:edgeport:dialog:<Call-ID>"
// holds the dialog's record as JSON until the dialog's deadline. The Location's
// keys ("<key>:<binding>" and "routr:loc:idx:*") never start with it.
const redisDialogPrefix = "routr:edgeport:dialog:"

// saveDialogScript merges a record into the one a call already has, in one
// step: Redis runs a script to its end before any other command, so two
// EdgePorts saving the same dialog at once both count.
//
// ARGV: the time the record has left in ms, 1 when the dialog ended, its CSeq
// offset, how many targets a dialog keeps, then the targets. The stored targets
// come first and the newest are kept, as dialogTargets.add keeps them. An ended
// dialog stays ended for what is left of its linger, whatever a record written
// before its end says; the offset never goes down.
var saveDialogScript = redis.NewScript(`
local ttl = tonumber(ARGV[1])
local ended = ARGV[2] == '1'
local offset = tonumber(ARGV[3])
local max = tonumber(ARGV[4])
local targets, seen = {}, {}
local current = redis.call('GET', KEYS[1])
if current then
  local ok, old = pcall(cjson.decode, current)
  if ok and type(old) == 'table' then
    if type(old.t) == 'table' then
      for _, t in ipairs(old.t) do
        if type(t) == 'string' and not seen[t] then
          seen[t] = true
          targets[#targets + 1] = t
        end
      end
    end
    if old.e == true then
      if not ended then
        local left = redis.call('PTTL', KEYS[1])
        if left > 0 then ttl = left end
      end
      ended = true
    end
    if type(old.o) == 'number' and old.o > offset then offset = old.o end
  end
end
for i = 5, #ARGV do
  if not seen[ARGV[i]] then
    seen[ARGV[i]] = true
    targets[#targets + 1] = ARGV[i]
  end
end
local kept = {}
for i = math.max(1, #targets - max + 1), #targets do
  kept[#kept + 1] = targets[i]
end
local record = {t = kept, o = offset}
if ended then record.e = true end
redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
return 1
`)

// redisDialogRecord is the JSON of a record. Lua's cjson writes an empty list
// as {}, so t is read by hand.
type redisDialogRecord struct {
	Targets json.RawMessage `json:"t"`
	Ended   bool            `json:"e"`
	Offset  int             `json:"o"`
}

// redisDialogStore is the dialogStore of EdgePorts that share a Redis
// (spec.cache.provider redis), the same Redis the Location may use.
type redisDialogStore struct {
	client *redis.Client
}

var _ dialogStore = (*redisDialogStore)(nil)

// newRedisDialogStore opens the store of a parameters string. The client
// connects on first use: a Redis that isn't up yet is no reason not to start,
// and the EdgePort answers for the dialogs it holds itself meanwhile.
func newRedisDialogStore(parameters string) (*redisDialogStore, error) {
	client, err := redisx.Open(parameters)
	if err != nil {
		return nil, fmt.Errorf("spec.cache.parameters: %w", err)
	}
	return &redisDialogStore{client: client}, nil
}

func redisDialogKey(callID string) string {
	return redisDialogPrefix + callID
}

// Save implements dialogStore: one pipelined round trip for the batch. A Redis
// that lost its scripts (a restart, a failover) gets them again, once.
func (s *redisDialogStore) Save(ctx context.Context, dialogs []SharedDialogSave) error {
	err := s.save(ctx, dialogs)
	if err != nil && redis.HasErrorPrefix(err, "NOSCRIPT") {
		if err = saveDialogScript.Load(ctx, s.client).Err(); err == nil {
			err = s.save(ctx, dialogs)
		}
	}
	return err
}

func (s *redisDialogStore) save(ctx context.Context, dialogs []SharedDialogSave) error {
	_, err := s.client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for _, d := range dialogs {
			// A record with no time left would be refused by SET; it is gone anyway
			ms := d.TTL.Milliseconds()
			if ms <= 0 {
				continue
			}
			ended := "0"
			if d.Record.Ended {
				ended = "1"
			}
			args := make([]any, 0, 4+len(d.Record.Targets))
			args = append(args, strconv.FormatInt(ms, 10), ended, strconv.Itoa(d.Record.CSeqOffset), strconv.Itoa(maxDialogTargets))
			for _, target := range d.Record.Targets {
				args = append(args, target)
			}
			saveDialogScript.EvalSha(ctx, pipe, []string{redisDialogKey(d.CallID)}, args...)
		}
		return nil
	})
	return err
}

// Load implements dialogStore.
func (s *redisDialogStore) Load(ctx context.Context, callID string) (DialogRecord, bool, error) {
	text, err := s.client.Get(ctx, redisDialogKey(callID)).Result()
	if errors.Is(err, redis.Nil) {
		return DialogRecord{}, false, nil
	}
	if err != nil {
		return DialogRecord{}, false, err
	}
	rec, err := parseRedisDialogRecord(text)
	if err != nil {
		// Not a record this version wrote: no dialog, rather than an outage
		return DialogRecord{}, false, nil
	}
	return rec, true, nil
}

// parseRedisDialogRecord reads a stored record. Its targets are host:port keys
// (targetKey); anything else, and anything past maxDialogTargets, is left out.
func parseRedisDialogRecord(text string) (DialogRecord, error) {
	var stored redisDialogRecord
	if err := json.Unmarshal([]byte(text), &stored); err != nil {
		return DialogRecord{}, err
	}
	rec := DialogRecord{Ended: stored.Ended, CSeqOffset: max(stored.Offset, 0)}
	var targets []string
	if strings.HasPrefix(strings.TrimSpace(string(stored.Targets)), "[") {
		if err := json.Unmarshal(stored.Targets, &targets); err != nil {
			return DialogRecord{}, err
		}
	}
	if len(targets) > maxDialogTargets {
		targets = targets[len(targets)-maxDialogTargets:]
	}
	rec.Targets = targets
	return rec, nil
}

// Close implements dialogStore.
func (s *redisDialogStore) Close() error {
	return s.client.Close()
}
