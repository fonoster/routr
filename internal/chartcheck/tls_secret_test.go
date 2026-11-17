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
	"reflect"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

func TestChartEdgePortTLSSecret(t *testing.T) {
	for name, tc := range map[string]struct {
		values     string
		cert, key  string
		wantVolume map[string]any
		wantMount  map[string]any
	}{
		"unset": {
			values: required,
			cert:   "/etc/routr/certs/server.crt",
			key:    "/etc/routr/certs/server.key",
		},
		"secretName set": {
			values: required + "  tls:\n    secretName: routr-edgeport-tls\n",
			cert:   "/etc/routr/tls/tls.crt",
			key:    "/etc/routr/tls/tls.key",
			// 0440, which YAML reads as an octal number
			wantVolume: map[string]any{"name": "tls", "secret": map[string]any{"secretName": "routr-edgeport-tls", "defaultMode": 0o440}},
			// No subPath, so a renewed Secret reaches the pod
			wantMount: map[string]any{"name": "tls", "mountPath": "/etc/routr/tls", "readOnly": true},
		},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := config.LoadEdgePort(writeRendered(t, render(t, tc.values), "edgeport.yaml"), resolve())
			if err != nil {
				t.Fatal(err)
			}
			if sc := cfg.Spec.SecurityContext; sc == nil || sc.CertFile != tc.cert || sc.KeyFile != tc.key {
				t.Errorf("securityContext = %+v, want certFile %s and keyFile %s", sc, tc.cert, tc.key)
			}

			pod := renderObjects(t, tc.values)["StatefulSet/routr-routr-edgeport"].get("spec", "template", "spec")
			var volume, mount map[string]any
			for _, v := range object(pod.(map[string]any)).get("volumes").([]any) {
				v := v.(map[string]any)
				if s, ok := v["secret"].(map[string]any); ok && s["secretName"] == "routr-edgeport-tls" {
					volume = v
				}
			}
			for _, c := range object(pod.(map[string]any)).get("containers").([]any) {
				mounts, _ := c.(map[string]any)["volumeMounts"].([]any)
				for _, m := range mounts {
					if m := m.(map[string]any); m["mountPath"] == "/etc/routr/tls" {
						mount = m
					}
				}
			}
			if !reflect.DeepEqual(volume, tc.wantVolume) {
				t.Errorf("TLS Secret volume = %v, want %v", volume, tc.wantVolume)
			}
			if !reflect.DeepEqual(mount, tc.wantMount) {
				t.Errorf("mount at /etc/routr/tls = %v, want %v", mount, tc.wantMount)
			}
		})
	}
}
