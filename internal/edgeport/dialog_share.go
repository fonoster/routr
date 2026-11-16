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
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

const (
	// dialogLoadTimeout bounds the one lookup an in-dialog request for a dialog
	// this EdgePort doesn't hold waits on. Past it the request gets the 481 it
	// would get with no shared table.
	dialogLoadTimeout = 500 * time.Millisecond
	// dialogStoreBackoff is how long a store that failed is left alone: no
	// lookup and no save reaches it, so a store that is down costs a flood of
	// unknown-dialog requests nothing.
	dialogStoreBackoff = time.Second
	// maxDialogLoads bounds the lookups in flight. Each holds its call's
	// goroutine for up to dialogLoadTimeout, and anyone can cause one with an
	// in-dialog request for a dialog that doesn't exist: past the bound a
	// request gets its 481 without one, so a slow store can't pile them up.
	maxDialogLoads = 512
	// dialogSaveTimeout bounds one batch of saves, and the last flush of Close.
	dialogSaveTimeout = 2 * time.Second
	// dialogSaveBatch is how many dialogs go to the store in one round trip.
	dialogSaveBatch = 256
	// maxPendingDialogSaves bounds the dialogs waiting to be saved while the
	// store is down. Past it the newest changes are not shared: those dialogs
	// are known to this EdgePort alone, as with no shared table.
	maxPendingDialogSaves = 100_000
)

// SharedDialogSave is one dialog on its way to the store.
type SharedDialogSave struct {
	CallID string
	Record DialogRecord
	// TTL is how long the record has left: the dialog's idle time while it is
	// up, what is left of dialogLinger once it ended
	TTL time.Duration
}

// dialogStore is where EdgePorts behind one address, and an EdgePort across
// its restarts, keep the dialogs they proxied (spec.cache). Only established
// dialogs are in it.
type dialogStore interface {
	// Save merges each record into what the store holds for its call: the
	// targets add up, an ended dialog stays ended and the CSeq offset never
	// goes down, so EdgePorts that each saw part of a dialog don't undo each
	// other.
	Save(ctx context.Context, dialogs []SharedDialogSave) error
	// Load returns the record of a call, or false when the store has none.
	Load(ctx context.Context, callID string) (DialogRecord, bool, error)
	// Ended calls each with the call of every dialog saved as ended from now
	// on, by any EdgePort, until ctx is done. It returns an error when it
	// can't listen, or can't any longer.
	Ended(ctx context.Context, each func(callID string)) error
	Close() error
}

// dialogSharer keeps a TransactionManager's established dialogs in a
// dialogStore: it saves the ones that change, off the message path, and loads
// the one an in-dialog request names when the table doesn't hold it.
type dialogSharer struct {
	store dialogStore
	txm   *TransactionManager
	log   *slog.Logger

	mu sync.Mutex
	// the calls whose record changed since it was last saved
	pending map[string]struct{}
	// downUntil is when a store that failed is tried again, in Unix
	// nanoseconds; down is whether the last call to it failed
	downUntil atomic.Int64
	down      atomic.Bool

	// loads has a slot for every lookup in flight
	loads chan struct{}

	wake chan struct{}
	stop chan struct{}
	// done and listened close when the goroutine that saves and the one that
	// listens for ended dialogs are gone; cancel stops the listening
	done      chan struct{}
	listened  chan struct{}
	ctx       context.Context
	cancel    context.CancelFunc
	startOnce sync.Once
	stopOnce  sync.Once

	// overflow counts a save or a lookup a bound refused
	overflow func()
	now      func() time.Time
}

// newDialogSharer ties txm to store. Nothing runs until start.
func newDialogSharer(store dialogStore, txm *TransactionManager, log *slog.Logger, overflow func()) *dialogSharer {
	ctx, cancel := context.WithCancel(context.Background())
	s := &dialogSharer{
		ctx:      ctx,
		cancel:   cancel,
		listened: make(chan struct{}),
		store:    store,
		txm:      txm,
		log:      log,
		pending:  map[string]struct{}{},
		loads:    make(chan struct{}, maxDialogLoads),
		wake:     make(chan struct{}, 1),
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
		overflow: overflow,
		now:      time.Now,
	}
	txm.mu.Lock()
	txm.onShare = s.changed
	txm.mu.Unlock()
	return s
}

