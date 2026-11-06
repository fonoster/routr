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
// for RoutrOne (LoadRoutr, ROUTR3.md § 3.7) and the Routr 2 files a standalone
// component reads, edgeport.yaml (Load, the schema the Java EdgePort read in
// mods/edgeport/src/config/schema.ts) and location.yaml (LoadLocation). Values
// may be literals, ${VAR} placeholders or secret:// references (Resolve).
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
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
}

// Config is the whole of edgeport.yaml.
type Config struct {
	Kind       string            `yaml:"kind" json:"kind"`
	APIVersion string            `yaml:"apiVersion" json:"apiVersion"`
	Ref        string            `yaml:"ref" json:"ref"`
	Metadata   map[string]string `yaml:"metadata" json:"metadata"`
	Spec       *Spec             `yaml:"spec" json:"spec"`
}

// Load reads a YAML or JSON file, validates it as the Java EdgePort does and
// fills in the defaults (bindAddr 0.0.0.0, each transport's bindAddr).
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

// Parse decodes and validates the content of edgeport.yaml.
func Parse(data []byte) (*Config, error) {
	raw := map[string]any{}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		if jerr := json.Unmarshal(data, &raw); jerr != nil {
			return nil, errors.New("file is not a valid JSON or YAML file")
		}
	}
	if err := validateSchema(raw); err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		if jerr := json.Unmarshal(data, &cfg); jerr != nil {
			return nil, errors.New("file is not a valid JSON or YAML file")
		}
	}

	if err := finishEdgePortSpec(cfg.Spec); err != nil {
		return nil, err
	}
	return &cfg, nil
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
	return assertHasSecurityContext(spec)
}
