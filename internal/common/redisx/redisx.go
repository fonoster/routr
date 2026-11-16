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

// Package redisx opens the Redis clients of the components that keep their
// state there, from the parameters string of spec.cache.
package redisx

import (
	"crypto/tls"
	"net"
	"strconv"
	"strings"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/redis/go-redis/v9"
	"github.com/redis/go-redis/v9/maintnotifications"
)

// Options builds the client options of the parameters. It fills in the fields
// directly rather than go through RedisParameters.URL, whose username without
// a password and unescaped password are Routr 2's.
func Options(p config.RedisParameters) *redis.Options {
	opts := &redis.Options{
		Addr:     net.JoinHostPort(p.Host, strconv.Itoa(p.Port)),
		Username: p.Username,
		Password: p.Password,
		// A gRPC deadline also bounds the Redis call it waits on
		ContextTimeoutEnabled: true,
		// The chart ships Redis 7.0, which knows neither CLIENT SETINFO nor
		// CLIENT MAINT_NOTIFICATIONS
		DisableIdentity:          true,
		MaintNotificationsConfig: &maintnotifications.Config{Mode: maintnotifications.ModeDisabled},
	}
	if p.Secure {
		opts.TLSConfig = &tls.Config{ServerName: p.Host, MinVersion: tls.VersionTLS12}
	}
	return opts
}

// Open returns a client for a parameters string, the default one
// (config.DefaultRedisParameters) when it is blank. The client connects on
// first use, so an unreachable Redis is not an error here. It is the caller's
// to close. Errors name a key, never a value.
func Open(parameters string) (*redis.Client, error) {
	if strings.TrimSpace(parameters) == "" {
		parameters = config.DefaultRedisParameters
	}
	p, err := config.ParseRedisParameters(parameters)
	if err != nil {
		return nil, err
	}
	return redis.NewClient(Options(p)), nil
}
