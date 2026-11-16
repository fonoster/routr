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
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

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

func TestRefuseCloakedPasswords(t *testing.T) {
	ctx := context.Background()
	open := func(db *fakeDB) (*postgresStore, *bytes.Buffer) {
		var logged bytes.Buffer
		s, err := NewPostgres(db, PostgresOptions{Logger: slog.New(slog.NewTextHandler(&logged, nil))})
		if err != nil {
			t.Fatal(err)
		}
		return s.(*postgresStore), &logged
	}

	// A cloaked password: refused, naming the key and no value
	s, logged := open(&fakeDB{rows: map[string][][]any{"credentials": {{1}}}})
	err := s.refuseCloakedPasswords(ctx)
	if err == nil || !strings.Contains(err.Error(), "spec.data.encryptionKey") {
		t.Errorf("a cloaked password = %v", err)
	}
	if logged.Len() != 0 {
		t.Errorf("a refusal logged %q", logged.String())
	}

	// None: a warning about the plain text
	db := &fakeDB{}
	s, logged = open(db)
	if err := s.refuseCloakedPasswords(ctx); err != nil {
		t.Errorf("no cloaked password = %v", err)
	}
	if got := logged.String(); !strings.Contains(got, "level=WARN") || !strings.Contains(got, "plain text") {
		t.Errorf("log = %q", got)
	}
	if len(db.queries) != 1 || db.queries[0].sql != `SELECT 1 FROM "credentials" WHERE password LIKE 'v1.aesgcm256.%' LIMIT 1` {
		t.Errorf("queries = %v", db.queries)
	}

	// A database not migrated yet has no passwords
	s, logged = open(&fakeDB{fail: &pgconn.PgError{Code: "42P01"}})
	if err := s.refuseCloakedPasswords(ctx); err != nil {
		t.Errorf("no table = %v", err)
	}
	if !strings.Contains(logged.String(), "plain text") {
		t.Errorf("log = %q", logged.String())
	}

	// A check that did not run does not pass
	s, _ = open(&fakeDB{fail: errors.New("connection reset")})
	if err := s.refuseCloakedPasswords(ctx); err == nil || !strings.Contains(err.Error(), "spec.data.url") {
		t.Errorf("a failed check = %v", err)
	}
}
