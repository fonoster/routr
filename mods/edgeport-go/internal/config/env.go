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
	"os"
	"strings"
)

// Env holds the environment variables the Java EdgePort reads (envs.ts and
// GRPCSipListener). Lookup is injectable for tests.
type Env struct {
	ExternalAddrs               []string
	Localnets                   []string
	Aliases                     []string
	ClientProtocols             []string
	ClientCipherSuites          []string
	ProcessorAddr               string
	Hostname                    string
	IgnoreLoopbackFromLocalnets bool
	StripSessionProgressSdp     bool
	ConsolePublisherEnabled     bool
	NatsPublisherEnabled        bool
	NatsPublisherSubject        string
	NatsPublisherURL            string
	EnableHealthchecks          bool
	SipTrace                    bool
	LogsLevel                   string
}

// ReadEnv reads the environment through lookup (os.LookupEnv by default).
func ReadEnv(lookup func(string) (string, bool)) Env {
	if lookup == nil {
		lookup = os.LookupEnv
	}
	get := func(key string) string {
		v, _ := lookup(key)
		return v
	}
	list := func(key string) []string {
		v, ok := lookup(key)
		if !ok {
			return nil
		}
		out := []string{}
		for _, item := range strings.Split(v, ",") {
			if item = strings.TrimSpace(item); item != "" {
				out = append(out, item)
			}
		}
		return out
	}
	// Java's Boolean.parseBoolean: "true" in any case, anything else is false
	boolean := func(key string) bool {
		return strings.EqualFold(get(key), "true")
	}
	return Env{
		ExternalAddrs:               list("EXTERNAL_ADDRS"),
		Localnets:                   list("LOCALNETS"),
		Aliases:                     list("ALIASES"),
		ClientProtocols:             list("SECURITY_CONTEXT_CLIENT_PROTOCOLS"),
		ClientCipherSuites:          list("SECURITY_CONTEXT_CLIENT_CIPHER_SUITES"),
		ProcessorAddr:               get("PROCESSOR_ADDR"),
		Hostname:                    get("HOSTNAME"),
		IgnoreLoopbackFromLocalnets: boolean("IGNORE_LOOPBACK_FROM_LOCALNETS"),
		StripSessionProgressSdp:     boolean("STRIP_SESSION_PROGRESS_SDP"),
		ConsolePublisherEnabled:     boolean("CONSOLE_PUBLISHER_ENABLED"),
		NatsPublisherEnabled:        boolean("NATS_PUBLISHER_ENABLED"),
		NatsPublisherSubject:        get("NATS_PUBLISHER_SUBJECT"),
		NatsPublisherURL:            get("NATS_PUBLISHER_URL"),
		EnableHealthchecks:          boolean("ENABLE_HEALTHCHECKS"),
		SipTrace:                    get("JAIN_SIP_TRACE_LEVEL") != "",
		LogsLevel:                   get("LOGS_LEVEL"),
	}
}

// Pick returns the environment list when it has entries, the config's
// otherwise: the environment wins over edgeport.yaml, as in edgeport.ts.
func Pick(fromEnv, fromConfig []string) []string {
	if len(fromEnv) > 0 {
		return fromEnv
	}
	if fromConfig == nil {
		return []string{}
	}
	return fromConfig
}
