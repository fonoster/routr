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
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"

	"github.com/fonoster/routr/internal/common/config"
)

// helmTemplate runs helm template under the release name; the output and
// whether it failed.
func helmTemplate(t *testing.T, release, values string) (string, error) {
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
	out, err := exec.CommandContext(context.Background(), helm, "template", release, chartPath, "--namespace", "routr", "--values", valuesFile).CombinedOutput()
	return string(out), err
}

// yaml11Scalar matches what YAML 1.1, the YAML the API server decodes, reads as
// a boolean, a null, a number or a date when it is written unquoted.
var yaml11Scalar = regexp.MustCompile(`^(?i:y|yes|n|no|true|false|on|off|null|~|[-+]?[0-9][0-9_]*(\.[0-9]*)?([eE][-+]?[0-9]+)?|0x[0-9a-f]+|0o[0-7]+|0b[01]+|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2})$`)

// unquotedNonStrings lists the label and annotation values of a document that
// YAML 1.1 would not read as strings.
func unquotedNonStrings(n *yaml.Node, path string, found *[]string) {
	switch n.Kind {
	case yaml.DocumentNode, yaml.SequenceNode:
		for _, c := range n.Content {
			unquotedNonStrings(c, path, found)
		}
	case yaml.MappingNode:
		for i := 0; i+1 < len(n.Content); i += 2 {
			key, value := n.Content[i], n.Content[i+1]
			if (key.Value == "labels" || key.Value == "annotations" || key.Value == "matchLabels") && value.Kind == yaml.MappingNode {
				for j := 0; j+1 < len(value.Content); j += 2 {
					v := value.Content[j+1]
					if v.Kind == yaml.ScalarNode && v.Style&(yaml.DoubleQuotedStyle|yaml.SingleQuotedStyle) == 0 && yaml11Scalar.MatchString(v.Value) {
						*found = append(*found, path+"."+key.Value+"."+value.Content[j].Value+"="+v.Value)
					}
				}
				continue
			}
			unquotedNonStrings(value, path+"."+key.Value, found)
		}
	}
}

// noSubcharts is the chart without the Bitnami subcharts, which write the
// release name unquoted.
const noSubcharts = `
postgresql: { enabled: false }
redis: { enabled: false }
location: { cache: { parameters: "host=redis,port=6379" } }
registry: { cache: { parameters: "host=redis,port=6379" } }
apiserver: { databaseUrl: "postgresql://routr:changeme@db:5432/routr" }
`

func TestChartQuotesTheReleaseName(t *testing.T) {
	for _, release := range []string{"n", "no", "on", "123"} {
		t.Run(release, func(t *testing.T) {
			out, err := helmTemplate(t, release, noSubcharts)
			if err != nil {
				t.Fatalf("helm template: %v: %s", err, out)
			}
			var found []string
			decoder := yaml.NewDecoder(strings.NewReader(out))
			for {
				var doc yaml.Node
				err := decoder.Decode(&doc)
				if errors.Is(err, io.EOF) {
					break
				}
				if err != nil {
					t.Fatalf("the chart renders invalid YAML: %v", err)
				}
				unquotedNonStrings(&doc, "", &found)
			}
			if len(found) > 0 {
				t.Errorf("label and annotation values YAML 1.1 reads as no string:\n%s", strings.Join(found, "\n"))
			}
			if !strings.Contains(out, "app.kubernetes.io/instance: \""+release+"\"") {
				t.Error("the instance label is not the quoted release name")
			}
		})
	}
	for _, release := range []string{"n", "0o17", "0b1"} {
		t.Run(release+" with the subcharts on", func(t *testing.T) {
			out, err := helmTemplate(t, release, "")
			if err == nil || !strings.Contains(out, `release name "`+release+`" reads as a boolean or a number in YAML`) {
				t.Errorf("the install fails naming the release name: %v: %s", err, out)
			}
		})
	}
	t.Run("an ordinary name keeps its selectors", func(t *testing.T) {
		sts := renderObjects(t, "")["StatefulSet/routr-routr-edgeport"]
		want := map[string]any{"app.kubernetes.io/name": "routr-connect", "app.kubernetes.io/instance": "routr", "service": "edgeport"}
		if got := sts.get("spec", "selector", "matchLabels"); !reflect.DeepEqual(got, want) {
			t.Errorf("selector = %v, want %v", got, want)
		}
	})
}

