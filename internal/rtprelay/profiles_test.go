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
	"reflect"
	"slices"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

// The SRTP cases of rtpengine.unit.test.ts.

func TestAsksForPlainRTPTowardAPhoneLegOnUDPOrTCP(t *testing.T) {
	profiles := DefaultProfiles()
	if got := profiles[profileNameFor(PhoneToPhone, false)]["transport-protocol"]; got != "RTP/AVP" {
		t.Errorf("phone to phone = %v", got)
	}
	webToPhone := profiles[profileNameFor(WebToPhone, false)]
	if webToPhone["transport-protocol"] != "RTP/AVP" || !slices.Contains(webToPhone["flags"].([]string), "SDES-no") {
		t.Errorf("web to phone = %v", webToPhone)
	}
}

func TestAsksForSDESSRTPTowardAPhoneLegOnTLS(t *testing.T) {
	profiles := DefaultProfiles()
	if got := profiles[profileNameFor(PhoneToPhone, true)]["transport-protocol"]; got != "RTP/SAVP" {
		t.Errorf("phone to phone = %v", got)
	}
	webToPhone := profiles[profileNameFor(WebToPhone, true)]
	if webToPhone["transport-protocol"] != "RTP/SAVP" || webToPhone["DTLS"] != "off" ||
		slices.Contains(webToPhone["flags"].([]string), "SDES-no") {
		t.Errorf("web to phone = %v", webToPhone)
	}
}

func TestLeavesTheBrowserLegOnDTLSSRTP(t *testing.T) {
	if got := DefaultProfiles()[profileNameFor(PhoneToWeb, true)]["transport-protocol"]; got != "UDP/TLS/RTP/SAVPF" {
		t.Errorf("phone to web = %v", got)
	}
}

func TestDefaultProfilesCoverEveryNameAFileCanChange(t *testing.T) {
	profiles := DefaultProfiles()
	if len(profiles) != len(config.RTPRelayProfileNames) {
		t.Errorf("%d profiles, %d names", len(profiles), len(config.RTPRelayProfileNames))
	}
	for _, name := range config.RTPRelayProfileNames {
		if _, ok := profiles[name]; !ok {
			t.Errorf("no default for %s", name)
		}
	}
}

func TestMergeKeepsTheOtherKeysOfAProfile(t *testing.T) {
	profile := MergeProfiles(config.RTPRelayProfiles{
		"phone-to-secure-phone": {"SDES": []any{"only-AES_CM_128_HMAC_SHA1_80"}},
	})["phone-to-secure-phone"]
	if !reflect.DeepEqual(profile["SDES"], []string{"only-AES_CM_128_HMAC_SHA1_80"}) {
		t.Errorf("SDES = %v", profile["SDES"])
	}
	if profile["transport-protocol"] != "RTP/SAVP" ||
		!reflect.DeepEqual(profile["flags"], DefaultProfiles()["phone-to-secure-phone"]["flags"]) {
		t.Errorf("profile = %v", profile)
	}
}

func TestMergeReplacesAListInsteadOfAppending(t *testing.T) {
	profile := MergeProfiles(config.RTPRelayProfiles{"web-to-phone": {"flags": []any{"trust-address"}}})["web-to-phone"]
	if !reflect.DeepEqual(profile["flags"], []string{"trust-address"}) {
		t.Errorf("flags = %v", profile["flags"])
	}
}

func TestMergeLeavesTheProfilesItDoesNotMention(t *testing.T) {
	profiles := MergeProfiles(config.RTPRelayProfiles{"web-to-web": {"ICE": "remove"}})
	if !reflect.DeepEqual(profiles["phone-to-web"], DefaultProfiles()["phone-to-web"]) {
		t.Errorf("phone to web = %v", profiles["phone-to-web"])
	}
	if DefaultProfiles()["web-to-web"]["ICE"] != "force" {
		t.Error("the defaults changed")
	}
}

func TestMergeIgnoresAnUnknownProfile(t *testing.T) {
	profiles := MergeProfiles(config.RTPRelayProfiles{"web-to-fax": {"ICE": "remove"}})
	if _, ok := profiles["web-to-fax"]; ok {
		t.Error("an unknown profile must not appear")
	}
}
