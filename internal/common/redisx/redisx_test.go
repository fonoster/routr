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

package redisx

import (
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

func TestOptions(t *testing.T) {
	plain := Options(config.RedisParameters{Host: "redis", Port: 6380})
	if plain.Addr != "redis:6380" || plain.TLSConfig != nil {
		t.Errorf("plain: %s %v", plain.Addr, plain.TLSConfig)
	}

	// A username alone and a password with URL characters both survive, which
	// the URL form of the parameters would not let them
	secure := Options(config.RedisParameters{Host: "redis", Port: 6379, Username: "u", Password: "p@ss/word", Secure: true})
	if secure.Username != "u" || secure.Password != "p@ss/word" {
		t.Errorf("credentials: %s %s", secure.Username, secure.Password)
	}
	if secure.TLSConfig == nil || secure.TLSConfig.ServerName != "redis" {
		t.Errorf("tls: %+v", secure.TLSConfig)
	}
}

func TestOpen(t *testing.T) {
	for parameters, want := range map[string]string{
		"":                       "localhost:6379",
		"  ":                     "localhost:6379",
		"host=redis,port=6380":   "redis:6380",
		"host=redis,secure=true": "redis:6379",
	} {
		client, err := Open(parameters)
		if err != nil {
			t.Fatalf("%q: %v", parameters, err)
		}
		if got := client.Options().Addr; got != want {
			t.Errorf("%q: got %s, want %s", parameters, got, want)
		}
		_ = client.Close()
	}
}

func TestOpenFailure(t *testing.T) {
	_, err := Open("host=redis,password=hunter2,port=none")
	if err == nil || !strings.Contains(err.Error(), "port") {
		t.Fatalf("expected the port refused, got %v", err)
	}
	if strings.Contains(err.Error(), "hunter2") {
		t.Fatalf("the error shows a value: %v", err)
	}
}
