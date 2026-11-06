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

package location

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// DefaultBindAddr is where the Location listens when spec.bindAddr is unset:
// the gRPC port CORE.md gives the Location Service.
const DefaultBindAddr = "0.0.0.0:51902"

// DefaultRedisParameters is what the Node service used for a redis cache
// without parameters.
const DefaultRedisParameters = "host=localhost,port=6379"

// Cache is spec.cache of location.yaml.
type Cache struct {
	Provider   string `yaml:"provider"`
	Parameters string `yaml:"parameters"`
}

// Spec is the spec section of location.yaml.
type Spec struct {
	BindAddr string `yaml:"bindAddr"`
	Cache    *Cache `yaml:"cache"`
}

// Config is location.yaml: the file the Node service read, validated against
// the same schema (mods/location/src/config/schema.ts).
type Config struct {
	Kind       string         `yaml:"kind"`
	APIVersion string         `yaml:"apiVersion"`
	Metadata   map[string]any `yaml:"metadata"`
	Spec       *Spec          `yaml:"spec"`
}

// Load reads and validates location.yaml and fills in the defaults.
func Load(path string) (*Config, error) {
	if path == "" {
		return nil, errors.New("CONFIG_PATH is not set")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config file %s: %w", path, err)
	}
	cfg, err := Parse(data)
	if err != nil {
		return nil, fmt.Errorf("config file %s: %w", path, err)
	}
	return cfg, nil
}

// Parse decodes and validates the content of location.yaml. The schema's
// required keys must be present; the enums are those of the Node schema plus
// apiVersion v3 (ROUTR3.md § 3.7).
func Parse(data []byte) (*Config, error) {
	raw := map[string]any{}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, errors.New("file is not a valid YAML file")
	}
	for _, key := range []string{"apiVersion", "kind", "metadata", "spec"} {
		if _, ok := raw[key]; !ok {
			return nil, fmt.Errorf("%s is required", key)
		}
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("file does not match the Location schema: %v", err)
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	cfg.applyDefaults()
	return &cfg, nil
}

func (c *Config) validate() error {
	if !oneOf(c.Kind, "Location", "location") {
		return errors.New("kind must be one of Location, location")
	}
	if !oneOf(c.APIVersion, "v2beta1", "v2", "v3") {
		return errors.New("apiVersion must be one of v2beta1, v2, v3")
	}
	if c.Spec == nil {
		return errors.New("spec must be an object")
	}
	if c.Spec.Cache != nil && c.Spec.Cache.Provider == "" {
		return errors.New("spec.cache.provider is required")
	}
	if c.Spec.Cache != nil && !oneOf(strings.ToLower(c.Spec.Cache.Provider), "memory", "redis") {
		return errors.New("spec.cache.provider must be one of memory, redis")
	}
	return nil
}

// applyDefaults is what the Node getConfig filled in: a memory cache when
// none is given, the local Redis for a redis cache without parameters, and
// the default bind address.
func (c *Config) applyDefaults() {
	if c.Spec.BindAddr == "" {
		c.Spec.BindAddr = DefaultBindAddr
	}
	if c.Spec.Cache == nil {
		c.Spec.Cache = &Cache{Provider: string(ProviderMemory)}
	}
	if strings.EqualFold(c.Spec.Cache.Provider, string(ProviderRedis)) && c.Spec.Cache.Parameters == "" {
		c.Spec.Cache.Parameters = DefaultRedisParameters
	}
}

func oneOf(value string, allowed ...string) bool {
	for _, a := range allowed {
		if value == a {
			return true
		}
	}
	return false
}
