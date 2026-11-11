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
package edgeport

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// redisDialogStoreForTest is a store on TEST_REDIS_URL; the tests that need
// Redis skip without it, as the Location's do.
func redisDialogStoreForTest(t *testing.T) *redisDialogStore {
	t.Helper()
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		t.Skip("TEST_REDIS_URL is not set")
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	s := &redisDialogStore{client: redis.NewClient(opts)}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

// testCallID is a Call-ID no other test or run uses.
func testCallID(t *testing.T, name string) string {
	return fmt.Sprintf("%s-%s-%d", t.Name(), name, time.Now().UnixNano())
}

func saveDialog(t *testing.T, s *redisDialogStore, callID string, rec DialogRecord, ttl time.Duration) {
	t.Helper()
	if err := s.Save(context.Background(), []SharedDialogSave{{CallID: callID, Record: rec, TTL: ttl}}); err != nil {
		t.Fatal(err)
	}
}

func loadDialog(t *testing.T, s *redisDialogStore, callID string) (DialogRecord, bool) {
	t.Helper()
	rec, found, err := s.Load(context.Background(), callID)
	if err != nil {
		t.Fatal(err)
	}
	return rec, found
}

func TestRedisDialogStoreKeepsARecordForItsTime(t *testing.T) {
	s := redisDialogStoreForTest(t)
	callID := testCallID(t, "a")
	if _, found := loadDialog(t, s, callID); found {
		t.Fatal("found a dialog no one saved")
	}
	want := DialogRecord{Targets: []string{"10.0.0.1:5060", "10.0.0.2:5061"}, CSeqOffset: 1}
	saveDialog(t, s, callID, want, time.Hour)
	got, found := loadDialog(t, s, callID)
	if !found || !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v, %v, want %+v", got, found, want)
	}
	left := s.client.PTTL(context.Background(), redisDialogKey(callID)).Val()
	if left <= 59*time.Minute || left > time.Hour {
		t.Fatalf("the record expires with the dialog: %v left", left)
	}

	gone := testCallID(t, "gone")
	saveDialog(t, s, gone, want, 0)
	if _, found := loadDialog(t, s, gone); found {
		t.Fatal("a record with no time left is not saved")
	}
}

func TestRedisDialogStoreMergesWhatEdgePortsSave(t *testing.T) {
	s := redisDialogStoreForTest(t)
	callID := testCallID(t, "m")
	saveDialog(t, s, callID, DialogRecord{Targets: []string{"10.0.0.1:5060", "10.0.0.2:5060"}, CSeqOffset: 2}, time.Hour)
	// Another EdgePort saw a target refresh, and knows no offset
	saveDialog(t, s, callID, DialogRecord{Targets: []string{"10.0.0.2:5060", "10.0.0.3:5060"}}, time.Hour)
	got, _ := loadDialog(t, s, callID)
	want := DialogRecord{Targets: []string{"10.0.0.1:5060", "10.0.0.2:5060", "10.0.0.3:5060"}, CSeqOffset: 2}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v, want %+v", got, want)
	}
}

func TestRedisDialogStoreKeepsAnEndedDialogEnded(t *testing.T) {
	s := redisDialogStoreForTest(t)
	callID := testCallID(t, "e")
	saveDialog(t, s, callID, DialogRecord{Targets: []string{"10.0.0.1:5060"}}, time.Hour)
	saveDialog(t, s, callID, DialogRecord{Targets: []string{"10.0.0.1:5060"}, Ended: true}, dialogLinger)
	// An EdgePort that didn't see the BYE saves the dialog again, for a day
	saveDialog(t, s, callID, DialogRecord{Targets: []string{"10.0.0.4:5060"}}, 24*time.Hour)
	got, found := loadDialog(t, s, callID)
	if !found || !got.Ended || len(got.Targets) != 2 {
		t.Fatalf("got %+v, %v", got, found)
	}
	if left := s.client.PTTL(context.Background(), redisDialogKey(callID)).Val(); left > dialogLinger {
		t.Fatalf("an ended dialog lingers no longer than dialogLinger: %v left", left)
	}
}

func TestRedisDialogStoreBoundsTheTargets(t *testing.T) {
	s := redisDialogStoreForTest(t)
	callID := testCallID(t, "b")
	var first, second []string
	for i := 0; i < maxDialogTargets; i++ {
		first = append(first, fmt.Sprintf("10.0.0.%d:5060", i))
		second = append(second, fmt.Sprintf("10.0.1.%d:5060", i))
	}
	saveDialog(t, s, callID, DialogRecord{Targets: first}, time.Hour)
	saveDialog(t, s, callID, DialogRecord{Targets: second[:3]}, time.Hour)
	got, _ := loadDialog(t, s, callID)
	want := append(append([]string(nil), first[3:]...), second[:3]...)
	if !reflect.DeepEqual(got.Targets, want) {
		t.Fatalf("the newest %d are kept: got %v", maxDialogTargets, got.Targets)
	}
}

