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
	"fmt"
	"net"
)

// routr.yaml (ROUTR3.md § 3.7): RoutrOne reads every section; a standalone
// component reads its own.
//
// What RoutrOne needs at minimum, and why only that: spec.edgeport.transport
// (something to listen on) and spec.data.backend (somewhere to read agents
// and domains from; postgres also needs url, files needs path). Everything
// else has a default or an absence that means "off": connect falls back to
// Routr 2's nonce age and REGISTER expiry, location to the memory cache,
// rtprelay to no relay, every component's gRPC bindAddr to its Routr 2 port
// (an empty bindAddr turns that listener off), registry to no periodic
// REGISTER, health to no HTTP health check. spec.edgeport.methods
// defaults to the list Routr 2's RoutrOne bound Connect to and
// spec.edgeport.processor is not needed by RoutrOne, which dispatches in
// process; a standalone EdgePort still reads both from edgeport.yaml
// through LoadEdgePort.

// DefaultMethods is the method list of Routr 2's RoutrOne
// (mods/one/src/configs.ts): what its Dispatcher hands to Connect.
var DefaultMethods = []string{"REGISTER", "INVITE", "ACK", "BYE", "CANCEL", "REFER", "NOTIFY"}

// RTPRelaySpec is spec.rtprelay: the RTPEngine to drive.
type RTPRelaySpec struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	// TimeoutMs is how long a command waits for its answer; absent is the
	// relay's default.
	TimeoutMs int `yaml:"timeoutMs"`
	// Profiles change the shipped RTPEngine profiles, one key at a time.
	Profiles RTPRelayProfiles `yaml:"profiles"`
}

// DefaultHealthBindAddr is where every Routr 2 image answered /healthz.
const DefaultHealthBindAddr = "0.0.0.0:8080"

// HealthSpec is spec.health: GET /healthz for an orchestrator, what
// spec.signaling.healthChecks turned on in Routr 2's one.yaml. Absent is off.
type HealthSpec struct {
	// BindAddr is where it listens; absent is DefaultHealthBindAddr. To turn
	// the check off, remove the section.
	BindAddr string `yaml:"bindAddr"`
}

// DefaultRequesterBindAddr is the Requester's Routr 2 port.
const DefaultRequesterBindAddr = "0.0.0.0:51909"

// RequesterSpec is spec.requester: the Requester RoutrOne runs for the
// Registry and for whoever else reaches its gRPC service.
type RequesterSpec struct {
	// BindAddr is where the Requester serves gRPC; an empty string means it
	// is not served.
	BindAddr string `yaml:"bindAddr"`
	// SIPHost is the address its SIP listening points bind to and the one
	// written in Via and Contact, so an EdgePort must reach it. Empty is the
	// host's local IP, as in Routr 2. With spec.registry it is also the one
	// source Connect honors X-Gateway-Auth from, so it must then be an IP
	// that isn't loopback or unspecified.
	SIPHost string `yaml:"sipHost"`
}

// RegistryEdgePort is an entry of spec.registry.edgePorts: where a REGISTER
// leaves through.
type RegistryEdgePort struct {
	Address string `yaml:"address"`
	Region  string `yaml:"region"`
}

// RegistrySpec is spec.registry, the settings of registry.yaml that mean
// something in one process: the Requester and the Data API are in process
// and one RoutrOne keeps its registrations in memory.
type RegistrySpec struct {
	// RegisterInterval is the seconds between rounds; absent is the
	// Registry's default.
	RegisterInterval float64 `yaml:"registerInterval"`
	// Methods become the REGISTER's Allow headers.
	Methods []string `yaml:"methods"`
	// EdgePorts are the ways out; the first one is used.
	EdgePorts []RegistryEdgePort `yaml:"edgePorts"`
}

// RoutrSpec is the spec of routr.yaml. Sections that are absent and have no
// default are nil.
type RoutrSpec struct {
	EdgePort   *Spec          `yaml:"edgeport"`
	Dispatcher DispatcherSpec `yaml:"dispatcher"`
	Connect    ConnectSpec    `yaml:"connect"`
	Location   LocationSpec   `yaml:"location"`
	Data       DataSpec       `yaml:"data"`
	RTPRelay   *RTPRelaySpec  `yaml:"rtprelay"`
	Requester  RequesterSpec  `yaml:"requester"`
	Registry   *RegistrySpec  `yaml:"registry"`
	Health     *HealthSpec    `yaml:"health"`
}

