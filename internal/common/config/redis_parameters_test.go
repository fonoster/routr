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
	"strings"
	"testing"
)

func TestParseRedisParameters(t *testing.T) {
	got, err := ParseRedisParameters("host=localhost,port=6379")
	if err != nil || got != (RedisParameters{Host: "localhost", Port: 6379}) {
		t.Errorf("%+v %v", got, err)
	}
	if got.URL() != "redis://localhost:6379" {
		t.Errorf("url: %s", got.URL())
	}

	got, err = ParseRedisParameters("host=redis, port=6380, username=u, password=p, secure=true")
	want := RedisParameters{Host: "redis", Port: 6380, Username: "u", Password: "p", Secure: true}
	if err != nil || got != want {
		t.Errorf("%+v %v", got, err)
	}
	if got.URL() != "rediss://u:p@redis:6380" {
		t.Errorf("url: %s", got.URL())
	}

	got, err = ParseRedisParameters("host=redis,secure=false")
	if err != nil || got != (RedisParameters{Host: "redis", Port: 6379}) {
		t.Errorf("port defaults to 6379: %+v %v", got, err)
	}
	if got, _ = ParseRedisParameters("host=redis,password=p"); got.URL() != "redis://:p@redis:6379" {
		t.Errorf("password without username: %s", got.URL())
	}
}

func TestParseRedisParametersFailures(t *testing.T) {
	cases := map[string]string{
		"":                              "empty parameters string",
		"   ":                           "empty parameters string",
		"localhost":                     "invalid parameters string",
		"host=a,=b":                     "invalid parameters string",
		"port=6379":                     "host is required",
		"host=a,dbNumber=1":             "invalid parameter: dbNumber",
		"host=a,port=x":                 "invalid parameter: port",
		"host=a,port=70000":             "invalid parameter: port",
		"host=a,secure=yes":             "invalid parameter: secure",
		"host=a,password=s3cr3t,port=x": "invalid parameter: port",
	}
	for input, want := range cases {
		_, err := ParseRedisParameters(input)
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("%q: %v", input, err)
			continue
		}
		if strings.Contains(err.Error(), "s3cr3t") {
			t.Errorf("%q: the error carries a value: %v", input, err)
		}
	}
}
