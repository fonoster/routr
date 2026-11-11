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
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emiago/sipgo/sip"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fonoster/routr/internal/common/config"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
)

// memoryDialogStore is a dialogStore two EdgePorts of a test share. It merges
// as the Redis script does.
type memoryDialogStore struct {
	mu      sync.Mutex
	records map[string]DialogRecord
	saves   int
	loads   int
	// failing makes every call fail, as a Redis that is down does
	failing bool
	closed  bool
	// listeners are told the dialogs saved as ended, as Redis subscribers are
	listeners map[int]func(string)
	nextID    int
}

func newMemoryDialogStore() *memoryDialogStore {
	return &memoryDialogStore{records: map[string]DialogRecord{}}
}

func (s *memoryDialogStore) Save(_ context.Context, dialogs []SharedDialogSave) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failing {
		return errors.New("store down")
	}
	for _, d := range dialogs {
		s.saves++
		old := s.records[d.CallID]
		merged := DialogRecord{Ended: old.Ended || d.Record.Ended, CSeqOffset: max(old.CSeqOffset, d.Record.CSeqOffset)}
		entry := &dialogTargets{targets: append([]string(nil), old.Targets...)}
		for _, target := range d.Record.Targets {
			entry.add(target)
		}
		merged.Targets = entry.targets
		s.records[d.CallID] = merged
		if d.Record.Ended {
			for _, each := range s.listeners {
				go each(d.CallID)
			}
		}
	}
	return nil
}

func (s *memoryDialogStore) Ended(ctx context.Context, each func(string)) error {
	s.mu.Lock()
	if s.failing {
		s.mu.Unlock()
		return errors.New("store down")
	}
	if s.listeners == nil {
		s.listeners = map[int]func(string){}
	}
	id := s.nextID
	s.nextID++
	s.listeners[id] = each
	s.mu.Unlock()
	<-ctx.Done()
	s.mu.Lock()
	delete(s.listeners, id)
	s.mu.Unlock()
	return nil
}

func (s *memoryDialogStore) listening() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.listeners)
}

func (s *memoryDialogStore) Load(_ context.Context, callID string) (DialogRecord, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.loads++
	if s.failing {
		return DialogRecord{}, false, errors.New("store down")
	}
	rec, ok := s.records[callID]
	return rec, ok, nil
}

func (s *memoryDialogStore) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	return nil
}

func (s *memoryDialogStore) record(callID string) (DialogRecord, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.records[callID]
	return rec, ok
}

func (s *memoryDialogStore) counts() (saves, loads int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.saves, s.loads
}

func (s *memoryDialogStore) fail(failing bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failing = failing
}

