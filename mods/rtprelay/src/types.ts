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
import { MessageRequest } from "@routr/common"

export enum Direction {
  WEB_TO_WEB = "web-to-web",
  WEB_TO_PHONE = "web-to-phone",
  PHONE_TO_WEB = "phone-to-web",
  PHONE_TO_PHONE = "phone-to-phone"
}

export interface RTPERequest {
  "call-id": string
  "from-tag": string
  "to-tag"?: string
  "DTLS-fingerprint"?: string
  "DTLS-passive"?: boolean
  "transport-protocol"?: string
  sdp?: string
  ICE?: string
  SDES?: string
}

// The RTPEngine ng keys sent with an offer or answer: a key maps to a value
// ("ICE: force"), to a list of flags ("flags: [trust-address]") or to a list
// of values ("SDES: [off]").
export type RTPEProfile = Record<string, string | string[]>

// One profile per direction, plus the secure-callee variant of the two
// directions that end on a phone leg, since a phone reached over TLS gets
// SDES-SRTP instead of plain RTP.
export const PROFILE_NAMES = [
  "web-to-web",
  "web-to-phone",
  "phone-to-web",
  "phone-to-phone",
  "web-to-secure-phone",
  "phone-to-secure-phone"
] as const

export type ProfileName = (typeof PROFILE_NAMES)[number]

export type RTPEProfiles = Record<ProfileName, RTPEProfile>

export type RTPEProfileOverrides = Partial<RTPEProfiles>

export interface RTPEConfig {
  host: string
  port: number
}

// What the service runs with once the optional file (if any) is read,
// validated and merged over the defaults. source is the file the config came
// from, and is absent when no file was found and the defaults apply.
export interface RTPRelayConfig {
  bindAddr?: string
  rtpengine?: { host?: string; port?: number }
  profiles: RTPEProfiles
  source?: string
}

export type RTPEClient = {
  send: (request: RTPERequest) => Promise<string>
}

export type RTPEFunctionResult =
  | {
      result: "ok"
      sdp: string
    }
  | { result: "error"; "error-reason": string }

export type RTPEFunction = (
  config: RTPEConfig,
  invertTags?: boolean,
  profiles?: RTPEProfiles
) => (req: MessageRequest) => Promise<RTPEFunctionResult>
