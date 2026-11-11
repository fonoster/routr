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

// Package config reads and validates Routr's YAML configuration: routr.yaml
// for RoutrOne (LoadRoutr, ROUTR3.md § 3.7) and the files a standalone
// component reads, edgeport.yaml (LoadEdgePort, the schema the Java EdgePort
// read in mods/edgeport/src/config/schema.ts), location.yaml
// (LoadLocation), dispatcher.yaml (LoadDispatcher), connect.yaml
// (LoadConnect) and spec.data of routr.yaml (LoadData). One loader, Load,
// reads them all: values may be literals, ${VAR} placeholders or secret://
// references (Resolve), and every error names the file and the key, never a
// value. The settings types here are what the components take.
package config

import (
	"strings"
)

// Transport is one entry of spec.transport.
type Transport struct {
	Protocol string `yaml:"protocol" json:"protocol"`
	BindAddr string `yaml:"bindAddr" json:"bindAddr"`
	Port     int    `yaml:"port" json:"port"`
}

// Client is spec.securityContext.client.
type Client struct {
	AuthType     string   `yaml:"authType" json:"authType"`
	Protocols    []string `yaml:"protocols" json:"protocols"`
	CipherSuites []string `yaml:"cipherSuites" json:"cipherSuites"`
}

// SecurityContext is spec.securityContext.
type SecurityContext struct {
	Debugging          bool    `yaml:"debugging" json:"debugging"`
	KeyStore           string  `yaml:"keyStore" json:"keyStore"`
	KeyStorePassword   string  `yaml:"keyStorePassword" json:"keyStorePassword"`
	KeyStoreType       string  `yaml:"keyStoreType" json:"keyStoreType"`
	TrustStore         string  `yaml:"trustStore" json:"trustStore"`
	TrustStorePassword string  `yaml:"trustStorePassword" json:"trustStorePassword"`
	Client             *Client `yaml:"client" json:"client"`
}

// Processor is spec.processor.
type Processor struct {
	Addr string `yaml:"addr" json:"addr"`
}

// Events is spec.events: where the EdgePort's call events go. Absent is
// nowhere. It replaces CONSOLE_PUBLISHER_ENABLED and NATS_PUBLISHER_*.
type Events struct {
	// Console logs every event.
	Console bool `yaml:"console" json:"console"`
	// NATS publishes every event as JSON on <subject>.<event name>; absent
	// is off.
	NATS *NATSEvents `yaml:"nats" json:"nats"`
}

// NATSEvents is spec.events.nats.
type NATSEvents struct {
	// URL is the NATS server; absent is DefaultNATSURL.
	URL string `yaml:"url" json:"url"`
	// Subject is the prefix of every event's subject; absent is
	// DefaultNATSSubject.
	Subject string `yaml:"subject" json:"subject"`
}

// DefaultNATSURL and DefaultNATSSubject are the Java EdgePort's defaults.
const (
	DefaultNATSURL     = "nats://localhost:4222"
	DefaultNATSSubject = "routr"
)

