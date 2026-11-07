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

package dispatcher

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/trace"
)

// The defaults of mods/dispatcher/src/recorder/recorder.ts, plus the queue
// between the message path and the writer, which Node did not have.
const (
	defaultMaxRecordsPerCall  = 1000
	defaultMaxCalls           = 10000
	defaultIdleTimeoutSeconds = 7200
	defaultLintWindow         = 32
	defaultRecorderQueue      = 4096
	recorderSweepInterval     = time.Minute
	// A failure that repeats per message is logged once per this many
	recorderLogEvery = 1000
)

// RecorderOptions are what NewRecorder takes.
type RecorderOptions struct {
	// Ref is the Dispatcher's ref, written into every record
	Ref string
	// Version is the Dispatcher's, written into every record and naming the
	// rule set of the findings
	Version string
	// Spec is the configuration; nil or not enabled means no Recorder
	Spec *config.RecordingSpec
	// Logger receives the recorder's logs; slog.Default() when nil
	Logger *slog.Logger
	// QueueSize bounds the records waiting for the writer (default 4096)
	QueueSize int
	// Append writes to a file; appendFile when nil
	Append func(path string, data []byte) error
	// Now is the clock; time.Now when nil
	Now func() time.Time
}

// recordedMessage is what crossed the Dispatcher, on its way to the writer.
type recordedMessage struct {
	request *processor.MessageRequest
	// result is nil when the Dispatcher answered with an error
	result  *processor.MessageRequest
	hops    []hopEvent
	failed  bool
	at      time.Time
	totalMs float64
}

// recordingSession is one call being recorded. The writer's alone.
type recordingSession struct {
	file      string
	seq       int
	startedAt time.Time
	lastSeen  time.Time
	trunkRef  string
	// recent holds the last records of the call, for the rules that look at
	// the whole call
	recent []*trace.Record
}

// Recorder writes one JSONL file per recorded call, the files rctl trace reads.
//
// In flagged mode a call is recorded from the first message a processor marks
// until it has been idle for idleTimeoutSeconds; in all mode every call is. The
// message path only hands a recordedMessage to a bounded queue and never waits:
// a full queue drops the message and counts it. One goroutine, owned by the
// Recorder and stopped by Close, owns the sessions and does everything else:
// redaction, diffs, rules, encoding and writing. A failed write is logged.
type Recorder struct {
	ref, version string
	path         string
	mode         string
	redact       bool
	maxRecords   int
	maxCalls     int
	idleTimeout  time.Duration
	profiles     []trace.Profile
	window       int

	log    *slog.Logger
	append func(path string, data []byte) error
	now    func() time.Time

	queue    chan recordedMessage
	dropped  atomic.Uint64
	stop     chan struct{}
	done     chan struct{}
	stopOnce sync.Once

	// The writer's own
	sessions      map[string]*recordingSession
	encoder       *trace.Encoder
	line          []byte
	reportedDrops uint64
	refused       uint64
	failedWrites  uint64
}

// NewRecorder builds the Recorder of a spec and starts its writer; the caller
// closes it. A spec that is nil or not enabled yields a nil Recorder, which
// Options takes and Close accepts. A directory it can't create fails the build,
// as it failed the Node dispatcher's start.
func NewRecorder(opts RecorderOptions) (*Recorder, error) {
	if opts.Spec == nil || !opts.Spec.Enabled {
		return nil, nil
	}
	r, err := newRecorder(opts)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(r.path, 0o755); err != nil {
		return nil, fmt.Errorf("unable to create the recording directory: %w", err)
	}
	r.log.Info("message recording enabled", "path", r.path, "mode", r.mode, "redact", r.redact, "lint", profileNames(r.profiles))
	go r.run()
	return r, nil
}

// newRecorder is NewRecorder without the directory and the goroutine.
func newRecorder(opts RecorderOptions) (*Recorder, error) {
	spec := opts.Spec
	if spec.Path == "" {
		return nil, errors.New("recording: a path is required")
	}
	mode := spec.Mode
	if mode == "" {
		mode = config.RecordingModeFlagged
	}
	if mode != config.RecordingModeFlagged && mode != config.RecordingModeAll {
		return nil, fmt.Errorf("recording: unknown mode %q", mode)
	}
	r := &Recorder{
		ref:         opts.Ref,
		version:     opts.Version,
		path:        spec.Path,
		mode:        mode,
		redact:      spec.Redact == nil || *spec.Redact,
		maxRecords:  orDefault(spec.MaxRecordsPerCall, defaultMaxRecordsPerCall),
		maxCalls:    orDefault(spec.MaxCalls, defaultMaxCalls),
		idleTimeout: time.Duration(orDefault(spec.IdleTimeoutSeconds, defaultIdleTimeoutSeconds)) * time.Second,
		log:         opts.Logger,
		append:      opts.Append,
		now:         opts.Now,
		queue:       make(chan recordedMessage, orDefault(opts.QueueSize, defaultRecorderQueue)),
		stop:        make(chan struct{}),
		done:        make(chan struct{}),
		sessions:    map[string]*recordingSession{},
		encoder:     trace.NewEncoder(),
	}
	if r.ref == "" {
		r.ref = "dispatcher"
	}
	if r.log == nil {
		r.log = slog.Default()
	}
	if r.append == nil {
		r.append = appendFile
	}
	if r.now == nil {
		r.now = time.Now
	}
	if spec.Lint != nil {
		for _, name := range spec.Lint.Profiles {
			p := trace.Profile(name)
			if p != trace.ProfileSIP && p != trace.ProfileSIPConnect {
				return nil, fmt.Errorf("recording: unknown lint profile %q", name)
			}
			r.profiles = append(r.profiles, p)
		}
		r.window = defaultLintWindow
		if spec.Lint.Window != nil {
			r.window = *spec.Lint.Window
		}
	}
	return r, nil
}

