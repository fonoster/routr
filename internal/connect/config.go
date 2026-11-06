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

package connect

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/fonoster/routr/internal/common/auth"
)

// DefaultBindAddr is the address the Connect processor serves on, Routr 2's
// BIND_ADDR default.
const DefaultBindAddr = "0.0.0.0:51904"

// DefaultRegisterExpires is the expiry, in seconds, granted to a REGISTER
// that carries neither a Contact expires parameter nor an Expires header
// (RFC 3261 section 10.3, step 7).
const DefaultRegisterExpires = 3600

// Spec is the spec section of connect.yaml: the settings Routr 2 read from
// the environment (mods/connect/src/envs.ts), by their camelCase names.
type Spec struct {
	// BindAddr is where the processor serves gRPC (BIND_ADDR)
	BindAddr string `yaml:"bindAddr" json:"bindAddr"`
	// LocationAddr is the Location service (LOCATION_ADDR)
	LocationAddr string `yaml:"locationAddr" json:"locationAddr"`
	// APIAddr is the Data API (API_ADDR)
	APIAddr string `yaml:"apiAddr" json:"apiAddr"`
	// NonceMaxAge is how long, in seconds, a digest nonce stays valid
	// (NONCE_MAX_AGE); 0 accepts any nonce, which the corpus replay needs
	NonceMaxAge *int `yaml:"nonceMaxAge" json:"nonceMaxAge"`
	// RegisterDefaultExpires is the expiry granted to a REGISTER that names
	// none (REGISTER_DEFAULT_EXPIRES)
	RegisterDefaultExpires *int `yaml:"registerDefaultExpires" json:"registerDefaultExpires"`
	// TrustedEdgePorts narrows which X-Edgeport-Ref values are honored
	// (TRUSTED_EDGEPORTS); empty means any ref from a trusted address
	TrustedEdgePorts []string `yaml:"trustedEdgePorts" json:"trustedEdgePorts"`
	// TrustedEdgePortAddresses are the peer EdgePorts, as IPs or CIDRs, whose
	// forwarded requests skip routing (TRUSTED_EDGEPORT_ADDRESSES); empty, the
	// default, trusts none
	TrustedEdgePortAddresses []string `yaml:"trustedEdgePortAddresses" json:"trustedEdgePortAddresses"`
}

// Config is the whole of connect.yaml.
type Config struct {
	Kind       string            `yaml:"kind" json:"kind"`
	APIVersion string            `yaml:"apiVersion" json:"apiVersion"`
	Ref        string            `yaml:"ref" json:"ref"`
	Metadata   map[string]string `yaml:"metadata" json:"metadata"`
	Spec       *Spec             `yaml:"spec" json:"spec"`
}

// Load reads connect.yaml from the given path and validates it.
func Load(path string) (*Config, error) {
	if path == "" {
		return nil, errors.New("CONFIG_PATH is not set")
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil, fmt.Errorf("config file %s does not exist", path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config file %s does not exist", path)
	}
	return Parse(data)
}

// Parse decodes and validates the content of connect.yaml and fills in the
// defaults: bindAddr 0.0.0.0:51904, nonceMaxAge 300, registerDefaultExpires
// 3600.
func Parse(data []byte) (*Config, error) {
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, errors.New("file is not a valid YAML file")
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (cfg *Config) validate() error {
	if cfg.Spec == nil {
		return errors.New("spec is required")
	}
	if cfg.Kind != "" && !strings.EqualFold(cfg.Kind, "Connect") {
		return fmt.Errorf("kind must be Connect, got %q", cfg.Kind)
	}
	spec := cfg.Spec
	if spec.BindAddr == "" {
		spec.BindAddr = DefaultBindAddr
	}
	if spec.LocationAddr == "" {
		return errors.New("spec.locationAddr is required")
	}
	if spec.APIAddr == "" {
		return errors.New("spec.apiAddr is required")
	}
	if spec.NonceMaxAge == nil {
		v := auth.NonceMaxAgeSeconds
		spec.NonceMaxAge = &v
	} else if *spec.NonceMaxAge < 0 {
		return fmt.Errorf("spec.nonceMaxAge must be a non-negative integer, got %d", *spec.NonceMaxAge)
	}
	if spec.RegisterDefaultExpires == nil {
		v := DefaultRegisterExpires
		spec.RegisterDefaultExpires = &v
	} else if *spec.RegisterDefaultExpires <= 0 {
		return fmt.Errorf("spec.registerDefaultExpires must be a positive integer, got %d", *spec.RegisterDefaultExpires)
	}
	return nil
}
