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

package rtprelay

import (
	"github.com/fonoster/routr/internal/common/config"
)

// Profile holds the RTPEngine NG keys sent with an offer or answer: a key maps
// to a string ("ICE: force") or to a list of strings ("flags: [trust-address]").
type Profile map[string]any

// Profiles is one Profile per name of config.RTPRelayProfileNames.
type Profiles map[string]Profile

// The profiles of a phone leg reached over TLS, which gets SDES-SRTP instead of
// plain RTP.
const (
	webToSecurePhone   = "web-to-secure-phone"
	phoneToSecurePhone = "phone-to-secure-phone"
)

// DefaultProfiles is the set the relay ships with (profiles.ts), a new one
// each call. A configuration file can change any key of any of them.
func DefaultProfiles() Profiles {
	return Profiles{
		string(WebToWeb): {
			"ICE":   "force",
			"SDES":  []string{"off"},
			"flags": []string{"trust-address", "replace-origin", "replace-session-connection"},
		},
		string(WebToPhone): {
			"transport-protocol": "RTP/AVP",
			"DTLS":               "off",
			"ICE":                "remove",
			"rtcp-mux":           []string{"demux"},
			"replace":            []string{"origin", "session-connection"},
			"flags":              []string{"trust-address", "SDES-no"},
		},
		string(PhoneToWeb): {
			"transport-protocol": "UDP/TLS/RTP/SAVPF",
			"ICE":                "force",
			"DTLS":               "passive",
			"rtcp-mux":           []string{"require"},
			"replace":            []string{"origin", "session-connection"},
			"flags":              []string{"SDES-no", "generate mid", "strip-extmap"},
		},
		string(PhoneToPhone): {
			"transport-protocol": "RTP/AVP",
			"rtcp-mux":           "demux",
			"ICE":                "remove",
			"flags":              []string{"trust-address", "replace-origin", "replace-session-connection"},
		},
		// The phone leg is reached over TLS, so RTPEngine negotiates SDES-SRTP
		// (RTP/SAVP) toward it and bridges to the other leg
		webToSecurePhone: {
			"transport-protocol": "RTP/SAVP",
			"DTLS":               "off",
			"ICE":                "remove",
			"rtcp-mux":           []string{"demux"},
			"replace":            []string{"origin", "session-connection"},
			"flags":              []string{"trust-address"},
		},
		phoneToSecurePhone: {
			"transport-protocol": "RTP/SAVP",
			"rtcp-mux":           "demux",
			"ICE":                "remove",
			"flags":              []string{"trust-address", "replace-origin", "replace-session-connection"},
		},
	}
}

// profileNameFor is the profile for the leg a message is sent to. Only a phone
// leg has a secure variant; a browser leg is always on DTLS-SRTP.
func profileNameFor(direction Direction, secureCallee bool) string {
	switch {
	case direction == WebToPhone && secureCallee:
		return webToSecurePhone
	case direction == PhoneToPhone && secureCallee:
		return phoneToSecurePhone
	}
	return string(direction)
}

// MergeProfiles lays the overrides over the defaults one key at a time, so a
// file that sets a single key (say the SDES suites) keeps every other key of
// that profile. A list replaces the default list; it is not appended to it,
// otherwise there would be no way to drop a default flag.
func MergeProfiles(overrides config.RTPRelayProfiles) Profiles {
	profiles := DefaultProfiles()
	for name, override := range overrides {
		profile, known := profiles[name]
		if !known {
			continue
		}
		for key, value := range override {
			profile[key] = normalizeValue(value)
		}
	}
	return profiles
}

// normalizeValue turns the []any a YAML list decodes to into a []string.
func normalizeValue(value any) any {
	list, ok := value.([]any)
	if !ok {
		return value
	}
	out := make([]string, 0, len(list))
	for _, item := range list {
		if s, isString := item.(string); isString {
			out = append(out, s)
		}
	}
	return out
}
