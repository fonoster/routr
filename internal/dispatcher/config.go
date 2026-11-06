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

package dispatcher

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/fonoster/routr/internal/common/pb/processor"
)

// DefaultBindAddr is where the dispatcher listens when spec.bindAddr is
// empty: the Routr 2 port.
const DefaultBindAddr = "0.0.0.0:51901"

// ProcessorConfig is one entry of spec.processors: a Message Processor and
// the requests it takes.
type ProcessorConfig struct {
	Ref  string `yaml:"ref" json:"ref"`
	Addr string `yaml:"addr" json:"addr"`
	// Methods the processor accepts, by name (INVITE, REGISTER, ...)
	Methods []string `yaml:"methods" json:"methods"`
	// MatchFunc is a JavaScript arrow function over the MessageRequest,
	// as in Routr 2: `req => req.method === "INVITE"`
	MatchFunc string `yaml:"matchFunc" json:"matchFunc"`
}

// MiddlewareConfig is one entry of spec.middlewares. A middleware runs before
// the processor unless postProcessor is true.
type MiddlewareConfig struct {
	Ref           string `yaml:"ref" json:"ref"`
	Addr          string `yaml:"addr" json:"addr"`
	PostProcessor bool   `yaml:"postProcessor" json:"postProcessor"`
}

// Spec is the spec section of dispatcher.yaml.
type Spec struct {
	BindAddr    string             `yaml:"bindAddr" json:"bindAddr"`
	Processors  []ProcessorConfig  `yaml:"processors" json:"processors"`
	Middlewares []MiddlewareConfig `yaml:"middlewares" json:"middlewares"`
}

// Config is the whole of dispatcher.yaml (mods/dispatcher/src/config/schema.ts).
type Config struct {
	Kind       string `yaml:"kind" json:"kind"`
	APIVersion string `yaml:"apiVersion" json:"apiVersion"`
	Ref        string `yaml:"ref" json:"ref"`
	Spec       Spec   `yaml:"spec" json:"spec"`
}

// LoadConfig reads and validates the dispatcher.yaml at path.
func LoadConfig(path string) (*Config, error) {
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
	return ParseConfig(data)
}

// ParseConfig validates a dispatcher.yaml (YAML or JSON) and returns it. The
// checks are the Ajv schema's, plus the per-processor fields the Node schema
// meant to require but placed outside `items`: a processor without them would
// have failed at the first request instead of at load.
func ParseConfig(data []byte) (*Config, error) {
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, errors.New("file is not a valid JSON or YAML file")
	}
	if cfg.Kind == "" {
		return nil, errors.New("must have required property 'kind'")
	}
	if cfg.APIVersion == "" {
		return nil, errors.New("must have required property 'apiVersion'")
	}
	if cfg.Ref == "" {
		return nil, errors.New("must have required property 'ref'")
	}
	if cfg.Spec.BindAddr == "" {
		cfg.Spec.BindAddr = DefaultBindAddr
	}
	if len(cfg.Spec.Processors) == 0 {
		return nil, errors.New("spec.processors must have at least one processor")
	}
	for i, p := range cfg.Spec.Processors {
		if err := validateProcessor(i, p); err != nil {
			return nil, err
		}
	}
	for i, m := range cfg.Spec.Middlewares {
		if m.Ref == "" {
			return nil, fmt.Errorf("spec.middlewares[%d] must have required property 'ref'", i)
		}
		if m.Addr == "" {
			return nil, fmt.Errorf("spec.middlewares[%d] (ref = %s) must have required property 'addr'", i, m.Ref)
		}
	}
	return &cfg, nil
}

func validateProcessor(i int, p ProcessorConfig) error {
	if p.Ref == "" {
		return fmt.Errorf("spec.processors[%d] must have required property 'ref'", i)
	}
	if p.Addr == "" {
		return fmt.Errorf("spec.processors[%d] (ref = %s) must have required property 'addr'", i, p.Ref)
	}
	if p.Methods == nil {
		return fmt.Errorf("spec.processors[%d] (ref = %s) must have required property 'methods'", i, p.Ref)
	}
	for _, m := range p.Methods {
		if _, ok := processor.Method_value[m]; !ok {
			return fmt.Errorf("spec.processors[%d] (ref = %s) has an unknown method %q; known methods are %s",
				i, p.Ref, m, strings.Join(methodNames(), ", "))
		}
	}
	if strings.TrimSpace(p.MatchFunc) == "" {
		return fmt.Errorf("spec.processors[%d] (ref = %s) must have required property 'matchFunc'", i, p.Ref)
	}
	return nil
}

func methodNames() []string {
	names := make([]string, 0, len(processor.Method_name))
	for i := range int32(len(processor.Method_name)) {
		names = append(names, processor.Method_name[i])
	}
	return names
}