// Spec is the spec section of edgeport.yaml.
type Spec struct {
	BindAddr            string           `yaml:"bindAddr" json:"bindAddr"`
	ExternalAddrs       []string         `yaml:"externalAddrs" json:"externalAddrs"`
	Localnets           []string         `yaml:"localnets" json:"localnets"`
	Aliases             []string         `yaml:"aliases" json:"aliases"`
	Methods             []string         `yaml:"methods" json:"methods"`
	UnknownMethodAction string           `yaml:"unknownMethodAction" json:"unknownMethodAction"`
	Transport           []Transport      `yaml:"transport" json:"transport"`
	Processor           *Processor       `yaml:"processor" json:"processor"`
	SecurityContext     *SecurityContext `yaml:"securityContext" json:"securityContext"`
	// UDPReadBuffer is the kernel receive buffer, in bytes, asked for every UDP
	// transport; zero means the EdgePort's default (4 MiB).
	UDPReadBuffer int `yaml:"udpReadBuffer" json:"udpReadBuffer"`
	// ConnectionIdleTimeout is how many seconds a TCP, TLS, WS or WSS
	// connection may stay without receiving anything before the EdgePort
	// closes it; zero means the EdgePort's default (3900).
	ConnectionIdleTimeout int `yaml:"connectionIdleTimeout" json:"connectionIdleTimeout"`
	// MaxConnections is how many TCP, TLS, WS and WSS connections the
	// EdgePort accepts at once; zero means its default (20000).
	MaxConnections int `yaml:"maxConnections" json:"maxConnections"`
	// ProcessorAuth is how to reach the processor. Only a standalone EdgePort
	// dials one; RoutrOne's is in process.
	ProcessorAuth ClientAuth `yaml:"processorAuth" json:"processorAuth"`
	// IgnoreLoopbackFromLocalnets leaves loopback out of the localnets read
	// from the host's interfaces when localnets is empty
	// (IGNORE_LOOPBACK_FROM_LOCALNETS).
	IgnoreLoopbackFromLocalnets bool `yaml:"ignoreLoopbackFromLocalnets" json:"ignoreLoopbackFromLocalnets"`
	// StripSessionProgressSdp removes the body of a 183 Session Progress
	// before it is relayed (STRIP_SESSION_PROGRESS_SDP).
	StripSessionProgressSdp bool `yaml:"stripSessionProgressSdp" json:"stripSessionProgressSdp"`
	// SipTrace logs every SIP message the stack reads and writes
	// (JAIN_SIP_TRACE_LEVEL).
	SipTrace bool `yaml:"sipTrace" json:"sipTrace"`
	// Events is where call events go; absent is nowhere.
	Events *Events `yaml:"events" json:"events"`
	// Health is GET /healthz for an orchestrator (ENABLE_HEALTHCHECKS), in
	// edgeport.yaml only: routr.yaml has spec.health. Absent is off.
	Health *HealthSpec `yaml:"health" json:"health"`
}

// Config is the whole of edgeport.yaml.
type Config struct {
	Kind       string            `yaml:"kind" json:"kind"`
	APIVersion string            `yaml:"apiVersion" json:"apiVersion"`
	Ref        string            `yaml:"ref" json:"ref"`
	Metadata   map[string]string `yaml:"metadata" json:"metadata"`
	LogLevel   string            `yaml:"logLevel" json:"logLevel"`
	Spec       *Spec             `yaml:"spec" json:"spec"`
}

// LoadEdgePort reads edgeport.yaml (YAML or JSON), validates it as the Java
// EdgePort did and fills in the defaults (bindAddr 0.0.0.0, each
// transport's bindAddr).
func LoadEdgePort(path string, opts ResolveOptions) (*Config, error) {
	cfg := &Config{LogLevel: DefaultLogLevel}
	if err := Load(path, validateEdgePortFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseEdgePort is LoadEdgePort on the content of the file.
func ParseEdgePort(data []byte, opts ResolveOptions) (*Config, error) {
	cfg := &Config{LogLevel: DefaultLogLevel}
	if err := Parse(data, validateEdgePortFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

func validateEdgePortFile(raw map[string]any) error {
	if err := validateSchema(raw); err != nil {
		return err
	}
	return validateLogLevel(raw)
}

func (c *Config) finish() error {
	return finishEdgePortSpec(c.Spec)
}

// finishEdgePortSpec fills in the defaults of a validated EdgePort spec
// (bindAddr 0.0.0.0, each transport's bindAddr, lower-case protocols) and
// runs the assertions of mods/edgeport/src/assertions.ts.
func finishEdgePortSpec(spec *Spec) error {
	if spec.BindAddr == "" {
		spec.BindAddr = "0.0.0.0"
	}
	for i := range spec.Transport {
		spec.Transport[i].Protocol = strings.ToLower(spec.Transport[i].Protocol)
		if spec.Transport[i].BindAddr == "" {
			spec.Transport[i].BindAddr = spec.BindAddr
		}
	}

	if err := assertNoDuplicatedProto(spec.Transport); err != nil {
		return err
	}
	if err := assertNoDuplicatedPort(spec.Transport); err != nil {
		return err
	}
	if spec.Events != nil && spec.Events.NATS != nil {
		if spec.Events.NATS.URL == "" {
			spec.Events.NATS.URL = DefaultNATSURL
		}
		if spec.Events.NATS.Subject == "" {
			spec.Events.NATS.Subject = DefaultNATSSubject
		}
	}
	if spec.Health != nil && spec.Health.BindAddr == "" {
		spec.Health.BindAddr = DefaultHealthBindAddr
	}
	return assertHasSecurityContext(spec)
}