func TestRedisDialogStoreTakesADialogWithNoTargets(t *testing.T) {
	s := redisDialogStoreForTest(t)
	callID := testCallID(t, "n")
	saveDialog(t, s, callID, DialogRecord{}, time.Hour)
	got, found := loadDialog(t, s, callID)
	if !found || len(got.Targets) != 0 || got.Ended {
		t.Fatalf("got %+v, %v", got, found)
	}
}

func TestRedisDialogStoreSavesAfterRedisLostItsScripts(t *testing.T) {
	s := redisDialogStoreForTest(t)
	callID := testCallID(t, "s")
	saveDialog(t, s, callID, DialogRecord{Targets: []string{"10.0.0.1:5060"}}, time.Hour)
	if err := s.client.ScriptFlush(context.Background()).Err(); err != nil {
		t.Fatal(err)
	}
	saveDialog(t, s, callID, DialogRecord{Targets: []string{"10.0.0.2:5060"}}, time.Hour)
	if got, _ := loadDialog(t, s, callID); len(got.Targets) != 2 {
		t.Fatalf("got %+v", got)
	}
}

func TestRedisDialogStoreSavesABatch(t *testing.T) {
	s := redisDialogStoreForTest(t)
	var batch []SharedDialogSave
	for i := 0; i < 50; i++ {
		batch = append(batch, SharedDialogSave{CallID: testCallID(t, fmt.Sprint(i)), Record: DialogRecord{Targets: []string{"10.0.0.1:5060"}}, TTL: time.Minute})
	}
	if err := s.Save(context.Background(), batch); err != nil {
		t.Fatal(err)
	}
	for _, d := range batch {
		if _, found := loadDialog(t, s, d.CallID); !found {
			t.Fatalf("%s was not saved", d.CallID)
		}
	}
}

func TestRedisDialogStoreTellsOfAnEndedDialog(t *testing.T) {
	s := redisDialogStoreForTest(t)
	other := redisDialogStoreForTest(t)
	ended := testCallID(t, "ended")
	up := testCallID(t, "up")
	ctx, cancel := context.WithCancel(context.Background())
	got := make(chan string, 16)
	done := make(chan error, 1)
	go func() { done <- other.Ended(ctx, func(callID string) { got <- callID }) }()
	// Published once the other store listens: retried until it is heard
	deadline := time.After(5 * time.Second)
	saveDialog(t, s, up, DialogRecord{Targets: []string{"10.0.0.1:5060"}}, time.Minute)
	for heard := false; !heard; {
		saveDialog(t, s, ended, DialogRecord{Targets: []string{"10.0.0.1:5060"}, Ended: true}, time.Minute)
		select {
		case callID := <-got:
			if callID == up {
				t.Fatal("a dialog that is up was told as ended")
			}
			heard = callID == ended
		case <-time.After(50 * time.Millisecond):
		case <-deadline:
			t.Fatal("the ended dialog was never told")
		}
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatalf("a listener that was stopped answers no error: %v", err)
	}
}

func TestRedisDialogStoreAnswersAnErrorWhenRedisIsDown(t *testing.T) {
	s, err := newRedisDialogStore("host=127.0.0.1,port=1")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, _, err := s.Load(ctx, "c1"); err == nil {
		t.Fatal("no error from a Redis that isn't there")
	}
	if err := s.Save(ctx, []SharedDialogSave{{CallID: "c1", TTL: time.Minute}}); err == nil {
		t.Fatal("no error from a Redis that isn't there")
	}
	if err := s.Ended(ctx, func(string) {}); err == nil {
		t.Fatal("no error from a Redis that isn't there")
	}
}

func TestNewRedisDialogStoreRefusesBadParameters(t *testing.T) {
	if _, err := newRedisDialogStore("port=6379"); err == nil {
		t.Fatal("parameters with no host were taken")
	}
}

func TestParseRedisDialogRecord(t *testing.T) {
	cases := []struct {
		text string
		want DialogRecord
		bad  bool
	}{
		{text: `{"t":["10.0.0.1:5060"],"o":1}`, want: DialogRecord{Targets: []string{"10.0.0.1:5060"}, CSeqOffset: 1}},
		// Lua's cjson writes an empty list as an object
		{text: `{"t":{},"o":0,"e":true}`, want: DialogRecord{Ended: true}},
		{text: `{"t":[1,2]}`, bad: true},
		{text: `not json`, bad: true},
	}
	for _, c := range cases {
		got, err := parseRedisDialogRecord(c.text)
		if c.bad {
			if err == nil {
				t.Errorf("%s: no error", c.text)
			}
			continue
		}
		if err != nil || !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: got %+v, %v, want %+v", c.text, got, err, c.want)
		}
	}
}
