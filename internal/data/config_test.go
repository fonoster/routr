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
	"context"
	"strings"
	"testing"

	"github.com/fonoster/routr/internal/common/config"
)

func TestOpenStore(t *testing.T) {
	ctx := context.Background()
	store, err := OpenStore(ctx, config.DataSpec{Backend: BackendFiles, Path: "../../config/resources"})
	if err != nil {
		t.Fatalf("files: %v", err)
	}
	if _, ok := store.(*filesStore); !ok {
		t.Errorf("a files store: %T", store)
	}
	_ = store.Close()

	cases := map[string]struct {
		spec config.DataSpec
		want string
	}{
		"missing resources": {config.DataSpec{Backend: BackendFiles, Path: t.TempDir() + "/missing"}, "spec.data.path: "},
		"bad key":           {config.DataSpec{Backend: BackendPostgres, URL: "postgres://db/routr", EncryptionKey: "s3cr3t"}, "spec.data.encryptionKey: "},
		"bad url":           {config.DataSpec{Backend: BackendPostgres, URL: "postgres://[::1/routr"}, "spec.data.url: "},
		"unknown backend":   {config.DataSpec{Backend: "redis"}, `spec.data.backend: unknown backend "redis"`},
	}
	for name, c := range cases {
		_, err := OpenStore(ctx, c.spec)
		if err == nil || !strings.HasPrefix(err.Error(), c.want) {
			t.Errorf("%s: got %v, want prefix %q", name, err, c.want)
		}
		if strings.Contains(err.Error(), "s3cr3t") {
			t.Errorf("%s: the error carries a value: %v", name, err)
		}
	}
}