// Routr is the whole of routr.yaml.
type Routr struct {
	APIVersion string            `yaml:"apiVersion"`
	Kind       string            `yaml:"kind"`
	Ref        string            `yaml:"ref"`
	Metadata   map[string]string `yaml:"metadata"`
	LogLevel   string            `yaml:"logLevel"`
	Spec       RoutrSpec         `yaml:"spec"`
}

// EdgePortConfig is spec.edgeport in the shape edgeport.New takes.
func (r *Routr) EdgePortConfig() *Config {
	return &Config{
		Kind:       "EdgePort",
		APIVersion: "v2",
		Ref:        r.Ref,
		Metadata:   r.Metadata,
		LogLevel:   r.LogLevel,
		Spec:       r.Spec.EdgePort,
	}
}

// LoadRoutr reads routr.yaml, resolves its placeholders and secret
// references through opts, validates it and fills in the defaults.
func LoadRoutr(path string, opts ResolveOptions) (*Routr, error) {
	cfg := newRoutr()
	if err := Load(path, validateRoutrSchema, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseRoutr is LoadRoutr on the content of the file.
func ParseRoutr(data []byte, opts ResolveOptions) (*Routr, error) {
	cfg := newRoutr()
	if err := Parse(data, validateRoutrSchema, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// newRoutr holds the defaults an absent key keeps: decoding writes an
// explicit value over them, so nonceMaxAge 0 or bindAddr "" are settings,
// not absences.
func newRoutr() *Routr {
	return &Routr{
		LogLevel: DefaultLogLevel,
		Spec: RoutrSpec{
			Dispatcher: DispatcherSpec{BindAddr: DefaultDispatcherBindAddr},
			Connect:    defaultConnectSpec(),
			Location:   LocationSpec{BindAddr: DefaultLocationBindAddr, Cache: Cache{Provider: "memory"}},
			Data:       DataSpec{BindAddr: DefaultDataBindAddr},
			Requester:  RequesterSpec{BindAddr: DefaultRequesterBindAddr},
		},
	}
}

func (r *Routr) finish() error {
	if len(r.Spec.EdgePort.Methods) == 0 {
		r.Spec.EdgePort.Methods = append([]string(nil), DefaultMethods...)
	}
	if err := finishEdgePortSpec(r.Spec.EdgePort); err != nil {
		return fmt.Errorf("spec.edgeport: %w", err)
	}
	if err := checkRegistrySIPHost(r); err != nil {
		return err
	}
	if r.Spec.Health != nil && r.Spec.Health.BindAddr == "" {
		r.Spec.Health.BindAddr = DefaultHealthBindAddr
	}
	return finishCache(&r.Spec.Location.Cache, "spec.location.cache")
}

// checkRegistrySIPHost refuses a sipHost Connect can't tell the Registry's
// REGISTER by. Its source is what X-Gateway-Auth is honored from: a name is no
// source address, and a loopback or unspecified address isn't one only the
// Requester sends from.
func checkRegistrySIPHost(r *Routr) error {
	host := r.Spec.Requester.SIPHost
	if r.Spec.Registry == nil || host == "" {
		return nil
	}
	ip := net.ParseIP(host)
	if ip == nil || ip.IsLoopback() || ip.IsUnspecified() {
		return fmt.Errorf("spec.requester.sipHost: with spec.registry should be an IP that is not loopback or unspecified, got %q", host)
	}
	return nil
}

// finishCache lower-cases the provider, fills the redis default and checks
// the parameters string parses.
func finishCache(cache *Cache, path string) error {
	cache.Provider = lowerProvider(cache.Provider)
	if cache.Provider != "redis" {
		return nil
	}
	if cache.Parameters == "" {
		cache.Parameters = DefaultRedisParameters
	}
	if _, err := ParseRedisParameters(cache.Parameters); err != nil {
		return fmt.Errorf("%s.parameters: %w", path, err)
	}
	return nil
}

func lowerProvider(provider string) string {
	switch provider {
	case "", "memory", "Memory":
		return "memory"
	case "redis", "Redis":
		return "redis"
	}
	return provider
}