func quietLog() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// eventually waits for what another goroutine does.
func eventually(t *testing.T, what string, ok func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !ok() {
		if time.Now().After(deadline) {
			t.Fatalf("never happened: %s", what)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func uri(host string, port int) sip.Uri {
	return sip.Uri{Scheme: "sip", Host: host, Port: port}
}

func TestOnlyEstablishedDialogsAreShared(t *testing.T) {
	m := NewTransactionManager()
	var changed []string
	m.onShare = func(callID string) { changed = append(changed, callID) }

	m.RecordDialogTargets("failed", true, uri("10.0.0.1", 5060))
	m.RemoveDialog("failed")
	m.RecordAuthenticated("register")
	if len(changed) != 0 {
		t.Fatalf("an INVITE no one answered and an authenticated REGISTER are not shared: %v", changed)
	}
	if _, _, ok := m.SharedDialog("failed"); ok {
		t.Fatal("a dialog that was never established has no record")
	}

	m.RecordDialogTargets("up", true, uri("10.0.0.1", 5060))
	m.RecordAuthenticated("up")
	if len(changed) != 0 {
		t.Fatalf("nothing is shared before the 2xx: %v", changed)
	}
	m.RecordDialog("up")
	if len(changed) == 0 || changed[0] != "up" {
		t.Fatalf("the 2xx shares the dialog: %v", changed)
	}
	rec, ttl, ok := m.SharedDialog("up")
	if !ok || rec.Ended || rec.CSeqOffset != 1 || len(rec.Targets) != 1 || rec.Targets[0] != "10.0.0.1:5060" {
		t.Fatalf("record = %+v, %v", rec, ok)
	}
	if ttl <= 23*time.Hour || ttl > DefaultDialogIdle {
		t.Fatalf("an established dialog has its idle time left: %v", ttl)
	}

	changed = nil
	m.RecordDialogTargets("up", false, uri("10.0.0.1", 5060))
	if len(changed) != 0 {
		t.Fatalf("a target it already has changes nothing: %v", changed)
	}
	m.RecordDialogTargets("up", false, uri("10.0.0.2", 5060))
	if len(changed) != 1 {
		t.Fatalf("a target refresh is shared: %v", changed)
	}

	changed = nil
	m.RemoveDialog("up")
	if len(changed) != 1 {
		t.Fatalf("the end of the dialog is shared: %v", changed)
	}
	rec, ttl, ok = m.SharedDialog("up")
	if !ok || !rec.Ended || len(rec.Targets) != 2 || ttl > dialogLinger || ttl < dialogLinger-time.Minute {
		t.Fatalf("an ended dialog lingers with its targets: %+v, %v, %v", rec, ttl, ok)
	}
}

func TestRestoreDialog(t *testing.T) {
	t.Run("an established dialog is one again", func(t *testing.T) {
		m := NewTransactionManager()
		if !m.RestoreDialog("c1", DialogRecord{Targets: []string{"10.0.0.1:5060", "10.0.0.2:5080"}, CSeqOffset: 2}) {
			t.Fatal("not restored")
		}
		if !m.HasDialog("c1") || m.CSeqOffset("c1") != 2 {
			t.Fatalf("dialog %v, offset %d", m.HasDialog("c1"), m.CSeqOffset("c1"))
		}
		if known, target := m.IsDialogTarget("c1", uri("10.0.0.2", 5080)); !known || !target {
			t.Fatal("its targets are the record's")
		}
		if _, target := m.IsDialogTarget("c1", uri("10.0.0.9", 5060)); target {
			t.Fatal("and nothing else")
		}
	})
	t.Run("an ended dialog lingers, and can start nothing", func(t *testing.T) {
		m := NewTransactionManager()
		now := time.Now()
		m.now = func() time.Time { return now }
		m.RestoreDialog("c2", DialogRecord{Targets: []string{"10.0.0.1:5060"}, Ended: true, CSeqOffset: 1})
		if m.HasDialog("c2") {
			t.Fatal("an ended dialog is no dialog")
		}
		if _, target := m.IsDialogTarget("c2", uri("10.0.0.1", 5060)); !target {
			t.Fatal("what follows its end still passes")
		}
		now = now.Add(dialogLinger + time.Second)
		if known, _ := m.IsDialogTarget("c2", uri("10.0.0.1", 5060)); known {
			t.Fatal("it is gone after dialogLinger")
		}
	})
	t.Run("a dialog that ended here stays ended", func(t *testing.T) {
		m := NewTransactionManager()
		m.RecordDialogTargets("c3", true, uri("10.0.0.1", 5060))
		m.RecordDialog("c3")
		m.RemoveDialog("c3")
		m.RestoreDialog("c3", DialogRecord{Targets: []string{"10.0.0.3:5060"}})
		if m.HasDialog("c3") {
			t.Fatal("a record written before the BYE brought the dialog back")
		}
	})
	t.Run("a dialog that ended elsewhere ends here", func(t *testing.T) {
		m := NewTransactionManager()
		m.RecordDialogTargets("c4", true, uri("10.0.0.1", 5060))
		m.RecordDialog("c4")
		m.RestoreDialog("c4", DialogRecord{Targets: []string{"10.0.0.1:5060"}, Ended: true})
		if m.HasDialog("c4") {
			t.Fatal("still a dialog")
		}
	})
	t.Run("a dialog here gains the record's targets", func(t *testing.T) {
		m := NewTransactionManager()
		m.RecordDialogTargets("c5", true, uri("10.0.0.1", 5060))
		m.RecordDialog("c5")
		m.RestoreDialog("c5", DialogRecord{Targets: []string{"10.0.0.7:5060"}})
		for _, host := range []string{"10.0.0.1", "10.0.0.7"} {
			if _, target := m.IsDialogTarget("c5", uri(host, 5060)); !target {
				t.Fatalf("%s is a target", host)
			}
		}
	})
	t.Run("a full table refuses it", func(t *testing.T) {
		m := NewBoundedTransactionManager(1, 0)
		m.RecordDialogTargets("held", true, uri("10.0.0.1", 5060))
		m.RecordDialog("held")
		if m.RestoreDialog("c6", DialogRecord{Targets: []string{"10.0.0.1:5060"}}) {
			t.Fatal("restored past maxDialogs")
		}
		if known, _ := m.IsDialogTarget("c6", uri("10.0.0.1", 5060)); known {
			t.Fatal("it left an entry")
		}
	})
}

func TestEndSharedDialog(t *testing.T) {
	m := NewTransactionManager()
	var changed []string
	m.onShare = func(callID string) { changed = append(changed, callID) }
	m.RecordDialogTargets("up", true, uri("10.0.0.1", 5060))
	m.RecordAuthenticated("up")
	m.RecordDialog("up")
	m.RecordDialogTargets("early", true, uri("10.0.0.1", 5060))
	changed = nil

	m.EndSharedDialog("unknown")
	m.EndSharedDialog("early")
	if known, _ := m.IsDialogTarget("unknown", uri("10.0.0.1", 5060)); known {
		t.Fatal("a dialog this EdgePort doesn't hold got an entry")
	}
	m.EndSharedDialog("up")
	if m.HasDialog("up") || m.CSeqOffset("up") != 0 {
		t.Fatal("the dialog another EdgePort ended is still one here")
	}
	if _, target := m.IsDialogTarget("up", uri("10.0.0.1", 5060)); !target {
		t.Fatal("what follows its end still passes, for dialogLinger")
	}
	if rec, ttl, ok := m.SharedDialog("up"); !ok || !rec.Ended || ttl > dialogLinger {
		t.Fatalf("it lingers as ended: %+v, %v, %v", rec, ttl, ok)
	}
	if len(changed) != 0 {
		t.Fatalf("an end learned from the store is not saved back: %v", changed)
	}
	// An ended dialog is what a full table gives up first
	bounded := NewBoundedTransactionManager(1, 0)
	bounded.RecordDialogTargets("held", true, uri("10.0.0.1", 5060))
	bounded.RecordDialog("held")
	if bounded.CanCreateDialog("new") {
		t.Fatal("an established dialog gave its entry up")
	}
	bounded.EndSharedDialog("held")
	if !bounded.CanCreateDialog("new") {
		t.Fatal("the dialog that ended elsewhere still holds its entry")
	}
}

func TestDialogSharerEndsWhatEndedElsewhere(t *testing.T) {
	store := newMemoryDialogStore()
	first, second := NewTransactionManager(), NewTransactionManager()
	a := newDialogSharer(noCloseStore{store}, first, quietLog(), func() {})
	b := newDialogSharer(noCloseStore{store}, second, quietLog(), func() {})
	a.start()
	b.start()
	defer a.close()
	defer b.close()
	eventually(t, "both listen", func() bool { return store.listening() == 2 })

	first.RecordDialogTargets("x1", true, uri("10.0.0.1", 5060))
	first.RecordDialog("x1")
	eventually(t, "the dialog is saved", func() bool { _, ok := store.record("x1"); return ok })
	if !b.restore("x1") || !second.HasDialog("x1") {
		t.Fatal("the other EdgePort takes the dialog")
	}
	second.RemoveDialog("x1")
	eventually(t, "the EdgePort that set it up learns of its end", func() bool { return !first.HasDialog("x1") })
}

func TestDialogSharerListensAgainAfterAStoreFailure(t *testing.T) {
	store := newMemoryDialogStore()
	store.fail(true)
	m := NewTransactionManager()
	s := newDialogSharer(store, m, quietLog(), func() {})
	s.start()
	defer s.close()
	eventually(t, "the store is seen down", func() bool { return s.down.Load() })
	store.fail(false)
	eventually(t, "it listens once the store is back", func() bool { return store.listening() == 1 })
}

func TestDialogSharerSavesWhatChanges(t *testing.T) {
	store := newMemoryDialogStore()
	m := NewTransactionManager()
	s := newDialogSharer(store, m, quietLog(), func() {})
	s.start()

	m.RecordDialogTargets("s1", true, uri("10.0.0.1", 5060))
	m.RecordDialog("s1")
	eventually(t, "the dialog is saved", func() bool { _, ok := store.record("s1"); return ok })

	m.RemoveDialog("s1")
	eventually(t, "its end is saved", func() bool { rec, _ := store.record("s1"); return rec.Ended })

	s.close()
	if !store.closed {
		t.Fatal("close closes the store")
	}
	s.close() // a second close does nothing
}

func TestDialogSharerCloseSavesWhatIsPending(t *testing.T) {
	store := newMemoryDialogStore()
	m := NewTransactionManager()
	s := newDialogSharer(store, m, quietLog(), func() {})
	// Never started: nothing saves until close
	m.RecordDialogTargets("p1", true, uri("10.0.0.1", 5060))
	m.RecordDialog("p1")
	s.close()
	if _, ok := store.record("p1"); ok {
		t.Fatal("a sharer that never started has no goroutine to save with")
	}

	store = newMemoryDialogStore()
	m = NewTransactionManager()
	s = newDialogSharer(store, m, quietLog(), func() {})
	store.fail(true)
	s.start()
	m.RecordDialogTargets("p2", true, uri("10.0.0.1", 5060))
	m.RecordDialog("p2")
	eventually(t, "the failed save backs off", func() bool { return s.down.Load() })
	store.fail(false)
	s.close()
	if _, ok := store.record("p2"); !ok {
		t.Fatal("close saves what the store had not taken")
	}
}

func TestDialogSharerRetriesAStoreThatFailed(t *testing.T) {
	store := newMemoryDialogStore()
	store.fail(true)
	m := NewTransactionManager()
	s := newDialogSharer(store, m, quietLog(), func() {})
	s.start()
	defer s.close()
	m.RecordDialogTargets("r1", true, uri("10.0.0.1", 5060))
	m.RecordDialog("r1")
	eventually(t, "the store is seen down", func() bool { return s.down.Load() })
	store.fail(false)
	eventually(t, "the dialog is saved once the store is back", func() bool { _, ok := store.record("r1"); return ok })
}

func TestDialogSharerLeavesAFailingStoreAlone(t *testing.T) {
	store := newMemoryDialogStore()
	m := NewTransactionManager()
	s := newDialogSharer(store, m, quietLog(), func() {})
	now := time.Now()
	s.now = func() time.Time { return now }

	store.fail(true)
	for i := 0; i < 100; i++ {
		if s.restore(fmt.Sprintf("flood-%d", i)) {
			t.Fatal("restored from a store that is down")
		}
	}
	if _, loads := store.counts(); loads != 1 {
		t.Fatalf("a store that failed was asked %d times within its backoff, want 1", loads)
	}

	store.fail(false)
	store.records["back"] = DialogRecord{Targets: []string{"10.0.0.1:5060"}}
	now = now.Add(dialogStoreBackoff + time.Millisecond)
	if !s.restore("back") || !m.HasDialog("back") {
		t.Fatal("after the backoff the store is asked again")
	}
	if s.restore("unknown") {
		t.Fatal("a call the store doesn't have is no dialog")
	}
}

func TestDialogSharerBoundsWhatWaits(t *testing.T) {
	store := newMemoryDialogStore()
	m := NewTransactionManager()
	dropped := 0
	s := newDialogSharer(store, m, quietLog(), func() { dropped++ })
	for i := 0; i < maxPendingDialogSaves; i++ {
		s.changed(fmt.Sprintf("c%d", i))
	}
	s.changed("c0") // already waiting: no room needed
	if dropped != 0 {
		t.Fatalf("dropped %d below the bound", dropped)
	}
	s.changed("one-more")
	if dropped != 1 || len(s.pending) != maxPendingDialogSaves {
		t.Fatalf("dropped %d, pending %d", dropped, len(s.pending))
	}
}

func TestDialogSharerBoundsItsLookups(t *testing.T) {
	store := newMemoryDialogStore()
	store.records["held"] = DialogRecord{Targets: []string{"10.0.0.1:5060"}}
	m := NewTransactionManager()
	refused := 0
	s := newDialogSharer(store, m, quietLog(), func() { refused++ })
	for i := 0; i < maxDialogLoads; i++ {
		s.loads <- struct{}{}
	}
	if s.restore("held") || refused != 1 {
		t.Fatalf("a lookup past the bound was made (refused %d)", refused)
	}
	if _, loads := store.counts(); loads != 0 {
		t.Fatalf("the store was asked %d times", loads)
	}
	<-s.loads
	if !s.restore("held") {
		t.Fatal("with a slot free the lookup is made")
	}
}

// startSharedEdgePort starts an EdgePort on the UDP port given, its dialogs in
// store, and returns it with what stops it: the restart of the tests.
func startSharedEdgePort(t *testing.T, proc *fakeProcessor, store dialogStore, port int, specLines ...string) (*EdgePort, func()) {
	t.Helper()
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := grpc.NewServer()
	ppb.RegisterProcessorServer(srv, proc)
	go func() { _ = srv.Serve(l) }()
	t.Cleanup(srv.Stop)

	proc.edgePort = port
	cfg, err := config.ParseEdgePort([]byte(fmt.Sprintf(`
kind: EdgePort
apiVersion: v3
ref: edgeport-test
spec:
  bindAddr: 127.0.0.1
  processor:
    addr: %s
  methods: [INVITE, ACK, BYE, CANCEL, MESSAGE, REGISTER]
  %s
  externalAddrs: [127.0.0.1]
  localnets: [127.0.0.1/8]
  transport:
    - protocol: udp
      port: %d
`, l.Addr().String(), strings.Join(specLines, "\n  "), port)), config.ResolveOptions{Env: config.EnvFromMap(nil)})
	if err != nil {
		t.Fatal(err)
	}
	conn, err := grpc.NewClient(l.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	ep, err := New(cfg, Options{Processor: ppb.NewProcessorClient(conn), Version: "test", dialogStore: store})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		_ = ep.Start(ctx)
	}()
	stop := func() {
		cancel()
		<-stopped
	}
	t.Cleanup(stop)
	time.Sleep(200 * time.Millisecond)
	return ep, stop
}

// noCloseStore keeps the store two EdgePorts share open when one of them stops.
type noCloseStore struct{ dialogStore }

func (noCloseStore) Close() error { return nil }

// The acceptance criterion of #578: a BYE for a call set up before an EdgePort
// restart reaches the far end, and the relay stays closed.
func TestFlowInDialogAfterARestart(t *testing.T) {
	store := newMemoryDialogStore()
	shared := noCloseStore{store}
	proc := &fakeProcessor{}
	uas := newPeer(t)
	proc.uas = uas.port
	edge := freeUDPPort(t)
	_, stop := startSharedEdgePort(t, proc, shared, edge)
	uac := newPeer(t)
	target := establish(t, edge, uac, uas, "restart1")
	uac.send(edge, inDialogText("ACK", "1002@"+target, "restart1", "a1", uac.port, 1, ""))
	if req, ok := mustRecv(t, uas).(*sip.Request); !ok || req.Method != sip.ACK {
		t.Fatalf("the ACK reaches the callee: %v", req)
	}

	// The restart: the first EdgePort saves its dialogs as it stops, and a new
	// one, with an empty table, takes its address
	stop()
	if rec, ok := store.record("restart1"); !ok || rec.Ended {
		t.Fatalf("the stopped edgeport left the dialog in the store: %+v, %v", rec, ok)
	}
	proc = &fakeProcessor{uas: uas.port}
	startSharedEdgePort(t, proc, shared, edge)

	t.Run("an unknown dialog is still 481", func(t *testing.T) {
		for _, method := range []string{"MESSAGE", "BYE", "INFO"} {
			uac.send(edge, inDialogText(method, target, "forged-"+method, "f"+method, uac.port, 2, ""))
			expect481(t, uac)
		}
	})
	t.Run("the restored dialog relays nowhere else", func(t *testing.T) {
		uac.send(edge, inDialogText("BYE", "victim@198.51.100.9:5060", "restart1", "v1", uac.port, 2, ""))
		expect481(t, uac)
		uac.send(edge, inDialogText("INFO", "1002@"+target, "restart1", "v2", uac.port, 2, "Route: <sip:198.51.100.9:5060;lr>\n"))
		expect481(t, uac)
		if got := len(proc.requests(ppb.Method_BYE)); got != 0 {
			t.Fatalf("%d forged BYE reached the processor", got)
		}
	})
	t.Run("a re-INVITE passes", func(t *testing.T) {
		uac.send(edge, inDialogText("INVITE", "1002@"+target, "restart1", "i1", uac.port, 2, fmt.Sprintf("Contact: <sip:1001@127.0.0.1:%d>\n", uac.port)))
		req, ok := mustRecv(t, uas).(*sip.Request)
		if !ok || req.Method != sip.INVITE {
			t.Fatalf("the re-INVITE reaches the callee: %v", req)
		}
		answerOK(uas, edge, req)
		if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
			t.Fatalf("the re-INVITE is answered: %v", res)
		}
	})
	t.Run("the BYE reaches the far end", func(t *testing.T) {
		uac.send(edge, inDialogText("BYE", "1002@"+target, "restart1", "b1", uac.port, 3, ""))
		req, ok := mustRecv(t, uas).(*sip.Request)
		if !ok || req.Method != sip.BYE {
			t.Fatalf("the BYE reaches the callee: %v", req)
		}
		answerOK(uas, edge, req)
		if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
			t.Fatalf("the BYE is answered: %v", res)
		}
		eventually(t, "the end of the dialog is shared", func() bool { rec, _ := store.record("restart1"); return rec.Ended })
	})
	t.Run("the ended dialog starts nothing", func(t *testing.T) {
		uac.send(edge, inDialogText("INVITE", "1002@"+target, "restart1", "i2", uac.port, 4, ""))
		expect481(t, uac)
	})
}

// A dialog one EdgePort established is known to the other on the same table,
// as replicas behind one address are.
func TestFlowInDialogOnAnotherEdgePort(t *testing.T) {
	store := newMemoryDialogStore()
	shared := noCloseStore{store}
	uas := newPeer(t)
	first := freeUDPPort(t)
	setUp, _ := startSharedEdgePort(t, &fakeProcessor{uas: uas.port}, shared, first)
	second := freeUDPPort(t)
	startSharedEdgePort(t, &fakeProcessor{uas: uas.port}, shared, second)
	uac := newPeer(t)
	target := establish(t, first, uac, uas, "replica1")
	eventually(t, "the dialog is shared", func() bool { _, ok := store.record("replica1"); return ok })

	uac.send(second, inDialogText("BYE", "1002@"+target, "replica1", "b1", uac.port, 2, ""))
	req, ok := mustRecv(t, uas).(*sip.Request)
	if !ok || req.Method != sip.BYE {
		t.Fatalf("the BYE reaches the callee through the other edgeport: %v", req)
	}
	answerOK(uas, second, req)
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
		t.Fatalf("the BYE is answered: %v", res)
	}
	eventually(t, "the end of the dialog is shared", func() bool { rec, _ := store.record("replica1"); return rec.Ended })
	// The EdgePort that set the call up saw no BYE: it is told, or the dialog
	// would hold its entry there for the idle day
	eventually(t, "the first edgeport learns of the end", func() bool { return !setUp.txm.HasDialog("replica1") })
	uac.send(first, inDialogText("INVITE", "1002@"+target, "replica1", "i1", uac.port, 3, ""))
	expect481(t, uac)
}

