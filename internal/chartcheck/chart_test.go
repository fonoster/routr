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

package chartcheck

import (
	"bytes"
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gopkg.in/yaml.v3"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	"github.com/fonoster/routr/internal/common/pb/location"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/connect"
	"github.com/fonoster/routr/internal/dispatcher"
	"github.com/fonoster/routr/internal/registry"
	"github.com/fonoster/routr/internal/requester"
)

const chartPath = "../../ops/charts/connect"

// required is the one value an install has to set (values.yaml: "Required for
// edgeport to work").
const required = `
edgeport:
  externalAddrs: [203.0.113.10]
`

// everythingOn turns on every optional block of the configs the chart renders.
const everythingOn = `
global:
  otlpEndpoint: http://otel-lgtm:4318
edgeport:
  externalAddrs: [203.0.113.10]
  localnets: [10.0.0.0/8]
  tls:
    protocols: [TLSv1.3, TLSv1.2]
    cipherSuites: [TLS_AES_256_GCM_SHA384]
  transport:
    tcp: { enabled: true }
    tls: { enabled: true }
    ws: { enabled: true }
    wss: { enabled: true }
dispatcher:
  middlewares:
    - ref: rtprelay-middleware
      serviceName: routr-rtprelay
      postProcessor: true
  recording:
    enabled: true
    mode: all
    lint:
      profiles: [sip, sip-connect]
connect:
  verifierAddr: verifier:51905
  untrustedHeadersToStrip: [X-Connect-Token]
  trustedEdgePorts: [edgeport-01]
  trustedEdgePortAddresses: [10.0.0.0/8]
  trustedRegistryAddresses:
    - "{{ .Release.Name }}-routr-requester-headless.{{ .Release.Namespace }}"
    - 10.0.0.9
    - 10.1.0.0/16
apiserver:
  cloakEncryptionKey: k1.aesgcm256.DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZnCY=
rtprelay:
  enabled: true
  rtpeHost: rtpengine
  profiles:
    phone-to-secure-phone:
      SDES: [only-AES_CM_128_HMAC_SHA1_80]
`

// memoryCaches is the same chart without Redis.
const memoryCaches = `
edgeport:
  externalAddrs: [203.0.113.10]
location:
  cache: { provider: memory }
registry:
  cache: { provider: memory }
redis:
  enabled: false
`

// noRegistry has no Registry and no Requester.
const noRegistry = `
edgeport:
  externalAddrs: [203.0.113.10]
registry:
  enabled: false
`

// resolve answers the secret:// references the chart writes with a value of the
// right shape; a real pod reads them from the mounted Secret.
func resolve() config.ResolveOptions {
	return config.ResolveOptions{
		Env:        config.EnvFromMap(nil),
		SecretsDir: "/secrets",
		ReadFile: func(path string) (string, error) {
			if strings.HasSuffix(path, "DATABASE_URL") {
				return "postgresql://routr:changeme@db:5432/routr", nil
			}
			if strings.HasSuffix(path, "CLOAK_ENCRYPTION_KEY") {
				return "k1.aesgcm256.DbQoar8ZLuUsOHZqyyBwUWiOaquZ5DBbVKvtg9dZnCY=", nil
			}
			return "changeme", nil
		},
	}
}

// loaders are the checks of each file the chart renders, by its name in the
// ConfigMap: what the binary that mounts it runs at start.
var loaders = map[string]func(t *testing.T, path string) error{
	"connect.yaml":    loadConnect,
	"dispatcher.yaml": loadDispatcher,
	"location.yaml": func(_ *testing.T, path string) error {
		_, err := config.LoadLocation(path, resolve())
		return err
	},
	"data.yaml": func(_ *testing.T, path string) error {
		_, err := config.LoadData(path, resolve())
		return err
	},
	"edgeport.yaml": func(_ *testing.T, path string) error {
		_, err := config.LoadEdgePort(path, resolve())
		return err
	},
	"registry.yaml": func(_ *testing.T, path string) error {
		_, err := registry.LoadFile(path, resolve())
		return err
	},
	"requester.yaml": func(_ *testing.T, path string) error {
		_, err := requester.LoadConfig(path)
		return err
	},
	"rtprelay.yaml": func(_ *testing.T, path string) error {
		_, err := config.LoadRTPRelay(path, resolve())
		return err
	},
}

