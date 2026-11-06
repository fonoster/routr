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

package requester

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/fonoster/routr/internal/common/config"
)

// DefaultBindAddr is the Requester's Routr 2 port.
const DefaultBindAddr = "0.0.0.0:51909"

// Spec is the spec of requester.yaml.
type Spec struct {
	BindAddr string `yaml:"bindAddr"`
	// SIPHost is the address the SIP listening points bind to and the one
	// written in Via and Contact; the host's local IP when empty.
	SIPHost string `yaml:"sipHost"`
}

// Config is requester.yaml. Routr 2's Requester read no file, so all of it is
// optional in practice: without a path LoadConfig returns the defaults.
type Config struct {
	Kind       string         `yaml:"kind"`
	APIVersion string         `yaml:"apiVersion"`
	Metadata   map[string]any `yaml:"metadata"`
	LogLevel   string         `yaml:"logLevel"`
	Spec       Spec           `yaml:"spec"`
}

// LoadConfig reads requester.yaml; an empty path means the defaults.
func LoadConfig(path string) (*Config, error) {
	cfg := &Config{LogLevel: config.DefaultLogLevel, Spec: Spec{BindAddr: DefaultBindAddr}}
	if path == "" {
		return cfg, nil
	}
	if err := config.Load(path, validateConfig, cfg, config.ResolveOptions{}); err != nil {
		return nil, err
	}
	return cfg, nil
}

// validateConfig checks the file with the wording the other files use.
func validateConfig(raw map[string]any) error {
	if raw == nil {
		return errors.New("(root): should be object")
	}
	for _, key := range []string{"apiVersion", "kind", "metadata", "spec"} {
		if _, ok := raw[key]; !ok {
			return fmt.Errorf("should have required property '%s'", key)
		}
	}
	if v, _ := raw["kind"].(string); v != "Requester" && v != "requester" {
		return errors.New(".kind should be equal to one of the allowed values")
	}
	if v, _ := raw["apiVersion"].(string); v != "v2beta1" && v != "v2" {
		return errors.New(".apiVersion should be equal to one of the allowed values")
	}
	if _, ok := raw["metadata"].(map[string]any); !ok {
		return errors.New(".metadata should be object")
	}
	if v, ok := raw["logLevel"]; ok {
		switch v {
		case "debug", "info", "warn", "error":
		default:
			return errors.New("logLevel: should be equal to one of the allowed values (debug, info, warn, error)")
		}
	}
	spec, ok := raw["spec"].(map[string]any)
	if !ok {
		return errors.New(".spec should be object")
	}
	if v, ok := spec["bindAddr"]; ok {
		s, isString := v.(string)
		if !isString {
			return errors.New(".spec.bindAddr should be string")
		}
		if _, _, err := splitAddress(s); err != nil {
			return fmt.Errorf(".spec.bindAddr %w", err)
		}
	}
	if v, ok := spec["sipHost"]; ok {
		if _, isString := v.(string); !isString {
			return errors.New(".spec.sipHost should be string")
		}
	}
	return nil
}

// splitAddress is AddressUtil: the host and port of ${host}:${port}.
func splitAddress(address string) (string, int, error) {
	parts := strings.Split(address, ":")
	if len(parts) != 2 {
		return "", 0, errors.New("malformated address; must be ${host}:${port}")
	}
	port, err := strconv.Atoi(parts[1])
	if err != nil {
		return "", 0, errors.New("expects port to be a number")
	}
	return parts[0], port, nil
}

// localIP is Utils.getLocalIP, InetAddress.getLocalHost: what the host's name
// resolves to, IPv4 only (the JVM ran with preferIPv4Stack). When the name
// gives nothing routable it falls back to the first address of an interface.
func localIP() (string, error) {
	if name, err := os.Hostname(); err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if ips, err := net.DefaultResolver.LookupIP(ctx, "ip4", name); err == nil {
			for _, ip := range ips {
				if !ip.IsLoopback() {
					return ip.String(), nil
				}
			}
		}
	}
	addrs, err := net.InterfaceAddrs()
	if err == nil {
		for _, a := range addrs {
			if ipnet, ok := a.(*net.IPNet); ok && ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
				return ipnet.IP.String(), nil
			}
		}
	}
	return "", errors.New("could not get local ip for requester service")
}