func TestChartRequesterAutoscalingIsOptIn(t *testing.T) {
	const hpa, deployment = "HorizontalPodAutoscaler/routr-routr-requester-hpa", "Deployment/routr-routr-requester"
	t.Run("the defaults", func(t *testing.T) {
		objects := renderObjects(t, "")
		if _, ok := objects[hpa]; ok {
			t.Error("the Requester has an autoscaler by default")
		}
		if got := objects[deployment].get("spec", "replicas"); got != 1 {
			t.Errorf("replicas = %v, want 1", got)
		}
	})
	t.Run("autoscaling on", func(t *testing.T) {
		objects := renderObjects(t, "requester:\n  autoscaling:\n    enabled: true\n")
		a, ok := objects[hpa]
		if !ok || a.get("spec", "minReplicas") != 1 || a.get("spec", "maxReplicas") != 10 {
			t.Errorf("autoscaler = %v", a)
		}
		if got := objects[deployment].get("spec", "replicas"); got != nil {
			t.Errorf("the Deployment sets replicas %v under the autoscaler", got)
		}
	})
	t.Run("no Registry", func(t *testing.T) {
		objects := renderObjects(t, "registry:\n  enabled: false\nrequester:\n  autoscaling:\n    enabled: true\n")
		if _, ok := objects[hpa]; ok {
			t.Error("an autoscaler without a Requester")
		}
		if _, ok := objects[deployment]; ok {
			t.Error("a Requester without the Registry")
		}
	})
}

func TestChartRTPRelayAutoscalingIsOptIn(t *testing.T) {
	const hpa, deployment = "HorizontalPodAutoscaler/routr-routr-rtprelay-hpa", "Deployment/routr-routr-rtprelay"
	t.Run("the defaults", func(t *testing.T) {
		objects := renderObjects(t, "rtprelay:\n  enabled: true\n  rtpeHost: rtpengine\n")
		if _, ok := objects[hpa]; ok {
			t.Error("the RTPRelay has an autoscaler by default")
		}
		if got := objects[deployment].get("spec", "replicas"); got != 1 {
			t.Errorf("replicas = %v, want 1", got)
		}
	})
	t.Run("autoscaling on", func(t *testing.T) {
		objects := renderObjects(t, "rtprelay:\n  enabled: true\n  rtpeHost: rtpengine\n  autoscaling:\n    enabled: true\n")
		a, ok := objects[hpa]
		if !ok || a.get("spec", "minReplicas") != 1 || a.get("spec", "maxReplicas") != 10 {
			t.Errorf("autoscaler = %v", a)
		}
		if got := objects[deployment].get("spec", "replicas"); got != nil {
			t.Errorf("the Deployment sets replicas %v under the autoscaler", got)
		}
	})
	t.Run("no RTPRelay", func(t *testing.T) {
		objects := renderObjects(t, "rtprelay:\n  enabled: false\n  autoscaling:\n    enabled: true\n")
		if _, ok := objects[hpa]; ok {
			t.Error("an autoscaler without an RTPRelay")
		}
		if _, ok := objects[deployment]; ok {
			t.Error("an RTPRelay Deployment while rtprelay.enabled is false")
		}
	})
}

// TestChartDefaultsTrustTheReleaseEdgePorts checks what a call that crosses two
// EdgePorts needs from the chart with no value set: trust in the release's own
// EdgePorts, by the name of their headless Service, and nothing wider.
func TestChartDefaultsTrustTheReleaseEdgePorts(t *testing.T) {
	files := render(t, "")
	path := writeRendered(t, files, "connect.yaml")
	cfg, err := config.LoadConnect(path, resolve())
	if err != nil {
		t.Fatal(err)
	}
	if got := cfg.Spec.TrustedEdgePortAddresses; !reflect.DeepEqual(got, []string{"routr-routr-edgeport-headless.routr"}) {
		t.Errorf("trustedEdgePortAddresses = %v, want the EdgePort headless Service", got)
	}
	if err := loadConnect(t, path); err != nil {
		t.Errorf("Connect refuses the default trust: %v", err)
	}
	svc := renderObjects(t, "")["Service/routr-routr-edgeport-headless"]
	if svc.get("spec", "clusterIP") != "None" || svc.get("spec", "selector", "service") != "edgeport" {
		t.Errorf("the trusted name is not the EdgePorts' headless Service: %v", svc)
	}
}

// noRedis is a release with the chart's Redis off and nothing else of it used.
const noRedis = "redis:\n  enabled: false\nlocation:\n  replicas: 1\n  cache:\n    provider: memory\nregistry:\n  cache:\n    provider: memory\n"

