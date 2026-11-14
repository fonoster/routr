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
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"slices"
	"strconv"
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
	"github.com/fonoster/routr/internal/common/service"
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
  enabled: true
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
  # One replica: replicas of the memory cache would each hold their own registrations
  replicas: 1
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
		// HOSTNAME is the pod's name, which edgeport.yaml takes as its ref, and
		// POD_IP its IP, which localnets may name
		Env:        config.EnvFromMap(map[string]string{"HOSTNAME": "routr-edgeport-0", "POD_IP": "10.244.1.12"}),
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
		_, err := requester.LoadConfigWith(path, resolve())
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
	// The Dispatcher is off by default (dispatcher.enabled): the EdgePorts call Connect
	always := []string{"connect.yaml", "location.yaml", "data.yaml", "edgeport.yaml"}
	withRegistry := append(append([]string(nil), always...), "registry.yaml", "requester.yaml")
	for name, tc := range map[string]struct {
		values string
		want   []string
	}{
		"the defaults":  {required, withRegistry},
		"everything on": {everythingOn, append(append([]string(nil), withRegistry...), "dispatcher.yaml", "rtprelay.yaml")},
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
				if !strings.Contains(content, "\napiVersion: v3\n") && !strings.HasPrefix(content, "apiVersion: v3\n") {
					t.Errorf("%s doesn't say apiVersion: v3\n%s", file, content)
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

// renderAll is helm template's whole output.
func renderAll(t *testing.T, values string) string {
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
	out, err := exec.CommandContext(context.Background(), helm, "template", "routr", chartPath, "--namespace", "routr", "--values", valuesFile).CombinedOutput()
	if err != nil {
		t.Fatalf("helm template: %v: %s", err, out)
	}
	return string(out)
}

// writeRendered writes the rendered file where the binary's loader can read it.
func writeRendered(t *testing.T, files map[string]string, name string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(files[name]), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

// dials checks that the component would start with this client auth toward
// addr: service.DialCredentials refuses a key in clear beyond loopback. The CA
// file is mounted in the pod, not here, so the system's roots stand in for it.
func dials(t *testing.T, section string, auth config.ClientAuth, addr string) {
	t.Helper()
	if auth.TLS != nil {
		tls := *auth.TLS
		tls.CAFile = ""
		auth.TLS = &tls
	}
	if _, err := service.DialCredentials(auth, addr); err != nil {
		t.Errorf("%s: the component would refuse to start: %v", section, err)
	}
}

func TestChartEnforceE164Numbers(t *testing.T) {
	for name, tc := range map[string]struct {
		values string
		want   bool
	}{
		"the default": {required, true},
		"true":        {required + "apiserver:\n  enforceE164Numbers: true\n", true},
		"false":       {required + "apiserver:\n  enforceE164Numbers: false\n", false},
	} {
		t.Run(name, func(t *testing.T) {
			data, err := config.LoadData(writeRendered(t, render(t, tc.values), "data.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if got := data.Spec.Data.EnforcesE164Numbers(); got != tc.want {
				t.Errorf("spec.data.enforceE164Numbers = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestChartAuthenticatesTheDataAPIAndTheRequester(t *testing.T) {
	const ref = "changeme" // what resolve() answers the API key's reference with
	for name, tc := range map[string]struct {
		values                string
		wantTLS, wantClientCA bool
	}{
		"the defaults":     {required, true, false},
		"no TLS":           {required + "apiserver:\n  tlsOn: false\n", false, false},
		"client certs":     {required + "apiserver:\n  verifyClientCert: true\n", true, true},
		"a Secret of mine": {required + "apiserver:\n  tlsSecret: mine\n", true, false},
	} {
		t.Run(name, func(t *testing.T) {
			files := render(t, tc.values)

			data, err := config.LoadData(writeRendered(t, files, "data.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			auth := data.Spec.Data.ServerAuth
			if !auth.Authenticated() || auth.Insecure {
				t.Errorf("the Data API would refuse to start, or not ask: %+v", auth)
			}
			if (auth.TLS != nil) != tc.wantTLS || (auth.TLS != nil && (auth.TLS.ClientCAFile != "") != tc.wantClientCA) {
				t.Errorf("data.yaml tls: %+v", auth.TLS)
			}

			req, err := requester.LoadConfigWith(writeRendered(t, files, "requester.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if !req.Spec.Authenticated() || req.Spec.Insecure {
				t.Errorf("the Requester would refuse to start, or not ask: %+v", req.Spec.ServerAuth)
			}

			conn, err := config.LoadConnect(writeRendered(t, files, "connect.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if conn.Spec.APIAuth.APIKey != ref || (conn.Spec.APIAuth.TLS != nil) != tc.wantTLS || conn.Spec.APIAuth.Insecure == tc.wantTLS {
				t.Errorf("connect.yaml spec.apiAuth: %+v", conn.Spec.APIAuth)
			}
			dials(t, "connect.yaml spec.apiAuth", conn.Spec.APIAuth, conn.Spec.APIAddr)
			dials(t, "connect.yaml spec.locationAuth", conn.Spec.LocationAuth, conn.Spec.LocationAddr)

			reg, err := registry.LoadFile(writeRendered(t, files, "registry.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if reg.Spec.APIAuth.APIKey != ref || (reg.Spec.APIAuth.TLS != nil) != tc.wantTLS || reg.Spec.APIAuth.Insecure == tc.wantTLS {
				t.Errorf("registry.yaml spec.apiAuth: %+v", reg.Spec.APIAuth)
			}
			// The Requester serves no TLS, so the chart says the key goes in clear
			if reg.Spec.RequesterAuth.APIKey != ref || reg.Spec.RequesterAuth.TLS != nil || !reg.Spec.RequesterAuth.Insecure {
				t.Errorf("registry.yaml spec.requesterAuth: %+v", reg.Spec.RequesterAuth)
			}
			dials(t, "registry.yaml spec.apiAuth", reg.Spec.APIAuth, reg.Spec.APIAddr)
			dials(t, "registry.yaml spec.requesterAuth", reg.Spec.RequesterAuth, reg.Spec.RequesterAddr)
		})
	}
}

func TestChartMountsWhatTheConfigsName(t *testing.T) {
	all := renderAll(t, required)
	for _, want := range []string{
		"name: routr-routr-api-key",
		"name: routr-routr-apiserver-tls",
		"mountPath: /var/run/routr/secrets/routr-routr-api-key",
		"mountPath: /etc/routr/certs/apiserver",
		"name: external",
		"tcpSocket:\n              port: 51907",
	} {
		if !strings.Contains(all, want) {
			t.Errorf("the chart renders no %q", want)
		}
	}
	// A client mounts only the CA of the Data API's Secret, never its key
	if !strings.Contains(all, "- key: ca.crt") {
		t.Error("a client's volume narrows the Secret to ca.crt")
	}

	plain := renderAll(t, required+"apiserver:\n  tlsOn: false\n")
	if strings.Contains(plain, "routr-routr-apiserver-tls") {
		t.Error("tlsOn false still generates a certificate")
	}
	if !strings.Contains(plain, "grpc:\n              port: 51907") || strings.Contains(plain, "tcpSocket:\n              port: 51907") {
		t.Error("tlsOn false keeps the gRPC probe")
	}

	mine := renderAll(t, required+"apiserver:\n  tlsSecret: mine\n  apiKey: my-own-key\n")
	if strings.Contains(mine, "name: routr-routr-apiserver-tls") || !strings.Contains(mine, "secretName: mine") {
		t.Error("tlsSecret replaces the generated Secret")
	}
	if !strings.Contains(mine, "apiKey: \"bXktb3duLWtleQ==\"") {
		t.Error("apiserver.apiKey is what the Secret holds")
	}
}

func TestChartRefusesClientCertsWithoutTLS(t *testing.T) {
	helm, err := exec.LookPath("helm")
	if err != nil {
		t.Skip("helm is not installed")
	}
	valuesFile := filepath.Join(t.TempDir(), "values.yaml")
	if err := os.WriteFile(valuesFile, []byte(required+"apiserver:\n  tlsOn: false\n  verifyClientCert: true\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	out, err := exec.CommandContext(context.Background(), helm, "template", "routr", chartPath, "--values", valuesFile).CombinedOutput()
	if err == nil || !strings.Contains(string(out), "apiserver.verifyClientCert") {
		t.Errorf("the install fails naming the value: %v: %s", err, out)
	}
}

// renderNotes is the chart's NOTES.txt, rendered with the values. helm template
// prints no notes and an install's dry run asks for a cluster, so a chart of
// the same values and helpers renders the file into a ConfigMap.
func renderNotes(t *testing.T, values string) string {
	t.Helper()
	helm, err := exec.LookPath("helm")
	if err != nil {
		if os.Getenv("CI") != "" {
			t.Fatal("helm is required in CI")
		}
		t.Skip("helm is not installed")
	}
	dir := t.TempDir()
	const notes = "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: notes\ndata:\n  notes: {{ tpl (.Files.Get \"NOTES.txt\") . | quote }}\n"
	for name, content := range map[string]string{
		"Chart.yaml":           "apiVersion: v2\nname: routr-connect\nversion: 0.0.0\n",
		"templates/notes.yaml": notes,
		"overrides.yaml":       values,
	} {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	for from, to := range map[string]string{
		"values.yaml":            "values.yaml",
		"templates/_helpers.tpl": "templates/_helpers.tpl",
		"templates/NOTES.txt":    "NOTES.txt",
	} {
		content, err := os.ReadFile(filepath.Join(chartPath, from))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, to), content, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	out, err := exec.CommandContext(context.Background(), helm, "template", "routr", dir, "--namespace", "routr", "--values", filepath.Join(dir, "overrides.yaml")).CombinedOutput()
	if err != nil {
		t.Fatalf("helm template: %v: %s", err, out)
	}
	var doc struct {
		Data map[string]string `yaml:"data"`
	}
	if err := yaml.Unmarshal(out, &doc); err != nil {
		t.Fatalf("the notes render invalid YAML: %v: %s", err, out)
	}
	return doc.Data["notes"]
}

func TestChartTakesAnExistingAPIKeySecret(t *testing.T) {
	const values = required + "apiserver:\n  apiKeySecret: my-key\n"

	objects := renderObjects(t, values)
	if _, ok := objects["Secret/routr-routr-api-key"]; ok {
		t.Error("apiKeySecret still renders the generated Secret")
	}
	for _, component := range []string{"apiserver", "requester", "connect", "registry"} {
		d, ok := objects["Deployment/routr-routr-"+component]
		if !ok {
			t.Errorf("no Deployment routr-routr-%s", component)
			continue
		}
		var volume string
		volumes, _ := d.get("spec", "template", "spec", "volumes").([]any)
		for _, v := range volumes {
			if v := object(v.(map[string]any)); v.get("secret", "secretName") == "my-key" {
				volume, _ = v.get("name").(string)
			}
		}
		if volume == "" {
			t.Errorf("%s has no volume of the Secret my-key: %v", component, volumes)
			continue
		}
		mounted := false
		containers, _ := d.get("spec", "template", "spec", "containers").([]any)
		for _, c := range containers {
			mounts, _ := object(c.(map[string]any)).get("volumeMounts").([]any)
			for _, m := range mounts {
				m := object(m.(map[string]any))
				if m.get("name") == volume && m.get("mountPath") == "/var/run/routr/secrets/my-key" {
					mounted = true
				}
			}
		}
		if !mounted {
			t.Errorf("%s mounts no %s at /var/run/routr/secrets/my-key", component, volume)
		}
	}

	files := render(t, values)
	for _, file := range []string{"connect.yaml", "registry.yaml", "data.yaml", "requester.yaml"} {
		if !strings.Contains(files[file], "secret://k8s/my-key#apiKey") {
			t.Errorf("%s names no secret://k8s/my-key#apiKey:\n%s", file, files[file])
		}
		if strings.Contains(files[file], "routr-routr-api-key") {
			t.Errorf("%s still names the generated Secret", file)
		}
	}

	notes := renderNotes(t, values)
	if !strings.Contains(notes, "kubectl get secret --namespace routr my-key ") || !strings.Contains(notes, "apiserver.apiKeySecret") {
		t.Errorf("the notes read the key from another Secret:\n%s", notes)
	}
	if generated := renderNotes(t, required); !strings.Contains(generated, "kubectl get secret --namespace routr routr-routr-api-key ") || strings.Contains(generated, "apiKeySecret") {
		t.Errorf("the default notes read the key from another Secret:\n%s", generated)
	}
}

func TestChartRefusesAnAPIKeyAndAnAPIKeySecret(t *testing.T) {
	helm, err := exec.LookPath("helm")
	if err != nil {
		t.Skip("helm is not installed")
	}
	valuesFile := filepath.Join(t.TempDir(), "values.yaml")
	if err := os.WriteFile(valuesFile, []byte(required+"apiserver:\n  apiKey: my-own-key\n  apiKeySecret: my-key\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	out, err := exec.CommandContext(context.Background(), helm, "template", "routr", chartPath, "--values", valuesFile).CombinedOutput()
	if err == nil || !strings.Contains(string(out), "apiserver.apiKey and apiserver.apiKeySecret are both set: use one.") {
		t.Errorf("the install fails naming the values: %v: %s", err, out)
	}
}

func TestChartKeepsTheGeneratedAPIKeySecret(t *testing.T) {
	secret, ok := renderObjects(t, required)["Secret/routr-routr-api-key"]
	if !ok {
		t.Fatal("the defaults render no Secret routr-routr-api-key")
	}
	if got := secret.get("metadata", "annotations", "helm.sh/resource-policy"); got != "keep" {
		t.Errorf("helm.sh/resource-policy = %v, want keep: an upgrade to apiKeySecret would delete the key", got)
	}
}

func TestChartLocalnetsCanNameThePodIP(t *testing.T) {
	values := "edgeport:\n  externalAddrs: [203.0.113.10]\n  localnets: [\"${POD_IP}/16\"]\n"
	if all := renderAll(t, values); !strings.Contains(all, "- name: POD_IP\n              valueFrom:\n                fieldRef:\n                  fieldPath: status.podIP") {
		t.Error("the EdgePort has no POD_IP")
	}
	path := filepath.Join(t.TempDir(), "edgeport.yaml")
	if err := os.WriteFile(path, []byte(render(t, values)["edgeport.yaml"]), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := config.LoadEdgePort(path, resolve())
	if err != nil {
		t.Fatal(err)
	}
	if got := cfg.Spec.Localnets; len(got) != 1 || got[0] != "10.244.1.12/16" {
		t.Errorf("localnets = %v", got)
	}
}

func TestEdgePortProcessorFollowsTheDispatcherSwitch(t *testing.T) {
	for name, tc := range map[string]struct {
		values string
		want   string
	}{
		"off by default": {required, "routr-routr-connect-headless.routr:51904"},
		"on":             {everythingOn, "routr-routr-dispatcher-headless.routr:51901"},
	} {
		t.Run(name, func(t *testing.T) {
			edgeport := render(t, tc.values)["edgeport.yaml"]
			if !strings.Contains(edgeport, "addr: "+tc.want) {
				t.Errorf("edgeport.yaml processor is not %s:\n%s", tc.want, edgeport)
			}
		})
	}
}

// object is one Kubernetes object the chart renders, as YAML maps.
type object map[string]any

// get walks the keys of an object; nil when one is missing.
func (o object) get(keys ...string) any {
	var v any = map[string]any(o)
	for _, k := range keys {
		m, ok := v.(map[string]any)
		if !ok {
			return nil
		}
		v = m[k]
	}
	return v
}

// renderObjects is helm template's output by kind and name.
func renderObjects(t *testing.T, values string) map[string]object {
	t.Helper()
	objects := map[string]object{}
	decoder := yaml.NewDecoder(strings.NewReader(renderAll(t, values)))
	for {
		// A map[string]any, so the nested maps decode as map[string]any too
		var m map[string]any
		err := decoder.Decode(&m)
		o := object(m)
		if err == io.EOF {
			return objects
		}
		if err != nil {
			t.Fatalf("the chart renders invalid YAML: %v", err)
		}
		if o == nil {
			continue
		}
		name, _ := o.get("metadata", "name").(string)
		kind, _ := o.get("kind").(string)
		objects[kind+"/"+name] = o
	}
}

// stateless are the Deployments the chart scales out by default, by their
// values key, and the gRPC port of their headless Service.
var stateless = map[string]int{"connect": 51904, "apiserver": 51907, "location": 51902}

func TestChartScalesOutTheStatelessServices(t *testing.T) {
	check := func(t *testing.T, objects map[string]object, component string, port int) {
		name := "routr-routr-" + component
		d, ok := objects["Deployment/"+name]
		if !ok {
			t.Fatalf("no Deployment %s", name)
		}
		if got := d.get("spec", "replicas"); got != 2 {
			t.Errorf("%s replicas = %v, want 2", name, got)
		}
		pod := d.get("spec", "template", "spec").(map[string]any)
		spread, _ := pod["topologySpreadConstraints"].([]any)
		if len(spread) != 1 {
			t.Fatalf("%s spreads over no topology: %v", name, pod["topologySpreadConstraints"])
		}
		c := object(spread[0].(map[string]any))
		if c.get("topologyKey") != "kubernetes.io/hostname" || c.get("maxSkew") != 1 || c.get("whenUnsatisfiable") != "ScheduleAnyway" ||
			c.get("labelSelector", "matchLabels", "service") != component {
			t.Errorf("%s topologySpreadConstraints = %v", name, c)
		}
		container := object(pod["containers"].([]any)[0].(map[string]any))
		if container.get("resources", "requests", "cpu") == nil || container.get("resources", "requests", "memory") == nil {
			t.Errorf("%s requests no CPU and memory: %v", name, container.get("resources"))
		}
		if container.get("resources", "limits", "cpu") != nil {
			t.Errorf("%s has a CPU limit: %v", name, container.get("resources", "limits"))
		}
		pdb, ok := objects["PodDisruptionBudget/"+name]
		if !ok || pdb.get("spec", "minAvailable") != 1 || pdb.get("spec", "selector", "matchLabels", "service") != component {
			t.Errorf("%s PodDisruptionBudget = %v", name, pdb)
		}
		svc, ok := objects["Service/"+name+"-headless"]
		if !ok || svc.get("spec", "clusterIP") != "None" || svc.get("spec", "selector", "service") != component {
			t.Errorf("%s-headless = %v", name, svc)
		}
		if ports, _ := svc.get("spec", "ports").([]any); len(ports) != 1 || object(ports[0].(map[string]any)).get("port") != port {
			t.Errorf("%s-headless ports = %v", name, svc.get("spec", "ports"))
		}
		if _, ok := objects["HorizontalPodAutoscaler/"+name+"-hpa"]; ok {
			t.Errorf("%s has an autoscaler by default", name)
		}
	}

	t.Run("the defaults", func(t *testing.T) {
		objects := renderObjects(t, required)
		for component, port := range stateless {
			check(t, objects, component, port)
		}
		if _, ok := objects["Deployment/routr-routr-dispatcher"]; ok {
			t.Error("the Dispatcher runs by default")
		}
	})
	t.Run("the Dispatcher on", func(t *testing.T) {
		check(t, renderObjects(t, everythingOn), "dispatcher", 51901)
	})
	t.Run("one replica has no PodDisruptionBudget", func(t *testing.T) {
		objects := renderObjects(t, required+"connect:\n  replicas: 1\n")
		if _, ok := objects["PodDisruptionBudget/routr-routr-connect"]; ok {
			t.Error("a PodDisruptionBudget of minAvailable 1 on one replica blocks every drain")
		}
	})
	t.Run("the autoscaler owns the replicas", func(t *testing.T) {
		objects := renderObjects(t, required+"connect:\n  autoscaling:\n    enabled: true\n")
		if _, ok := objects["HorizontalPodAutoscaler/routr-routr-connect-hpa"]; !ok {
			t.Error("autoscaling.enabled renders no autoscaler")
		}
		if got := objects["Deployment/routr-routr-connect"].get("spec", "replicas"); got != nil {
			t.Errorf("the Deployment sets replicas %v under the autoscaler", got)
		}
		if _, ok := objects["PodDisruptionBudget/routr-routr-connect"]; !ok {
			t.Error("the autoscaled Deployment has no PodDisruptionBudget")
		}
	})
}

func TestChartPlacesOneEdgePortPerNode(t *testing.T) {
	sts := renderObjects(t, required)["StatefulSet/routr-routr-edgeport"]
	terms, _ := sts.get("spec", "template", "spec", "affinity", "podAntiAffinity", "requiredDuringSchedulingIgnoredDuringExecution").([]any)
	if len(terms) != 1 {
		t.Fatalf("the EdgePort has no required pod anti-affinity: %v", sts.get("spec", "template", "spec", "affinity"))
	}
	term := object(terms[0].(map[string]any))
	if term.get("topologyKey") != "kubernetes.io/hostname" || term.get("labelSelector", "matchLabels", "service") != "edgeport" {
		t.Errorf("anti-affinity term = %v", term)
	}
}

// probeHandlers are the ways a Kubernetes probe can check a container.
var probeHandlers = []string{"httpGet", "grpc", "tcpSocket", "exec"}

func TestChartProbesReadinessWithTheLivenessCheck(t *testing.T) {
	cases := map[string]string{
		"the defaults":             required,
		"everything on":            everythingOn,
		"the Data API without TLS": required + "apiserver:\n  tlsOn: false\n",
	}
	for name, values := range cases {
		t.Run(name, func(t *testing.T) {
			checked := 0
			for key, o := range renderObjects(t, values) {
				if kind := o.get("kind"); kind != "Deployment" && kind != "StatefulSet" {
					continue
				}
				// The Bitnami subcharts set their own probes
				if n, _ := o.get("metadata", "name").(string); !strings.HasPrefix(n, "routr-routr-") {
					continue
				}
				containers, _ := o.get("spec", "template", "spec", "containers").([]any)
				for _, c := range containers {
					container := object(c.(map[string]any))
					liveness, _ := container.get("livenessProbe").(map[string]any)
					readiness, ok := container.get("readinessProbe").(map[string]any)
					if !ok {
						t.Errorf("%s container %v has no readiness probe", key, container.get("name"))
						continue
					}
					for _, handler := range probeHandlers {
						if !reflect.DeepEqual(liveness[handler], readiness[handler]) {
							t.Errorf("%s container %v: readiness %s = %v, liveness %s = %v", key, container.get("name"), handler, readiness[handler], handler, liveness[handler])
						}
					}
					checked++
				}
			}
			if checked == 0 {
				t.Fatal("the chart renders no Routr container")
			}
		})
	}
}

func TestChartConfigsDialTheHeadlessServices(t *testing.T) {
	files := render(t, everythingOn)

	connect, err := config.LoadConnect(writeRendered(t, files, "connect.yaml"), resolve())
	if err != nil {
		t.Fatal(err)
	}
	if connect.Spec.LocationAddr != "routr-routr-location-headless.routr:51902" || connect.Spec.APIAddr != "routr-routr-apiserver-headless.routr:51907" {
		t.Errorf("connect.yaml dials %s and %s", connect.Spec.LocationAddr, connect.Spec.APIAddr)
	}
	// The certificate names the ClusterIP Service, not the headless one
	if tls := connect.Spec.APIAuth.TLS; tls == nil || tls.ServerName != "routr-routr-apiserver.routr" {
		t.Errorf("connect.yaml spec.apiAuth.tls = %+v", tls)
	}

	reg, err := registry.LoadFile(writeRendered(t, files, "registry.yaml"), resolve())
	if err != nil {
		t.Fatal(err)
	}
	if reg.Spec.APIAddr != "routr-routr-apiserver-headless.routr:51907" || reg.Spec.RequesterAddr != "routr-routr-requester-headless.routr:51909" {
		t.Errorf("registry.yaml dials %s and %s", reg.Spec.APIAddr, reg.Spec.RequesterAddr)
	}
	if tls := reg.Spec.APIAuth.TLS; tls == nil || tls.ServerName != "routr-routr-apiserver.routr" {
		t.Errorf("registry.yaml spec.apiAuth.tls = %+v", tls)
	}

	disp, err := config.LoadDispatcher(writeRendered(t, files, "dispatcher.yaml"), resolve())
	if err != nil {
		t.Fatal(err)
	}
	if got := disp.Spec.Processors[0].Addr; got != "routr-routr-connect-headless.routr:51904" {
		t.Errorf("dispatcher.yaml dials Connect at %s", got)
	}

	// Every name the configs dial is a Service the chart renders without a cluster IP
	objects := renderObjects(t, everythingOn)
	for _, name := range []string{"connect", "apiserver", "location", "dispatcher", "requester"} {
		if svc, ok := objects["Service/routr-routr-"+name+"-headless"]; !ok || svc.get("spec", "clusterIP") != "None" {
			t.Errorf("no headless Service routr-routr-%s-headless", name)
		}
	}
}

func TestChartRefusesSeveralLocationsOnTheMemoryCache(t *testing.T) {
	helm, err := exec.LookPath("helm")
	if err != nil {
		t.Skip("helm is not installed")
	}
	valuesFile := filepath.Join(t.TempDir(), "values.yaml")
	if err := os.WriteFile(valuesFile, []byte(required+"location:\n  cache: { provider: memory }\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	out, err := exec.CommandContext(context.Background(), helm, "template", "routr", chartPath, "--values", valuesFile).CombinedOutput()
	if err == nil || !strings.Contains(string(out), "location.cache.provider is memory") {
		t.Errorf("the install fails naming the value: %v: %s", err, out)
	}
}

// policed are the internal gRPC services the chart puts a NetworkPolicy on, by
// their service label, and the TCP port each admits. The Requester's names none:
// the EdgePort answers its REGISTERs on a free port, over UDP and TCP.
var policed = map[string]int{"location": 51902, "connect": 51904, "dispatcher": 51901, "rtprelay": 51903, "requester": 0}

// releasePods is what selects every pod of the release, and no other.
var releasePods = map[string]any{"app.kubernetes.io/name": "routr-connect", "app.kubernetes.io/instance": "routr"}

// networkPolicies are the NetworkPolicies among the objects, by the service
// label of the pods each selects.
func networkPolicies(t *testing.T, objects map[string]object) map[string]object {
	t.Helper()
	policies := map[string]object{}
	for key, o := range objects {
		if !strings.HasPrefix(key, "NetworkPolicy/") {
			continue
		}
		service, _ := o.get("spec", "podSelector", "matchLabels", "service").(string)
		if want := "NetworkPolicy/routr-routr-" + service; key != want {
			t.Errorf("%s selects the pods of %q: its name is not %s", key, service, want)
		}
		policies[service] = o
	}
	return policies
}

// dialed collects every host:port a rendered config dials: the values of its
// addr and *Addr keys, bindAddr aside.
func dialed(v any, into map[string]bool) {
	switch v := v.(type) {
	case map[string]any:
		for key, child := range v {
			if addr, ok := child.(string); ok && key != "bindAddr" && (key == "addr" || strings.HasSuffix(key, "Addr")) {
				into[addr] = true
				continue
			}
			dialed(child, into)
		}
	case []any:
		for _, child := range v {
			dialed(child, into)
		}
	}
}

// admitted checks every hop the rendered configs dial against the policies: one
// to a Service whose pods a policy selects has to land on a port that policy
// admits. It returns the policed services the configs reach.
func admitted(t *testing.T, values string, objects, policies map[string]object) map[string]bool {
	t.Helper()
	addrs := map[string]bool{}
	for file, content := range render(t, values) {
		var doc any
		if err := yaml.Unmarshal([]byte(content), &doc); err != nil {
			t.Fatalf("%s: %v", file, err)
		}
		dialed(doc, addrs)
	}
	reached := map[string]bool{}
	for addr := range addrs {
		host, portText, err := net.SplitHostPort(addr)
		if err != nil {
			t.Errorf("a config dials %q: %v", addr, err)
			continue
		}
		port, _ := strconv.Atoi(portText)
		svc, ok := objects["Service/"+strings.SplitN(host, ".", 2)[0]]
		if !ok {
			continue // not a Service of this chart
		}
		service, _ := svc.get("spec", "selector", "service").(string)
		policy, ok := policies[service]
		if !ok {
			continue // the Data API, which authenticates callers
		}
		reached[service] = true
		target := 0
		ports, _ := svc.get("spec", "ports").([]any)
		for _, p := range ports {
			if p := object(p.(map[string]any)); p.get("port") == port {
				target, _ = p.get("targetPort").(int)
			}
		}
		if target == 0 {
			t.Errorf("a config dials %s, a port its Service doesn't publish: %v", addr, ports)
			continue
		}
		rule := object(policy.get("spec", "ingress").([]any)[0].(map[string]any))
		open, _ := rule.get("ports").([]any)
		admits := len(open) == 0
		for _, p := range open {
			if p := object(p.(map[string]any)); p.get("port") == target && p.get("protocol") == "TCP" {
				admits = true
			}
		}
		if !admits {
			t.Errorf("a config dials %s, but the NetworkPolicy of %s admits only %v: the install would time out there", addr, service, open)
		}
	}
	return reached
}

func TestChartNetworkPolicy(t *testing.T) {
	const outside = "networkPolicy:\n  ingressFrom:\n    - namespaceSelector:\n        matchLabels: { kubernetes.io/metadata.name: sip-edge }\n"
	for name, tc := range map[string]struct {
		values string
		want   []string
		extra  []any
	}{
		// The Dispatcher is off by default (dispatcher.enabled), and has no pods to police
		"the defaults":      {required, []string{"location", "connect", "requester"}, nil},
		"the Dispatcher on": {required + "dispatcher:\n  enabled: true\n", []string{"location", "connect", "dispatcher", "requester"}, nil},
		"everything on":     {everythingOn, []string{"location", "connect", "dispatcher", "requester", "rtprelay"}, nil},
		"no Registry":       {noRegistry, []string{"location", "connect"}, nil},
		"turned off":        {required + "networkPolicy:\n  enabled: false\n", nil, nil},
		"an outside peer": {required + outside, []string{"location", "connect", "requester"}, []any{map[string]any{
			"namespaceSelector": map[string]any{"matchLabels": map[string]any{"kubernetes.io/metadata.name": "sip-edge"}},
		}}},
	} {
		t.Run(name, func(t *testing.T) {
			objects := renderObjects(t, tc.values)
			policies := networkPolicies(t, objects)
			if len(policies) != len(tc.want) {
				t.Errorf("%d NetworkPolicies, want %d (%v): %v", len(policies), len(tc.want), tc.want, policies)
			}
			for _, service := range tc.want {
				policy, ok := policies[service]
				if !ok {
					t.Errorf("no NetworkPolicy routr-routr-%s", service)
					continue
				}
				selector := map[string]any{"service": service}
				for k, v := range releasePods {
					selector[k] = v
				}
				if got := policy.get("spec", "podSelector", "matchLabels"); !reflect.DeepEqual(got, selector) {
					t.Errorf("%s podSelector = %v, want %v", service, got, selector)
				}
				// A selector that misses the pods would police nothing
				pods, _ := objects["Deployment/routr-routr-"+service].get("spec", "template", "metadata", "labels").(map[string]any)
				for k, v := range selector {
					if pods[k] != v {
						t.Errorf("the pods of %s carry no %s=%v: %v", service, k, v, pods)
					}
				}
				if got := policy.get("spec", "policyTypes"); !reflect.DeepEqual(got, []any{"Ingress"}) {
					t.Errorf("%s policyTypes = %v, want Ingress alone: egress is not restricted", service, got)
				}
				ingress, _ := policy.get("spec", "ingress").([]any)
				if len(ingress) != 1 {
					t.Fatalf("%s has %d ingress rules, want 1: %v", service, len(ingress), ingress)
				}
				rule := object(ingress[0].(map[string]any))
				from := append([]any{map[string]any{"podSelector": map[string]any{"matchLabels": releasePods}}}, tc.extra...)
				if got := rule.get("from"); !reflect.DeepEqual(got, from) {
					t.Errorf("%s from = %v, want %v", service, got, from)
				}
				var ports any
				if port := policed[service]; port != 0 {
					ports = []any{map[string]any{"protocol": "TCP", "port": port}}
				}
				if got := rule.get("ports"); !reflect.DeepEqual(got, ports) {
					t.Errorf("%s ports = %v, want %v", service, got, ports)
				}
			}

			// Every peer inside the release is one the rule admits
			for key, o := range objects {
				if !strings.HasPrefix(key, "Deployment/routr-routr-") && !strings.HasPrefix(key, "StatefulSet/routr-routr-") {
					continue
				}
				pods, _ := o.get("spec", "template", "metadata", "labels").(map[string]any)
				for k, v := range releasePods {
					if pods[k] != v {
						t.Errorf("the pods of %s carry no %s=%v: the policies would cut them off", key, k, v)
					}
				}
			}

			reached := admitted(t, tc.values, objects, policies)
			for _, service := range tc.want {
				if !reached[service] {
					t.Errorf("no rendered config dials %s: the hops are not being read", service)
				}
			}
		})
	}
}

func TestChartRendersTheMethodSettings(t *testing.T) {
	for name, tc := range map[string]struct {
		values, want string
	}{
		"the defaults": {required, "Discard"},
		"Respond":      {required + "  unknownMethodAction: Respond\n", "Respond"},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := config.LoadEdgePort(writeRendered(t, render(t, tc.values), "edgeport.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if cfg.Spec.UnknownMethodAction != tc.want || !slices.Contains(cfg.Spec.Methods, "OPTIONS") {
				t.Errorf("unknownMethodAction %q, methods %v", cfg.Spec.UnknownMethodAction, cfg.Spec.Methods)
			}
		})
	}
}