// The same restart with the table where spec.cache puts it: a Redis, as the
// chart's EdgePorts have. It skips without TEST_REDIS_URL.
func TestFlowInDialogAfterARestartOnRedis(t *testing.T) {
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		t.Skip("TEST_REDIS_URL is not set")
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	host, port, err := net.SplitHostPort(opts.Addr)
	if err != nil || opts.Password != "" {
		t.Skipf("TEST_REDIS_URL %q is not a plain host and port", opts.Addr)
	}
	cache := fmt.Sprintf("cache: {provider: redis, parameters: 'host=%s,port=%s'}", host, port)
	callID := fmt.Sprintf("restart-redis-%d", time.Now().UnixNano())

	uas := newPeer(t)
	edge := freeUDPPort(t)
	_, stop := startSharedEdgePort(t, &fakeProcessor{uas: uas.port}, nil, edge, cache)
	uac := newPeer(t)
	target := establish(t, edge, uac, uas, callID)
	stop()
	startSharedEdgePort(t, &fakeProcessor{uas: uas.port}, nil, edge, cache)

	uac.send(edge, inDialogText("MESSAGE", target, "forged-"+callID, "f1", uac.port, 2, ""))
	expect481(t, uac)
	uac.send(edge, inDialogText("BYE", "1002@"+target, callID, "b1", uac.port, 2, ""))
	req, ok := mustRecv(t, uas).(*sip.Request)
	if !ok || req.Method != sip.BYE {
		t.Fatalf("the BYE reaches the callee: %v", req)
	}
	answerOK(uas, edge, req)
	if res, ok := mustRecv(t, uac).(*sip.Response); !ok || res.StatusCode != 200 {
		t.Fatalf("the BYE is answered: %v", res)
	}
	client := redis.NewClient(opts)
	defer client.Close()
	eventually(t, "the end of the dialog reaches Redis", func() bool {
		text, err := client.Get(context.Background(), redisDialogKey(callID)).Result()
		return err == nil && strings.Contains(text, `"e":true`)
	})
}