// TestChartEdgePortDialogTable checks where the chart has the EdgePorts keep
// their dialogs (#578): the release's Redis unless told otherwise, so a rolling
// update doesn't cut the calls in progress off from their BYE.
func TestChartEdgePortDialogTable(t *testing.T) {
	for name, tc := range map[string]struct {
		values string
		want   config.Cache
	}{
		"the chart's Redis by default":       {"", config.Cache{Provider: "redis", Parameters: "host=routr-redis-master.routr,port=6379"}},
		"another Redis":                      {"edgeport:\n  cache:\n    parameters: host=redis.example,port=6380\n", config.Cache{Provider: "redis", Parameters: "host=redis.example,port=6380"}},
		"another Redis with the chart's off": {noRedis + "edgeport:\n  cache:\n    parameters: host=redis.example,port=6380\n", config.Cache{Provider: "redis", Parameters: "host=redis.example,port=6380"}},
		"memory":                             {"edgeport:\n  cache:\n    provider: memory\n", config.Cache{Provider: "memory"}},
		// A values file from before the key existed still installs
		"no Redis: memory": {noRedis, config.Cache{Provider: "memory"}},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := config.LoadEdgePort(writeRendered(t, render(t, tc.values), "edgeport.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if cfg.Spec.Cache != tc.want {
				t.Errorf("cache = %+v, want %+v", cfg.Spec.Cache, tc.want)
			}
		})
	}
	t.Run("redis asked for with none to use", func(t *testing.T) {
		out, err := helmTemplate(t, "routr", noRedis+"edgeport:\n  cache:\n    provider: redis\n")
		if err == nil || !strings.Contains(out, "edgeport.cache.parameters is required when edgeport.cache.provider is redis and redis.enabled is false") {
			t.Errorf("the install fails naming the value: %v: %s", err, out)
		}
	})
}

// migrationsImages are the images of the migrations hook and of the Data API's
// wait for them.
func migrationsImages(objects map[string]object) []string {
	var images []string
	pod := objects["Pod/routr-routr-apiserver-migrations"]
	for _, key := range []string{"initContainers", "containers"} {
		list, _ := pod.get("spec", key).([]any)
		for _, c := range list {
			images = append(images, object(c.(map[string]any)).get("image").(string))
		}
	}
	return images
}

func TestChartMigrationsFollowAppVersion(t *testing.T) {
	chart, err := os.ReadFile(filepath.Join(chartPath, "Chart.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	var meta struct {
		AppVersion string `yaml:"appVersion"`
	}
	if err := yaml.Unmarshal(chart, &meta); err != nil || meta.AppVersion == "" {
		t.Fatalf("Chart.yaml appVersion: %v", err)
	}
	for name, tc := range map[string]struct {
		values string
		want   string
	}{
		"the defaults":  {"", "fonoster/routr-pgdata-migrations:" + meta.AppVersion},
		"a tag you set": {"apiserver:\n  migrations:\n    image:\n      tag: \"2.32.3\"\n", "fonoster/routr-pgdata-migrations:2.32.3"},
	} {
		t.Run(name, func(t *testing.T) {
			images := migrationsImages(renderObjects(t, tc.values))
			if len(images) != 2 {
				t.Fatalf("the hook runs %v, want the wait and the migrations", images)
			}
			for _, image := range images {
				if image != tc.want {
					t.Errorf("image = %s, want %s", image, tc.want)
				}
			}
		})
	}
}

// TestChartPodCIDR checks that the chart adds a localnet only when podCIDR is
// set. Off, the EdgePort reads its interfaces (a /32 on Calico), so a phone
// outside the cluster at a private address such as 192.168.1.10 is not local
// and gets externalAddrs in its Record-Route: see
// TestRecordRouteForAPhoneOutsideTheCluster in internal/connect.
func TestChartPodCIDR(t *testing.T) {
	for name, tc := range map[string]struct {
		values string
		want   []string
	}{
		"off by default":      {"edgeport:\n  externalAddrs: [203.0.113.10]\n", nil},
		"the pod network":     {"edgeport:\n  podCIDR: 192.168.0.0/16\n", []string{"10.244.1.12/16"}},
		"a wider pod network": {"edgeport:\n  podCIDR: 10.0.0.0/14\n", []string{"10.244.1.12/14"}},
		"localnets win":       {"edgeport:\n  podCIDR: 10.0.0.0/14\n  localnets: [\"${POD_IP}/8\", 192.168.1.10/24]\n", []string{"10.244.1.12/8", "192.168.1.10/24"}},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := config.LoadEdgePort(writeRendered(t, render(t, tc.values), "edgeport.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if got := cfg.Spec.Localnets; !reflect.DeepEqual(got, tc.want) {
				t.Errorf("localnets = %v, want %v", got, tc.want)
			}
		})
	}
	t.Run("not a CIDR", func(t *testing.T) {
		out, err := helmTemplate(t, "routr", "edgeport:\n  podCIDR: bogus\n")
		if err == nil || !strings.Contains(out, `edgeport.podCIDR must be an IPv4 CIDR like 10.244.0.0/16, not "bogus"`) {
			t.Errorf("the install fails naming the value: %v: %s", err, out)
		}
	})
}
