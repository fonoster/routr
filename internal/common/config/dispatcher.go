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
	"strings"

	"github.com/fonoster/routr/internal/common/pb/processor"
)

// DefaultDispatcherBindAddr is the Message Dispatcher's Routr 2 port.
const DefaultDispatcherBindAddr = "0.0.0.0:51901"

// DispatcherSpec is spec.dispatcher of routr.yaml and the settings part of
// dispatcher.yaml.
type DispatcherSpec struct {
	// BindAddr is where the Dispatcher serves the Processor service; in
	// routr.yaml an empty string means it is not served.
	BindAddr string `yaml:"bindAddr"`
}

// DispatcherProcessor is one entry of spec.processors of dispatcher.yaml: a
// Message Processor and the requests it takes.
type DispatcherProcessor struct {
	Ref  string `yaml:"ref"`
	Addr string `yaml:"addr"`
	// Methods the processor accepts, by name (INVITE, REGISTER, ...)
	Methods []string `yaml:"methods"`
	// MatchFunc is a JavaScript arrow function over the MessageRequest,
	// as in Routr 2: `req => req.method === "INVITE"`
	MatchFunc string `yaml:"matchFunc"`
}

// DispatcherMiddleware is one entry of spec.middlewares. A middleware runs
// before the processor unless postProcessor is true.
type DispatcherMiddleware struct {
	Ref           string `yaml:"ref"`
	Addr          string `yaml:"addr"`
	PostProcessor bool   `yaml:"postProcessor"`
}

// DispatcherFileSpec is the spec of dispatcher.yaml: the settings plus the
// processors and middlewares a standalone Dispatcher reaches by address.
type DispatcherFileSpec struct {
	DispatcherSpec `yaml:",inline"`
	Processors     []DispatcherProcessor  `yaml:"processors"`
	Middlewares    []DispatcherMiddleware `yaml:"middlewares"`
}

// DispatcherFile is dispatcher.yaml, the file the Node dispatcher read
// (mods/dispatcher/src/config/schema.ts).
type DispatcherFile struct {
	Kind       string             `yaml:"kind"`
	APIVersion string             `yaml:"apiVersion"`
	Ref        string             `yaml:"ref"`
	LogLevel   string             `yaml:"logLevel"`
	Spec       DispatcherFileSpec `yaml:"spec"`
}

// LoadDispatcher reads dispatcher.yaml.
func LoadDispatcher(path string, opts ResolveOptions) (*DispatcherFile, error) {
	cfg := newDispatcherFile()
	if err := Load(path, validateDispatcherFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseDispatcher is LoadDispatcher on the content of the file.
func ParseDispatcher(data []byte, opts ResolveOptions) (*DispatcherFile, error) {
	cfg := newDispatcherFile()
	if err := Parse(data, validateDispatcherFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

func newDispatcherFile() *DispatcherFile {
	return &DispatcherFile{LogLevel: DefaultLogLevel, Spec: DispatcherFileSpec{DispatcherSpec: DispatcherSpec{BindAddr: DefaultDispatcherBindAddr}}}
}

// validateDispatcherFile checks dispatcher.yaml with the Ajv schema's rules,
// plus the per-processor fields the Node schema meant to require but placed
// outside `items`: a processor without them would have failed at the first
// request instead of at load. Unknown keys pass, as they did with Ajv.
func validateDispatcherFile(raw map[string]any) error {
	if raw == nil {
		return errors.New("(root): should be object")
	}
	for _, key := range []string{"kind", "apiVersion", "ref"} {
		if s, _ := raw[key].(string); s == "" {
			return fmt.Errorf("must have required property '%s'", key)
		}
	}
	if err := validateLogLevel(raw); err != nil {
		return err
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return errors.New("spec: should be object")
	}
	if err := optionalString(spec, "spec", "bindAddr", true); err != nil {
		return err
	}
	processors, _ := spec["processors"].([]any)
	if len(processors) == 0 {
		return errors.New("spec.processors must have at least one processor")
	}
	for i, p := range processors {
		entry, _ := p.(map[string]any)
		if err := validateDispatcherProcessor(i, entry); err != nil {
			return err
		}
	}
	middlewares, _ := spec["middlewares"].([]any)
	for i, m := range middlewares {
		entry, _ := m.(map[string]any)
		ref, _ := entry["ref"].(string)
		if ref == "" {
			return fmt.Errorf("spec.middlewares[%d] must have required property 'ref'", i)
		}
		if addr, _ := entry["addr"].(string); addr == "" {
			return fmt.Errorf("spec.middlewares[%d] (ref = %s) must have required property 'addr'", i, ref)
		}
		if v, ok := entry["postProcessor"]; ok {
			if _, isBool := v.(bool); !isBool {
				return fmt.Errorf("spec.middlewares[%d] (ref = %s).postProcessor should be boolean", i, ref)
			}
		}
	}
	return nil
}

func validateDispatcherProcessor(i int, p map[string]any) error {
	ref, _ := p["ref"].(string)
	if ref == "" {
		return fmt.Errorf("spec.processors[%d] must have required property 'ref'", i)
	}
	if addr, _ := p["addr"].(string); addr == "" {
		return fmt.Errorf("spec.processors[%d] (ref = %s) must have required property 'addr'", i, ref)
	}
	methods, ok := p["methods"].([]any)
	if !ok {
		return fmt.Errorf("spec.processors[%d] (ref = %s) must have required property 'methods'", i, ref)
	}
	for _, m := range methods {
		name, _ := m.(string)
		if _, known := processor.Method_value[name]; !known {
			return fmt.Errorf("spec.processors[%d] (ref = %s) has an unknown method %q; known methods are %s",
				i, ref, name, strings.Join(MethodNames(), ", "))
		}
	}
	if matchFunc, _ := p["matchFunc"].(string); strings.TrimSpace(matchFunc) == "" {
		return fmt.Errorf("spec.processors[%d] (ref = %s) must have required property 'matchFunc'", i, ref)
	}
	return nil
}

// MethodNames lists every SIP method of the Processor service, in the
// order of the enum.
func MethodNames() []string {
	names := make([]string, 0, len(processor.Method_name))
	for i := range int32(len(processor.Method_name)) {
		names = append(names, processor.Method_name[i])
	}
	return names
}