func orDefault(value, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

func profileNames(profiles []trace.Profile) string {
	if len(profiles) == 0 {
		return "off"
	}
	names := make([]string, len(profiles))
	for i, p := range profiles {
		names[i] = string(p)
	}
	return strings.Join(names, ",")
}

// appendFile opens, writes and closes per record, as the Node recorder's
// fs.appendFile did: a call lasts minutes and maxCalls is 10000, more files than
// a process should hold open.
func appendFile(path string, data []byte) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	return err
}

// record hands a message that crossed the Dispatcher to the writer. It never
// waits: when the queue is full the message is dropped and counted. It takes
// the messages as they are, since nobody changes them after this point.
func (r *Recorder) record(request, result *processor.MessageRequest, hops *hopCollector, failed bool) {
	select {
	case r.queue <- recordedMessage{
		request: request,
		result:  result,
		hops:    hops.hops,
		failed:  failed,
		at:      r.now(),
		totalMs: roundMs(time.Since(hops.startedAt)),
	}:
	default:
		r.dropped.Add(1)
	}
}

// Dropped is the number of messages lost to a full queue since the start.
func (r *Recorder) Dropped() uint64 {
	if r == nil {
		return 0
	}
	return r.dropped.Load()
}

// Close writes what is queued and stops the writer. Stop the servers first: a
// message recorded afterwards is not written. A nil Recorder closes.
func (r *Recorder) Close() {
	if r == nil {
		return
	}
	r.stopOnce.Do(func() { close(r.stop) })
	<-r.done
}

// run is the writer goroutine.
func (r *Recorder) run() {
	defer close(r.done)
	ticker := time.NewTicker(recorderSweepInterval)
	defer ticker.Stop()
	for {
		select {
		case m := <-r.queue:
			r.handle(m)
		case <-ticker.C:
			r.sweep()
			r.reportDrops()
		case <-r.stop:
			r.drain()
			r.reportDrops()
			return
		}
	}
}

func (r *Recorder) drain() {
	for {
		select {
		case m := <-r.queue:
			r.handle(m)
		default:
			return
		}
	}
}

// reportDrops logs from the writer, so the message path never does.
func (r *Recorder) reportDrops() {
	dropped := r.dropped.Load()
	if dropped != r.reportedDrops {
		r.log.Warn("recording queue full: messages were not recorded", "dropped", dropped-r.reportedDrops, "total", dropped)
		r.reportedDrops = dropped
	}
}

// handle records one message. Nothing that goes wrong here reaches a call: a
// bug in a rule or a broken record loses the record, not the process.
func (r *Recorder) handle(m recordedMessage) {
	defer func() {
		if p := recover(); p != nil {
			r.log.Error("failed to record a message", "callId", m.request.GetRef(), "error", p)
		}
	}()
	flag := trace.Split(m.result.GetMetadata()).Flag
	session := r.sessionFor(m.request.GetRef(), flag, m.at)
	if session == nil || session.seq >= r.maxRecords {
		return
	}
	session.seq++
	session.lastSeen = m.at
	record := r.buildRecord(session, &m)
	r.lint(session, record)

	r.line = append(r.encoder.AppendRecord(r.line[:0], record), '\n')
	if err := r.append(session.file, r.line); err != nil {
		r.failedWrites++
		if r.failedWrites%recorderLogEvery == 1 {
			r.log.Error("failed to write trace record", "file", session.file, "error", err, "failedWrites", r.failedWrites)
		}
	}
}

func (r *Recorder) sessionFor(callID, flag string, at time.Time) *recordingSession {
	if session, ok := r.sessions[callID]; ok {
		if flag != "" && session.trunkRef == "" {
			session.trunkRef = flag
		}
		return session
	}
	if r.mode == config.RecordingModeFlagged && flag == "" {
		return nil
	}
	if len(r.sessions) >= r.maxCalls {
		r.refused++
		if r.refused%recorderLogEvery == 1 {
			r.log.Warn("not recording call: too many calls being recorded", "maxCalls", r.maxCalls, "refused", r.refused)
		}
		return nil
	}
	session := &recordingSession{
		file:      filepath.Join(r.path, fileNameFor(at, callID)),
		startedAt: at,
		lastSeen:  at,
		trunkRef:  flag,
	}
	r.sessions[callID] = session
	return session
}

