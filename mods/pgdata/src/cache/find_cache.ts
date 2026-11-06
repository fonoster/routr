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
import { CommonConnect as CC } from "@routr/common"
import { createFindCache } from "./create_find_cache"

const { AGENT, PEER, NUMBER, TRUNK, DOMAIN, CREDENTIALS, ACL } = CC.Kind

// Agents, Domains, Numbers, Peers and Trunks change rarely and Connect looks
// them up on every call. A write through this process drops what it touches;
// the TTL bounds a change made directly in the database or through another
// replica (300 s is what keeps the refills off Node's thread: at 60 s they
// cost 3 lookups per call and Node saturates at 200 calls/s). What embeds what follows the mappers' includeFields, to the end:
// an Agent carries its Domain's egress Numbers with their Trunks.
export const findCache = createFindCache({
  ttlSeconds: 300,
  negativeTtlSeconds: 60,
  embeddedBy: {
    [DOMAIN]: [DOMAIN, AGENT],
    [NUMBER]: [NUMBER, DOMAIN, AGENT],
    [TRUNK]: [TRUNK, NUMBER, AGENT],
    [CREDENTIALS]: [AGENT, PEER, TRUNK, NUMBER],
    [ACL]: [DOMAIN, AGENT, PEER, TRUNK, NUMBER]
  }
})
