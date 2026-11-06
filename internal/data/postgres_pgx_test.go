//go:build pgx

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
	"errors"
	"os"
	"testing"
	"time"
)

// TestPostgresAgainstADatabase runs every query shape against a real Routr
// 2 database (migrated with mods/pgdata's migrations on main), whatever it
// holds: it proves the column names, the parameter types and the cursor
// query, not the data. It needs TEST_DATABASE_URL and a build with -tags pgx.
func TestPostgresAgainstADatabase(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store, err := OpenPostgres(ctx, url, Identity{})
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	for _, kind := range Kinds {
		page, err := store.List(ctx, kind, Page{Size: 5})
		if err != nil {
			t.Fatalf("List(%s): %v", kind, err)
		}
		if len(page) > 0 {
			last := refOf(page[len(page)-1])
			if _, err := store.List(ctx, kind, Page{Size: 5, Token: last}); err != nil {
				t.Errorf("List(%s) after %s: %v", kind, last, err)
			}
			if _, err := store.Get(ctx, kind, refOf(page[0])); err != nil {
				t.Errorf("Get(%s, %s): %v", kind, refOf(page[0]), err)
			}
		}
		_, err = store.Get(ctx, kind, "no-such-ref")
		var notFound *NotFoundError
		if !errors.As(err, &notFound) {
			t.Errorf("Get(%s, no-such-ref) = %v, want NotFoundError", kind, err)
		}
		for field, col := range tables[kind].fields {
			value := "no-such-value"
			switch col.kind {
			case boolColumn:
				value = "false"
			case privacyColumn:
				value = "NONE"
			}
			if _, err := store.FindBy(ctx, kind, field, value); err != nil {
				t.Errorf("FindBy(%s, %s): %v", kind, field, err)
			}
		}
	}
}
