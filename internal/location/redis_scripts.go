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

package location

import "github.com/redis/go-redis/v9"

// The scripts of the Redis store. Each takes its "now" from Redis, so replicas
// with different clocks agree. They name a binding in KEYS[1] and its index in
// KEYS[2]; the maxContacts check also reads the bindings the index lists, which
// a single-node Redis allows (Redis Cluster is out of scope, as in #511).
const (
	luaPrelude = `
local function ms(n) return string.format('%.0f', n) end
local t = redis.call('TIME')
local now = t[1] * 1000 + math.floor(t[2] / 1000)
`
	// luaExpireIndex makes the index outlive its longest-lived member. The
	// score goes through tonumber and ms because Redis may print it with an
	// exponent, which PEXPIREAT refuses.
	luaExpireIndex = `
local top = redis.call('ZRANGE', KEYS[2], -1, -1, 'WITHSCORES')
redis.call('PEXPIREAT', KEYS[2], ms(tonumber(top[2])))
`
)

// noContactLimit is the maxContacts that skips the check, as in AddRoute.
const noContactLimit = -1

// putScript writes or removes a binding and keeps its index, in one step.
//
// ARGV: the route's JSON, its expires, maxContacts, its transport's name. It
// answers 1, or 0 when the contact is refused because of maxContacts. The
// check, the write and the cleanup are one script because Redis runs a script
// to its end before any other command: two replicas registering the same AOR
// at once cannot both pass the check. It is Location.AddRoute's check, counted
// over the same bindings Get returns, and a contact already bound (same user,
// host, port and transport) never counts against the limit.
var putScript = redis.NewScript(luaPrelude + `
local maxContacts = tonumber(ARGV[3])
if maxContacts ~= -1 then
  local count, exists = 0, false
  local members = redis.call('ZRANGEBYSCORE', KEYS[2], ms(now), '+inf')
  for i = 1, #members do
    local current = redis.call('GET', members[i])
    if current then
      count = count + 1
      if members[i] == KEYS[1] then
        local ok, route = pcall(cjson.decode, current)
        exists = ok and type(route) == 'table' and route.transport == ARGV[4]
      end
    end
  end
  if not exists and count >= maxContacts then
    return 0
  end
end

local expires = tonumber(ARGV[2])
if expires <= 0 then
  redis.call('DEL', KEYS[1])
  redis.call('ZREM', KEYS[2], KEYS[1])
  return 1
end

redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('ZADD', KEYS[2], ms(now + expires * 1000), KEYS[1])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ms(now))
` + luaExpireIndex + `
return 1
`)

// indexScript indexes a binding the old layout wrote, by the TTL it has now.
// It answers 1, or 0 when the binding has no TTL left to index (it went away
// since the scan read it). Running it twice changes nothing.
var indexScript = redis.NewScript(luaPrelude + `
local pttl = redis.call('PTTL', KEYS[1])
if pttl <= 0 then
  return 0
end
redis.call('ZADD', KEYS[2], ms(now + pttl), KEYS[1])
` + luaExpireIndex + `
return 1
`)
