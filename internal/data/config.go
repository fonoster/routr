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

package data

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/fonoster/routr/internal/common/config"
)

// The backends spec.data.backend names
const (
	BackendFiles    = "files"
	BackendPostgres = "postgres"
)

// DefaultBindAddr is Routr 2's apiserver address.
const DefaultBindAddr = "0.0.0.0:51907"

// Config is spec.data of routr.yaml (ROUTR3.md § 3.7): the backend and
// what it needs. A standalone Data API reads this section of the same file
// RoutrOne reads; the config slice owns the whole file and resolves the
// secret:// and ${VAR} references, so a value left unresolved is an error
// here.
type Config struct {
	// Backend is files or postgres
	Backend string `yaml:"backend"`
	// Path is the resources directory of the files backend
	Path string `yaml:"path"`
	// URL is the database URL of the postgres backend
	URL string `yaml:"url"`
	// EncryptionKey is the cloak key the passwords were encrypted with, or
	// empty when they are stored in clear
	EncryptionKey string `yaml:"encryptionKey"`
	// BindAddr is where the gRPC server listens; DefaultBindAddr by default
	BindAddr string `yaml:"bindAddr"`
}

// routrFile is the part of routr.yaml the Data API reads.
type routrFile struct {
	Spec struct {
		Data *Config `yaml:"data"`
	} `yaml:"spec"`
}

// LoadConfig reads spec.data from the file.
func LoadConfig(path string) (*Config, error) {
	if path == "" {
		return nil, errors.New("CONFIG_PATH is not set")
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil, fmt.Errorf("config file %s does not exist", path)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config file %s does not exist", path)
	}
	return ParseConfig(content)
}

// ParseConfig reads spec.data from the content of routr.yaml, resolves its
// ${VAR} placeholders and secret:// references from the process environment
// and the file system (ROUTR3.md § 3.7), and validates it.
func ParseConfig(content []byte) (*Config, error) {
	return ParseConfigWith(content, config.ResolveOptions{})
}

// ParseConfigWith is ParseConfig with injectable resolvers.
func ParseConfigWith(content []byte, opts config.ResolveOptions) (*Config, error) {
	raw := map[string]any{}
	if err := yaml.Unmarshal(content, &raw); err != nil {
		return nil, fmt.Errorf("config file is not valid YAML: %w", err)
	}
	resolved, err := config.Resolve(raw, opts)
	if err != nil {
		return nil, err
	}
	content, err = yaml.Marshal(resolved)
	if err != nil {
		return nil, err
	}
	var file routrFile
	if err := yaml.Unmarshal(content, &file); err != nil {
		return nil, fmt.Errorf("config file is not valid YAML: %w", err)
	}
	cfg := file.Spec.Data
	if cfg == nil {
		return nil, errors.New("config file has no spec.data section")
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// Validate checks the section: a known backend with what it needs, and no
// unresolved reference.
func (c *Config) Validate() error {
	switch c.Backend {
	case BackendFiles:
		if c.Path == "" {
			return errors.New("spec.data.path is required for the files backend")
		}
	case BackendPostgres:
		if c.URL == "" {
			return errors.New("spec.data.url is required for the postgres backend")
		}
		if err := resolved("spec.data.url", c.URL); err != nil {
			return err
		}
		if err := resolved("spec.data.encryptionKey", c.EncryptionKey); err != nil {
			return err
		}
	case "":
		return errors.New("spec.data.backend is required (files or postgres)")
	default:
		return fmt.Errorf("spec.data.backend must be files or postgres, not %q", c.Backend)
	}
	if c.BindAddr == "" {
		c.BindAddr = DefaultBindAddr
	}
	return nil
}

// resolved rejects a secret:// or ${VAR} reference that nothing resolved.
// The error names the key and the reference, never a value.
func resolved(key, value string) error {
	if strings.HasPrefix(value, "secret://") || strings.Contains(value, "${") {
		return fmt.Errorf("%s holds an unresolved reference %q", key, value)
	}
	return nil
}
