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
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// DefaultRedisParameters is what Routr 2's Location used when the provider was
// redis and no parameters were given (mods/location/src/config/get_config.ts).
const DefaultRedisParameters = "host=localhost,port=6379"

const redisParametersHint = "should be something like 'host=localhost,port=6379'"

// RedisParameters is the parse of a Location cache `parameters` string, the
// fields of Routr 2's RedisStoreConfig (mods/common/src/redis.ts).
type RedisParameters struct {
	Host     string
	Port     int
	Username string
	Password string
	Secure   bool
}

// URL is the connection URL Routr 2 built from these parameters
// (getRedisUrlFromConfig): redis[s]://[user][:password@]host:port.
func (p RedisParameters) URL() string {
	scheme := "redis"
	if p.Secure {
		scheme = "rediss"
	}
	auth := p.Username
	if p.Password != "" {
		auth += ":" + p.Password + "@"
	}
	return fmt.Sprintf("%s://%s%s:%d", scheme, auth, p.Host, p.Port)
}

// ParseRedisParameters parses `host=localhost,port=6379[,username=u]
// [,password=p][,secure=true]`, the syntax of Routr 2's Location
// (configFromString in mods/location/src/utils.ts, keys host, port, username,
// password, secure). host is required; port defaults to 6379. Errors name a
// key, never a value.
func ParseRedisParameters(params string) (RedisParameters, error) {
	out := RedisParameters{Port: 6379}
	if strings.TrimSpace(params) == "" {
		return out, errors.New("empty parameters string; " + redisParametersHint)
	}
	for _, pair := range strings.Split(params, ",") {
		key, value, found := strings.Cut(strings.TrimSpace(pair), "=")
		if !found || key == "" {
			return out, errors.New("invalid parameters string; " + redisParametersHint)
		}
		switch key {
		case "host":
			out.Host = value
		case "port":
			port, err := strconv.Atoi(value)
			if err != nil || port < 1 || port > 65535 {
				return out, errors.New("invalid parameter: port should be an integer between 1 and 65535")
			}
			out.Port = port
		case "username":
			out.Username = value
		case "password":
			out.Password = value
		case "secure":
			switch value {
			case "true":
				out.Secure = true
			case "false":
				out.Secure = false
			default:
				return out, errors.New("invalid parameter: secure should be true or false")
			}
		default:
			return out, fmt.Errorf("invalid parameter: %s; %s", key, redisParametersHint)
		}
	}
	if out.Host == "" {
		return out, errors.New("invalid parameters string: host is required; " + redisParametersHint)
	}
	return out, nil
}
