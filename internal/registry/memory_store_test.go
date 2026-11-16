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

package registry

import (
	"context"
	"testing"
	"time"
)

func entryAt(ref string, at time.Time, retention float64) Entry {
	return Entry{TrunkRef: ref, TimeOfEntry: at.UnixMilli(), RetentionTimeInSeconds: retention, Status: StatusRegistered}
}

func TestMemoryStorePutListGetCleanup(t *testing.T) {
	ctx := context.Background()
	store := newMemoryStore(defaultMaxPutsBeforeCleanup, fixedNow)
	fresh := entryAt("trunk-01", fixedNow(), 120)
	old := entryAt("tky767x2", fixedNow().Add(-time.Hour), 120)
	old.Status = StatusQuarantine
	if err := store.Put(ctx, fresh.TrunkRef, fresh); err != nil {
		t.Fatal(err)
	}
	if err := store.Put(ctx, old.TrunkRef, old); err != nil {
		t.Fatal(err)
	}

	listed, err := store.List(ctx)
	if err != nil || len(listed) != 1 || listed[0] != fresh {
		t.Errorf("List leaves out the expired entry: %v %v", listed, err)
	}
	if _, ok, _ := store.Get(ctx, old.TrunkRef); ok {
		t.Error("Get leaves out the expired entry")
	}

	store.cleanup()
	if len(store.entries) != 1 {
		t.Errorf("cleanup removes the expired entry: %v", store.entries)
	}
	if got, ok, err := store.Get(ctx, "trunk-01"); err != nil || !ok || got != fresh {
		t.Errorf("Get: %v %v %v", got, ok, err)
	}
	if _, ok, err := store.Get(ctx, "tk6t67r2"); ok || err != nil {
		t.Errorf("Get on a missing key: %v %v", ok, err)
	}
}

func TestMemoryStoreDelete(t *testing.T) {
	ctx := context.Background()
	store := newMemoryStore(defaultMaxPutsBeforeCleanup, fixedNow)
	if err := store.Put(ctx, "trunk-01", entryAt("trunk-01", fixedNow(), 120)); err != nil {
		t.Fatal(err)
	}
	if err := store.Delete(ctx, "trunk-01"); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := store.Get(ctx, "trunk-01"); ok {
		t.Error("the entry is gone")
	}
}

func TestMemoryStoreSweepsEveryNPuts(t *testing.T) {
	ctx := context.Background()
	store := newMemoryStore(2, fixedNow)
	if err := store.Put(ctx, "old", entryAt("old", fixedNow().Add(-time.Hour), 120)); err != nil {
		t.Fatal(err)
	}
	if len(store.entries) != 1 {
		t.Fatalf("no sweep yet: %v", store.entries)
	}
	if err := store.Put(ctx, "fresh", entryAt("fresh", fixedNow(), 120)); err != nil {
		t.Fatal(err)
	}
	if _, kept := store.entries["old"]; kept || len(store.entries) != 1 {
		t.Errorf("the second put sweeps: %v", store.entries)
	}
}

func TestEntryExpired(t *testing.T) {
	now := fixedNow()
	for name, tc := range map[string]struct {
		entry Entry
		want  bool
	}{
		"inside":             {entryAt("t", now.Add(-time.Minute), 120), false},
		"exactly at the end": {entryAt("t", now.Add(-2*time.Minute), 120), false},
		"past the end":       {entryAt("t", now.Add(-3*time.Minute), 120), true},
		"negative retention": {entryAt("t", now, -21), true},
	} {
		if got := tc.entry.expired(now); got != tc.want {
			t.Errorf("%s: %v", name, got)
		}
	}
}
