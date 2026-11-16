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

package config

import (
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

const rtprelayHeader = "kind: RTPRelay\napiVersion: v2beta1\n"

func TestRTPRelayDefaults(t *testing.T) {
	cfg, err := ParseRTPRelay([]byte(rtprelayHeader+"spec:\n  rtpengine:\n    host: rtpengine\n"), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	want := RTPRelayFileSpec{
		BindAddr:  "0.0.0.0:51903",
		RTPEngine: RTPEngineSpec{Host: "rtpengine", Port: 22222, TimeoutMs: 5000},
	}
	if !reflect.DeepEqual(cfg.Spec, want) || cfg.LogLevel != "info" {
		t.Errorf("%+v", cfg)
	}
}

func TestRTPRelayReadsAFile(t *testing.T) {
	cfg, err := ParseRTPRelay([]byte(rtprelayHeader+`logLevel: debug
spec:
  bindAddr: 127.0.0.1:1
  rtpengine: {host: rtpengine.local, port: 2223, timeoutMs: 100}
  profiles:
    phone-to-secure-phone:
      SDES: [only-AES_CM_128_HMAC_SHA1_80]
      ICE: remove
`), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	want := RTPRelayFileSpec{
		BindAddr:  "127.0.0.1:1",
		RTPEngine: RTPEngineSpec{Host: "rtpengine.local", Port: 2223, TimeoutMs: 100},
		Profiles: RTPRelayProfiles{"phone-to-secure-phone": {
			"SDES": []any{"only-AES_CM_128_HMAC_SHA1_80"},
			"ICE":  "remove",
		}},
	}
	if !reflect.DeepEqual(cfg.Spec, want) || cfg.LogLevel != "debug" {
		t.Errorf("%+v", cfg)
	}
}

func TestRTPRelayRejects(t *testing.T) {
	const host = "spec:\n  rtpengine: {host: h}\n"
	for name, c := range map[string]struct{ file, want string }{
		"no kind":         {"apiVersion: v2beta1\nspec: {}\n", "'kind'"},
		"no apiVersion":   {"kind: RTPRelay\nspec: {}\n", ".apiVersion"},
		"no spec":         {rtprelayHeader, "'spec'"},
		"other kind":      {"kind: EdgePort\napiVersion: v2beta1\nspec: {}\n", "kind"},
		"bad log level":   {rtprelayHeader + "logLevel: loud\n" + host, "logLevel"},
		"unknown key":     {rtprelayHeader + "spec:\n  rtpengine: {host: h}\n  nope: 1\n", "spec.nope: unknown key"},
		"no rtpengine":    {rtprelayHeader + "spec: {}\n", "spec.rtpengine.host: is required"},
		"no host":         {rtprelayHeader + "spec:\n  rtpengine: {port: 1}\n", "spec.rtpengine.host: is required"},
		"empty host":      {rtprelayHeader + "spec:\n  rtpengine: {host: ''}\n", "spec.rtpengine.host"},
		"bad port":        {rtprelayHeader + "spec:\n  rtpengine: {host: h, port: 70000}\n", "spec.rtpengine.port"},
		"bad timeout":     {rtprelayHeader + "spec:\n  rtpengine: {host: h, timeoutMs: 0}\n", "spec.rtpengine.timeoutMs"},
		"engine key":      {rtprelayHeader + "spec:\n  rtpengine: {host: h, x: 1}\n", "spec.rtpengine.x"},
		"bad bindAddr":    {rtprelayHeader + "spec:\n  bindAddr: 1\n  rtpengine: {host: h}\n", "spec.bindAddr"},
		"unknown profile": {rtprelayHeader + host + "  profiles:\n    web-to-fax:\n      ICE: remove\n", "web-to-fax"},
		"bad value":       {rtprelayHeader + host + "  profiles:\n    web-to-web:\n      SDES: 1\n", "SDES"},
		"bad list":        {rtprelayHeader + host + "  profiles:\n    web-to-web:\n      SDES: [1]\n", "SDES"},
		"profile scalar":  {rtprelayHeader + host + "  profiles:\n    web-to-web: nope\n", "web-to-web"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseRTPRelay([]byte(c.file), noEnv)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Errorf("err = %v, want it to name %s", err, c.want)
			}
		})
	}
}

func TestRTPRelayFileIsRequired(t *testing.T) {
	if _, err := LoadRTPRelay("", noEnv); err == nil {
		t.Error("no path must fail")
	}
	if _, err := LoadRTPRelay(filepath.Join(t.TempDir(), "nope.yaml"), noEnv); err == nil {
		t.Error("a missing file must fail")
	}
}

func TestRTPRelaySectionOfRoutrYAML(t *testing.T) {
	cfg, err := ParseRoutr([]byte(routrMinimum+`  rtprelay:
    host: rtpengine
    port: 22222
    timeoutMs: 100
    profiles:
      web-to-web: {ICE: remove}
`), noEnv)
	if err != nil {
		t.Fatal(err)
	}
	want := RTPRelaySpec{Host: "rtpengine", Port: 22222, TimeoutMs: 100, Profiles: RTPRelayProfiles{"web-to-web": {"ICE": "remove"}}}
	if !reflect.DeepEqual(*cfg.Spec.RTPRelay, want) {
		t.Errorf("%+v", cfg.Spec.RTPRelay)
	}
	if _, err := ParseRoutr([]byte(routrMinimum+"  rtprelay: {host: h, port: 1, profiles: {web-to-fax: {}}}\n"), noEnv); err == nil || !strings.Contains(err.Error(), "web-to-fax") {
		t.Errorf("err = %v", err)
	}
}