func (r *Recorder) buildRecord(session *recordingSession, m *recordedMessage) *trace.Record {
	request := m.request
	message := request.GetMessage()
	isResponse := trace.IsResponse(message)
	resultMessage := m.result.GetMessage()
	resultIsResponse := trace.IsResponse(resultMessage)

	status := 0
	switch {
	case isResponse:
		status = trace.StatusCodeOf(message.GetResponseType())
	case resultIsResponse:
		status = trace.StatusCodeOf(resultMessage.GetResponseType())
	}
	var outcome trace.Outcome
	switch {
	case m.failed:
		outcome = trace.OutcomeError
	case isResponse:
		outcome = trace.OutcomeRelayed
	case resultIsResponse && status != 0 && status < 300:
		outcome = trace.OutcomeAnswered
	case resultIsResponse:
		outcome = trace.OutcomeRejected
	default:
		outcome = trace.OutcomeForwarded
	}
	kind := trace.KindRequest
	if isResponse {
		kind = trace.KindResponse
	}

	stripped := cloneRequest(request)
	stripped.Metadata = trace.Split(request.GetMetadata()).Rest
	if request.GetReceivedOn().GetHost() == "" {
		stripped.ReceivedOn = nil
	}
	if r.redact {
		stripped.Message = trace.RedactMessage(message)
	}

	hops := make([]trace.Hop, len(m.hops))
	for i := range m.hops {
		hops[i] = m.hops[i].hop(r.redact)
	}

	var response *trace.Response
	if resultMessage != nil {
		response = &trace.Response{Message: resultMessage, Metadata: trace.Split(m.result.GetMetadata()).Rest}
		if r.redact {
			response.Message = trace.RedactMessage(resultMessage)
		}
	}

	return &trace.Record{
		RecordedAt:  m.at.UTC().Format("2006-01-02T15:04:05.000Z"),
		CallID:      request.GetRef(),
		Seq:         session.seq,
		TOffsetMs:   float64(max(0, m.at.UnixMilli()-session.startedAt.UnixMilli())),
		Kind:        kind,
		Method:      request.GetMethod().String(),
		Status:      status,
		EdgePort:    trace.Component{Ref: request.GetEdgePortRef(), Version: request.GetEdgePortVersion()},
		Dispatcher:  trace.Component{Ref: r.ref, Version: r.version},
		TrunkRef:    session.trunkRef,
		Request:     stripped,
		MessageLast: r.redact,
		Hops:        hops,
		Response:    response,
		Outcome:     outcome,
		TotalMs:     m.totalMs,
	}
}

// lint evaluates the configured profiles on the record and logs what is out of
// spec. It runs after the answer went back to the EdgePort, so it costs the
// call nothing.
func (r *Recorder) lint(session *recordingSession, record *trace.Record) {
	if len(r.profiles) == 0 {
		return
	}
	findings := trace.Evaluate(record, session.recent, r.profiles)
	for i := range findings {
		f := &findings[i]
		r.log.Warn("out of spec: "+f.Message, "callId", record.CallID, "seq", record.Seq, "rule", f.Rule, "severity", f.Severity, "spec", f.Spec)
	}
	record.Lint = &trace.Lint{Version: r.version, Profiles: r.profiles}
	record.Findings = findings
	if r.window > 0 {
		session.recent = append(session.recent, record)
		if len(session.recent) > r.window {
			session.recent = session.recent[1:]
		}
	}
}

// sweep forgets the calls idle for longer than the timeout.
func (r *Recorder) sweep() {
	cutoff := r.now().Add(-r.idleTimeout)
	for callID, session := range r.sessions {
		if session.lastSeen.Before(cutoff) {
			delete(r.sessions, callID)
		}
	}
}

// fileNameFor builds a file name that sorts by time and is safe on every file
// system: 20261023T024110321Z-1-25_10.111.221.22.jsonl. A character outside the
// safe set becomes one underscore per UTF-16 unit, as the Node regexp had it.
func fileNameFor(startedAt time.Time, callID string) string {
	stamp := strings.Replace(startedAt.UTC().Format("20060102T150405.000Z"), ".", "", 1)
	safe := make([]byte, 0, len(callID))
	for _, c := range callID {
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '.', c == '_', c == '-':
			safe = append(safe, byte(c))
		case c > 0xFFFF:
			safe = append(safe, '_', '_')
		default:
			safe = append(safe, '_')
		}
	}
	if len(safe) > 120 {
		safe = safe[:120]
	}
	return stamp + "-" + string(safe) + ".jsonl"
}
