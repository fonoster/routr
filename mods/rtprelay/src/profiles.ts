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
/* eslint-disable require-jsdoc */
import {
  Direction,
  PROFILE_NAMES,
  ProfileName,
  RTPEProfileOverrides,
  RTPEProfiles
} from "./types"

// The profiles the relay ships with. A configuration file can change any key
// of any of them; what it does not mention stays as it is here.
export const DEFAULT_PROFILES: RTPEProfiles = {
  "web-to-web": {
    ICE: "force",
    SDES: ["off"],
    flags: ["trust-address", "replace-origin", "replace-session-connection"]
  },
  "web-to-phone": {
    "transport-protocol": "RTP/AVP",
    DTLS: "off",
    ICE: "remove",
    "rtcp-mux": ["demux"],
    replace: ["origin", "session-connection"],
    flags: ["trust-address", "SDES-no"]
  },
  "phone-to-web": {
    "transport-protocol": "UDP/TLS/RTP/SAVPF",
    ICE: "force",
    DTLS: "passive",
    "rtcp-mux": ["require"],
    replace: ["origin", "session-connection"],
    flags: ["SDES-no", "generate mid", "strip-extmap"]
  },
  "phone-to-phone": {
    "transport-protocol": "RTP/AVP",
    "rtcp-mux": "demux",
    ICE: "remove",
    flags: ["trust-address", "replace-origin", "replace-session-connection"]
  },
  // The phone leg is reached over TLS, so RTPEngine negotiates SDES-SRTP
  // (RTP/SAVP) toward it and bridges to the other leg
  "web-to-secure-phone": {
    "transport-protocol": "RTP/SAVP",
    DTLS: "off",
    ICE: "remove",
    "rtcp-mux": ["demux"],
    replace: ["origin", "session-connection"],
    flags: ["trust-address"]
  },
  "phone-to-secure-phone": {
    "transport-protocol": "RTP/SAVP",
    "rtcp-mux": "demux",
    ICE: "remove",
    flags: ["trust-address", "replace-origin", "replace-session-connection"]
  }
}

// The profile for the leg a message is sent to. Only a phone leg has a secure
// variant; a browser leg is always on DTLS-SRTP.
export function profileNameFor(
  direction: Direction,
  secureCallee = false
): ProfileName {
  switch (direction) {
    case Direction.WEB_TO_WEB:
      return "web-to-web"
    case Direction.WEB_TO_PHONE:
      return secureCallee ? "web-to-secure-phone" : "web-to-phone"
    case Direction.PHONE_TO_WEB:
      return "phone-to-web"
    case Direction.PHONE_TO_PHONE:
      return secureCallee ? "phone-to-secure-phone" : "phone-to-phone"
  }
}

// Lays the overrides over the defaults one key at a time, so a file that sets
// a single key (say the SDES suites) keeps every other key of that profile.
// A list replaces the default list; it is not appended to it, otherwise there
// would be no way to drop a default flag.
export function mergeProfiles(
  overrides: RTPEProfileOverrides = {}
): RTPEProfiles {
  return PROFILE_NAMES.reduce(
    (profiles, name) => ({
      ...profiles,
      [name]: { ...DEFAULT_PROFILES[name], ...(overrides[name] ?? {}) }
    }),
    {} as RTPEProfiles
  )
}
