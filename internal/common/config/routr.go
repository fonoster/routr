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
)

// routr.yaml (ROUTR3.md § 3.7): RoutrOne reads every section; a standalone
// component reads its own.
//
// What RoutrOne needs at minimum, and why only that: spec.edgeport.transport
// (something to listen on) and spec.data.backend (somewhere to read agents
// and domains from; postgres also needs url, files needs path). Everything
// else has a default or an absence that means "off": connect falls back to
// Routr 2's nonce age and REGISTER expiry, location to the memory cache,
// rtprelay to no relay. spec.edgeport.methods defaults to the list Routr 2's
// edgeport.yaml shipped with and spec.edgeport.processor is not needed by
// RoutrOne, which dispatches in process; a standalone EdgePort still reads
// both from edgeport.yaml through Load.

// DefaultMethods is the method list of Routr 2's shipped edgeport.yaml.
var DefaultMethods = []string{"REGISTER", "MESSAGE", "INVITE", "ACK", "BYE", "CANCEL", "REFER", "NOTIFY"}

// Defaults of spec.connect, Routr 2's (mods/common/src/auth.ts
// NONCE_MAX_AGE_SECONDS, mods/connect REGISTER_DEFAULT_EXPIRES).
const (
	DefaultNonceMaxAge            = 300
	DefaultRegisterDefaultExpires = 3600
)

// ConnectSpec is spec.connect.
type ConnectSpec struct {
	// NonceMaxAge is how long, in seconds, a digest nonce stays valid; 0
	// accepts any nonce.
	NonceMaxAge int `yaml:"nonceMaxAge"`
	// RegisterDefaultExpires is the expiry, in seconds, granted to a REGISTER
	// that carries neither a Contact expires parameter nor an Expires header.
	RegisterDefaultExpires int `yaml:"registerDefaultExpires"`
}

// Cache is spec.location.cache: the provider and, for redis, the parameters
// string Routr 2's Location names (ParseRedisParameters reads it).
type Cache struct {
	Provider   string `yaml:"provider"`
	Parameters string `yaml:"parameters"`
}

// LocationSpec is spec.location.
type LocationSpec struct {
	Cache Cache `yaml:"cache"`
}

// DataSpec is spec.data.
type DataSpec struct {
	// Backend is postgres or files.
	Backend string `yaml:"backend"`
	// URL is the Postgres connection URL (backend postgres).
	URL string `yaml:"url"`
	// EncryptionKey is the cloak key Routr 2 set as CLOAK_ENCRYPTION_KEY;
	// empty stores and reads passwords in clear.
	EncryptionKey string `yaml:"encryptionKey"`
	// Path is the resources directory (backend files).
	Path string `yaml:"path"`
}

// RTPRelaySpec is spec.rtprelay: the RTPEngine to drive.
type RTPRelaySpec struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

// RoutrSpec is the spec of routr.yaml. Sections that are absent and have no
// default are nil.
type RoutrSpec struct {
	EdgePort *Spec         `yaml:"edgeport"`
	Connect  ConnectSpec   `yaml:"connect"`
	Location LocationSpec  `yaml:"location"`
	Data     DataSpec      `yaml:"data"`
	RTPRelay *RTPRelaySpec `yaml:"rtprelay"`
}

// Routr is the whole of routr.yaml.
type Routr struct {
	APIVersion string            `yaml:"apiVersion"`
	Kind       string            `yaml:"kind"`
	Ref        string            `yaml:"ref"`
	Metadata   map[string]string `yaml:"metadata"`
	Spec       RoutrSpec         `yaml:"spec"`
}

// EdgePortConfig is spec.edgeport in the shape edgeport.New takes.
func (r *Routr) EdgePortConfig() *Config {
	return &Config{
		Kind:       "EdgePort",
		APIVersion: "v2",
		Ref:        r.Ref,
		Metadata:   r.Metadata,
		Spec:       r.Spec.EdgePort,
	}
}

// LoadRoutr reads routr.yaml from the process environment and file system.
func LoadRoutr(path string) (*Routr, error) {
	return LoadRoutrWith(path, ResolveOptions{})
}

// LoadRoutrWith reads routr.yaml, resolves its placeholders and secret
// references through opts, validates it and fills in the defaults.
func LoadRoutrWith(path string, opts ResolveOptions) (*Routr, error) {
	raw, err := readTree(path)
	if err != nil {
		return nil, err
	}
	cfg, err := parseRoutr(raw, opts)
	if err != nil {
		return nil, fmt.Errorf("invalid config %s: %w", path, err)
	}
	return cfg, nil
}

// ParseRoutr decodes, resolves and validates the content of routr.yaml.
func ParseRoutr(data []byte, opts ResolveOptions) (*Routr, error) {
	raw, err := parseTree(data)
	if err != nil {
		return nil, err
	}
	return parseRoutr(raw, opts)
}

func parseRoutr(raw map[string]any, opts ResolveOptions) (*Routr, error) {
	resolved, err := Resolve(raw, opts)
	if err != nil {
		return nil, err
	}
	tree, _ := resolved.(map[string]any)
	if err := validateRoutrSchema(tree); err != nil {
		return nil, err
	}

	cfg := &Routr{
		Spec: RoutrSpec{
			Connect: ConnectSpec{
				NonceMaxAge:            DefaultNonceMaxAge,
				RegisterDefaultExpires: DefaultRegisterDefaultExpires,
			},
			Location: LocationSpec{Cache: Cache{Provider: "memory"}},
		},
	}
	if err := decodeTree(tree, cfg); err != nil {
		return nil, err
	}
	// nonceMaxAge: 0 is a setting, not an absence (decodeTree keeps the
	// default on an absent key and writes 0 on an explicit one).

	if len(cfg.Spec.EdgePort.Methods) == 0 {
		cfg.Spec.EdgePort.Methods = append([]string(nil), DefaultMethods...)
	}
	if err := finishEdgePortSpec(cfg.Spec.EdgePort); err != nil {
		return nil, fmt.Errorf("spec.edgeport: %w", err)
	}
	if err := finishCache(&cfg.Spec.Location.Cache, "spec.location.cache"); err != nil {
		return nil, err
	}
	return cfg, nil
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