// changed notes that a shared dialog has something to save. The
// TransactionManager calls it with its lock held, on the message path: it only
// takes note and never waits on the store.
func (s *dialogSharer) changed(callID string) {
	s.mu.Lock()
	if _, ok := s.pending[callID]; !ok && len(s.pending) >= maxPendingDialogSaves {
		s.mu.Unlock()
		s.overflow()
		return
	}
	s.pending[callID] = struct{}{}
	s.mu.Unlock()
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// start runs the goroutine that saves and the one that listens for the
// dialogs other EdgePorts ended; close stops both.
func (s *dialogSharer) start() {
	s.startOnce.Do(func() {
		go s.run()
		go s.listen()
	})
}

// listen ends here the dialogs that ended through another EdgePort, for as
// long as the sharer runs. A store it can't listen to is tried again after the
// backoff; what ended meanwhile stays until dialogIdle, as with no shared table.
func (s *dialogSharer) listen() {
	defer close(s.listened)
	for {
		err := s.store.Ended(s.ctx, s.txm.EndSharedDialog)
		if s.ctx.Err() != nil {
			return
		}
		if err != nil {
			s.failed(err)
		}
		retry := time.NewTimer(dialogStoreBackoff)
		select {
		case <-s.ctx.Done():
			retry.Stop()
			return
		case <-retry.C:
		}
	}
}

// close saves what is pending, within dialogSaveTimeout, and closes the store:
// an EdgePort that stops for a rolling update leaves its dialogs to the next.
func (s *dialogSharer) close() {
	s.stopOnce.Do(func() {
		close(s.stop)
		s.cancel()
		ran := true
		// A sharer that never started has no goroutine to wait for, and gets none
		s.startOnce.Do(func() { ran = false })
		if ran {
			<-s.done
			<-s.listened
		}
		if err := s.store.Close(); err != nil {
			s.log.Debug("closing the dialog store", "error", err)
		}
	})
}

func (s *dialogSharer) run() {
	defer close(s.done)
	for {
		select {
		case <-s.stop:
			s.lastFlush()
			return
		case <-s.wake:
		}
		if s.flush(context.Background()) {
			continue
		}
		// The store failed: what was pending still is. Try again after the backoff
		retry := time.NewTimer(dialogStoreBackoff)
		select {
		case <-s.stop:
			retry.Stop()
			s.lastFlush()
			return
		case <-retry.C:
			select {
			case s.wake <- struct{}{}:
			default:
			}
		}
	}
}

// lastFlush is the flush of close: one try, dialogSaveTimeout for all of it.
func (s *dialogSharer) lastFlush() {
	ctx, cancel := context.WithTimeout(context.Background(), dialogSaveTimeout)
	defer cancel()
	s.flush(ctx)
}

// flush saves every pending dialog, a batch at a time, and tells whether the
// store took them all. The ones it didn't take are pending again.
func (s *dialogSharer) flush(ctx context.Context) bool {
	s.mu.Lock()
	calls := make([]string, 0, len(s.pending))
	for callID := range s.pending {
		calls = append(calls, callID)
	}
	s.pending = map[string]struct{}{}
	s.mu.Unlock()

	for len(calls) > 0 {
		n := min(len(calls), dialogSaveBatch)
		batch := make([]SharedDialogSave, 0, n)
		for _, callID := range calls[:n] {
			// A dialog that expired since has nothing to save
			if rec, ttl, ok := s.txm.SharedDialog(callID); ok {
				batch = append(batch, SharedDialogSave{CallID: callID, Record: rec, TTL: ttl})
			}
		}
		if len(batch) > 0 {
			saveCtx, cancel := context.WithTimeout(ctx, dialogSaveTimeout)
			err := s.store.Save(saveCtx, batch)
			cancel()
			if err != nil {
				s.failed(err)
				s.mu.Lock()
				for _, callID := range calls {
					if len(s.pending) >= maxPendingDialogSaves {
						break
					}
					s.pending[callID] = struct{}{}
				}
				s.mu.Unlock()
				return false
			}
			s.recovered()
		}
		calls = calls[n:]
	}
	return true
}

// restore loads the dialog of a call from the store into the table and tells
// whether it is there now. A store that is failing isn't asked, nor one with
// maxDialogLoads lookups already waiting on it.
func (s *dialogSharer) restore(callID string) bool {
	if s.now().UnixNano() < s.downUntil.Load() {
		return false
	}
	select {
	case s.loads <- struct{}{}:
		defer func() { <-s.loads }()
	default:
		s.overflow()
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), dialogLoadTimeout)
	defer cancel()
	rec, found, err := s.store.Load(ctx, callID)
	if err != nil {
		s.failed(err)
		return false
	}
	s.recovered()
	return found && s.txm.RestoreDialog(callID, rec)
}

// failed backs off from the store and logs the first failure of an outage.
func (s *dialogSharer) failed(err error) {
	s.downUntil.Store(s.now().Add(dialogStoreBackoff).UnixNano())
	if !s.down.Swap(true) {
		s.log.Warn("the dialog store is not answering: dialogs are known to this edgeport alone until it does",
			"error", err.Error())
	}
}

func (s *dialogSharer) recovered() {
	if s.down.Swap(false) {
		s.log.Info("the dialog store is answering again")
	}
}
