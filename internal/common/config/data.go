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

	"github.com/fonoster/routr/internal/common/cloak"
)

// DefaultDataBindAddr is Routr 2's apiserver port.
const DefaultDataBindAddr = "0.0.0.0:51907"

// The backends spec.data.backend names.
const (
	BackendFiles    = "files"
	BackendPostgres = "postgres"
)

// DataSpec is spec.data of routr.yaml: the backend of the Data API and
// what it needs.
type DataSpec struct {
	// BindAddr is where the Data API serves the seven Connect services; in
	// routr.yaml an empty string means it is not served.
	BindAddr string `yaml:"bindAddr"`
	// Backend is postgres or files.
	Backend string `yaml:"backend"`
	// URL is the Postgres connection URL (backend postgres).
	URL string `yaml:"url"`
	// EncryptionKey is the cloak key Routr 2 set as CLOAK_ENCRYPTION_KEY;
	// empty stores and reads passwords in clear.
	EncryptionKey string `yaml:"encryptionKey"`
	// Path is the resources directory (backend files).
	Path string `yaml:"path"`
	// EnforceE164Numbers, on unless set to false, makes a Number's telUrl
	// tel:+E.164 (EnforcesE164Numbers); false keeps Routr 2's check, a telUrl
	// that starts with tel:.
	EnforceE164Numbers *bool `yaml:"enforceE164Numbers"`
	// ServerAuth is who may call it. Beyond loopback it has to authenticate
	// callers, or say insecure: it returns decrypted credentials and takes writes.
	ServerAuth `yaml:",inline"`
}

// EnforcesE164Numbers is spec.data.enforceE164Numbers, true when absent.
func (d DataSpec) EnforcesE164Numbers() bool {
	return d.EnforceE164Numbers == nil || *d.EnforceE164Numbers
}

// DataFile is what a standalone Data API reads: spec.data of the same
// routr.yaml RoutrOne reads, and logLevel. The other sections are another
// component's and are not checked.
type DataFile struct {
	LogLevel string `yaml:"logLevel"`
	Spec     struct {
		Data DataSpec `yaml:"data"`
	} `yaml:"spec"`
}

// LoadData reads spec.data of routr.yaml.
func LoadData(path string, opts ResolveOptions) (*DataFile, error) {
	cfg := newDataFile()
	if err := Load(path, validateDataFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

// ParseData is LoadData on the content of the file.
func ParseData(data []byte, opts ResolveOptions) (*DataFile, error) {
	cfg := newDataFile()
	if err := Parse(data, validateDataFile, cfg, opts); err != nil {
		return nil, err
	}
	return cfg, nil
}

func newDataFile() *DataFile {
	cfg := &DataFile{LogLevel: DefaultLogLevel}
	cfg.Spec.Data.BindAddr = DefaultDataBindAddr
	return cfg
}

func validateDataFile(raw map[string]any) error {
	if raw == nil {
		return errors.New("(root): should be object")
	}
	if err := ValidateAPIVersion(raw); err != nil {
		return err
	}
	if err := validateLogLevel(raw); err != nil {
		return err
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return errors.New("spec: should be object")
	}
	if err := requiredKeys(spec, "spec", "data"); err != nil {
		return err
	}
	return validateDataSpec(spec)
}

// validateDataSpec checks spec.data, in routr.yaml and in what a standalone
// Data API reads.
func validateDataSpec(spec map[string]any) error {
	data, ok := spec["data"].(map[string]any)
	if !ok {
		return errors.New("spec.data: should be object")
	}
	if err := knownKeys(data, "spec.data", withServerAuth("bindAddr", "backend", "url", "encryptionKey", "path", "enforceE164Numbers")...); err != nil {
		return err
	}
	if err := requiredKeys(data, "spec.data", "backend"); err != nil {
		return err
	}
	backend, _ := data["backend"].(string)
	if backend != BackendPostgres && backend != BackendFiles {
		return errors.New("spec.data.backend: should be equal to one of the allowed values")
	}
	if err := optionalString(data, "spec.data", "bindAddr", false); err != nil {
		return err
	}
	for _, key := range []string{"url", "encryptionKey", "path"} {
		if err := optionalString(data, "spec.data", key, true); err != nil {
			return err
		}
	}
	if v, ok := data["enforceE164Numbers"]; ok {
		if _, isBool := v.(bool); !isBool {
			return errors.New("spec.data.enforceE164Numbers: should be boolean")
		}
	}
	if err := ValidateServerAuth(data, "spec.data"); err != nil {
		return err
	}
	if backend == BackendPostgres {
		if err := requiredKeys(data, "spec.data", "url"); err != nil {
			return err
		}
	}
	if backend == BackendFiles {
		if err := requiredKeys(data, "spec.data", "path"); err != nil {
			return err
		}
	}
	if key, ok := data["encryptionKey"].(string); ok && !cloak.IsKey(key) {
		return fmt.Errorf("spec.data.encryptionKey: should be a cloak key (k1.aesgcm256.<base64url key>)")
	}
	return nil
}
