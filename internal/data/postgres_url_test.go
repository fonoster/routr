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
	"strings"
	"testing"
)

func TestParsePostgresURL(t *testing.T) {
	const base = "postgresql://routr:s3cret@db:5432/routr"
	for name, tc := range map[string]struct {
		url        string
		searchPath string
	}{
		"Routr 2's URL":                  {base + "?schema=public", ""},
		"another schema":                 {base + "?schema=tenant_a", `"tenant_a"`},
		"a schema that needs quoting":    {base + "?schema=my-schema", `"my-schema"`},
		"no schema is public":            {base, ""},
		"an empty schema is public":      {base + "?schema=", ""},
		"the URL's own search_path":      {base + "?search_path=other", "other"},
		"schema wins over a search_path": {base + "?schema=tenant_a&search_path=other", `"tenant_a"`},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := parsePostgresURL(tc.url)
			if err != nil {
				t.Fatal(err)
			}
			params := cfg.ConnConfig.RuntimeParams
			if _, sent := params["schema"]; sent {
				t.Error("schema must not reach the server as a setting")
			}
			if params["search_path"] != tc.searchPath {
				t.Errorf("search_path = %q, want %q", params["search_path"], tc.searchPath)
			}
			if cfg.ConnConfig.User != "routr" || cfg.ConnConfig.Password != "s3cret" || cfg.ConnConfig.Database != "routr" {
				t.Errorf("the rest of the URL is kept: %+v", cfg.ConnConfig)
			}
		})
	}
}

func TestParsePostgresURLKeepsOtherParameters(t *testing.T) {
	cfg, err := parsePostgresURL("postgresql://routr:s3cret@db:5432/routr?schema=public&sslmode=disable&application_name=routr")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.RuntimeParams["application_name"] != "routr" {
		t.Errorf("params = %v", cfg.ConnConfig.RuntimeParams)
	}
	if cfg.ConnConfig.TLSConfig != nil {
		t.Error("sslmode=disable is still read")
	}
}

func TestParsePostgresURLTakesAKeywordString(t *testing.T) {
	cfg, err := parsePostgresURL("host=db user=routr dbname=routr")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "routr" || cfg.ConnConfig.RuntimeParams["search_path"] != "" {
		t.Errorf("config = %+v", cfg.ConnConfig)
	}
}

func TestParsePostgresURLFailureHidesThePassword(t *testing.T) {
	_, err := parsePostgresURL("postgresql://routr:s3cret@db:notaport/routr?schema=public")
	if err == nil {
		t.Fatal("a bad port is an error")
	}
	if strings.Contains(err.Error(), "s3cret") {
		t.Errorf("the error carries the password: %v", err)
	}
}