// loadConnect also builds the processor, which is what checks the trust lists.
func loadConnect(t *testing.T, path string) error {
	cfg, err := config.LoadConnect(path, resolve())
	if err != nil {
		return err
	}
	// Never dialed: grpc.NewClient connects on the first call
	conn, err := grpc.NewClient("passthrough:///unused", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	spec := cfg.Spec
	_, err = connect.New(spec.ConnectSpec, connect.Trust{
		EdgePorts:         spec.TrustedEdgePorts,
		EdgePortAddresses: spec.TrustedEdgePortAddresses,
		RegistryAddresses: spec.TrustedRegistryAddresses,
	}, connect.Dependencies{
		Location: location.NewLocationClient(conn),
		Agents:   agents.NewAgentsClient(conn),
		Domains:  domains.NewDomainsClient(conn),
		Trunks:   trunks.NewTrunksClient(conn),
		Numbers:  numbers.NewNumbersClient(conn),
		Peers:    peers.NewPeersClient(conn),
	}, connect.Options{})
	return err
}

type noBackend struct {
	processor.ProcessorClient
}

func (noBackend) Close() error { return nil }

// loadDispatcher also builds the Dispatcher, which is what compiles the
// matchFuncs.
func loadDispatcher(_ *testing.T, path string) error {
	cfg, err := config.LoadDispatcher(path, resolve())
	if err != nil {
		return err
	}
	backends, err := dispatcher.Dial(cfg.Spec, func(string) (dispatcher.Backend, error) { return noBackend{}, nil })
	if err != nil {
		return err
	}
	defer backends.Close()
	_, err = dispatcher.New(dispatcher.Options{Processors: backends.Processors, Middlewares: backends.Middlewares})
	return err
}

// render runs helm template with the values and returns the files of the
// chart's own ConfigMaps by name. The subcharts' ConfigMaps are not Routr's.
func render(t *testing.T, values string) map[string]string {
	t.Helper()
	helm, err := exec.LookPath("helm")
	if err != nil {
		if os.Getenv("CI") != "" {
			t.Fatal("helm is required in CI")
		}
		t.Skip("helm is not installed")
	}
	valuesFile := filepath.Join(t.TempDir(), "values.yaml")
	if err := os.WriteFile(valuesFile, []byte(values), 0o600); err != nil {
		t.Fatal(err)
	}
	cmd := exec.CommandContext(context.Background(), helm, "template", "routr", chartPath, "--namespace", "routr", "--values", valuesFile)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("helm template: %v: %s", err, stderr.String())
	}

	files := map[string]string{}
	decoder := yaml.NewDecoder(&stdout)
	for {
		var doc struct {
			Kind     string `yaml:"kind"`
			Metadata struct {
				Name string `yaml:"name"`
			} `yaml:"metadata"`
			Data map[string]string `yaml:"data"`
		}
		err := decoder.Decode(&doc)
		if err == io.EOF {
			return files
		}
		if err != nil {
			t.Fatalf("the chart renders invalid YAML: %v", err)
		}
		if doc.Kind != "ConfigMap" || !strings.HasPrefix(doc.Metadata.Name, "routr-routr-") {
			continue
		}
		for name, content := range doc.Data {
			files[name] = content
		}
	}
}

func TestChartConfigsLoad(t *testing.T) {
	always := []string{"connect.yaml", "dispatcher.yaml", "location.yaml", "data.yaml", "edgeport.yaml"}
	withRegistry := append(append([]string(nil), always...), "registry.yaml", "requester.yaml")
	for name, tc := range map[string]struct {
		values string
		want   []string
	}{
		"the defaults":  {required, withRegistry},
		"everything on": {everythingOn, append(append([]string(nil), withRegistry...), "rtprelay.yaml")},
		"memory caches": {memoryCaches, withRegistry},
		"no Registry":   {noRegistry, always},
	} {
		t.Run(name, func(t *testing.T) {
			files := render(t, tc.values)
			for _, file := range tc.want {
				if _, ok := files[file]; !ok {
					t.Errorf("the chart renders no %s", file)
				}
			}
			dir := t.TempDir()
			for file, content := range files {
				load, ok := loaders[file]
				if !ok {
					t.Errorf("no binary is known to read %s: add its loader here", file)
					continue
				}
				path := filepath.Join(dir, file)
				if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
					t.Fatal(err)
				}
				if err := load(t, path); err != nil {
					t.Errorf("%s: %v\n%s", file, err, content)
				}
				// Every binary reads its telemetry key from the same file
				if _, err := config.LoadTelemetry(path, resolve()); err != nil {
					t.Errorf("%s: telemetry: %v", file, err)
				}
			}
		})
	}
}

func TestChartRefusesAnEmptyTrustedRegistryList(t *testing.T) {
	helm, err := exec.LookPath("helm")
	if err != nil {
		t.Skip("helm is not installed")
	}
	valuesFile := filepath.Join(t.TempDir(), "values.yaml")
	if err := os.WriteFile(valuesFile, []byte(required+"connect:\n  trustedRegistryAddresses: []\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	out, err := exec.CommandContext(context.Background(), helm, "template", "routr", chartPath, "--values", valuesFile).CombinedOutput()
	if err == nil || !strings.Contains(string(out), "connect.trustedRegistryAddresses is empty") {
		t.Errorf("the install fails naming the value: %v: %s", err, out)
	}
}
