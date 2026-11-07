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
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The behavior spec: mods/dispatcher/test/recorder.unit.test.ts. The tests run
// the writer's work on their own goroutine (handle, drain, sweep) unless they
// are about the goroutine.

type recorderWrite struct {
	file, line string
}

type recorderHarness struct {
	*Recorder
	writes []recorderWrite
	clock  time.Time
}

func newHarness(t *testing.T, spec config.RecordingSpec) *recorderHarness {
	t.Helper()
	h := &recorderHarness{clock: time.UnixMilli(1_700_000_000_000)}
	spec.Enabled = true
	spec.Path = "/traces"
	r, err := newRecorder(RecorderOptions{
		Ref:     "dispatcher-test",
		Version: "3.0.0",
		Spec:    &spec,
		Logger:  quietLogger,
		Append: func(path string, data []byte) error {
			h.writes = append(h.writes, recorderWrite{file: path, line: string(data)})
			return nil
		},
		Now: func() time.Time { return h.clock },
	})
	if err != nil {
		t.Fatal(err)
	}
	h.Recorder = r
	return h
}

func (h *recorderHarness) records(t *testing.T) []map[string]any {
	t.Helper()
	out := make([]map[string]any, 0, len(h.writes))
	for _, w := range h.writes {
		if !strings.HasSuffix(w.line, "}\n") {
			t.Fatalf("not a line: %q", w.line)
		}
		var doc map[string]any
		if err := json.Unmarshal([]byte(w.line), &doc); err != nil {
			t.Fatal(err)
		}
		out = append(out, doc)
	}
	return out
}

// send is one message crossing the Dispatcher, on the writer's work directly.
func (h *recorderHarness) send(request, result *processor.MessageRequest, failed bool) {
	h.handle(recordedMessage{request: request, result: result, failed: failed, at: h.clock})
}

func traceMessage(mutators ...func(*pb.SIPMessage)) *pb.SIPMessage {
	m := &pb.SIPMessage{
		MessageType: &pb.SIPMessage_RequestUri{RequestUri: &pb.SipURI{User: "17853178070", Host: "sip.local"}},
		From:        &pb.From{Address: &pb.Address{Uri: &pb.SipURI{User: "1001", Host: "sip.local"}}, Tag: "1"},
		To:          &pb.To{Address: &pb.Address{Uri: &pb.SipURI{User: "17853178070", Host: "sip.local"}}},
		CallId:      &pb.CallID{CallId: "call-1"},
		MaxForwards: &pb.MaxForwards{MaxForwards: 70},
		Extensions:  []*pb.Extension{{Name: "CSeq", Value: "1 INVITE"}},
		Via:         []*pb.Via{{Host: "10.0.0.2", Port: 5060, Transport: "UDP"}},
	}
	for _, mutate := range mutators {
		mutate(m)
	}
	return m
}

func traceRequest(mutators ...func(*processor.MessageRequest)) *processor.MessageRequest {
	r := &processor.MessageRequest{
		Ref:             "call-1",
		EdgePortRef:     "edgeport-01",
		EdgePortVersion: "2.18.0",
		Method:          processor.Method_INVITE,
		Sender:          &processor.NetInterface{Host: "10.0.0.2", Port: 5060, Transport: common.Transport_UDP},
		Message:         traceMessage(),
	}
	for _, mutate := range mutators {
		mutate(r)
	}
	return r
}

func answering(t pb.ResponseType) func(*processor.MessageRequest) {
	return func(r *processor.MessageRequest) {
		r.Message = traceMessage(func(m *pb.SIPMessage) {
			m.MessageType = &pb.SIPMessage_ResponseType{ResponseType: t}
		})
	}
}

func TestFileNameForSortsByTimeAndIsSafe(t *testing.T) {
	got := fileNameFor(time.UnixMilli(1_700_000_000_000), "1-25@10.111.221.22")
	if want := "20231114T221320000Z-1-25_10.111.221.22.jsonl"; got != want {
		t.Errorf("got %s, want %s", got, want)
	}
	if got := fileNameFor(time.UnixMilli(0), "../é😀"); got != "19700101T000000000Z-..____.jsonl" {
		t.Errorf("got %s", got)
	}
	if got := fileNameFor(time.UnixMilli(0), strings.Repeat("a", 200)); len(got) != len("19700101T000000000Z-")+120+len(".jsonl") {
		t.Errorf("got %d bytes", len(got))
	}
}

func TestNewRecorderOffWithoutASpec(t *testing.T) {
	for _, spec := range []*config.RecordingSpec{nil, {Path: "/traces"}} {
		r, err := NewRecorder(RecorderOptions{Spec: spec})
		if r != nil || err != nil {
			t.Errorf("spec %+v: %v %v", spec, r, err)
		}
		r.Close()
		if r.Dropped() != 0 {
			t.Error("nothing dropped")
		}
	}
}

func TestNewRecorderRejectsWhatItCannotServe(t *testing.T) {
	cases := map[string]config.RecordingSpec{
		"a path is required": {Enabled: true},
		"unknown mode":       {Enabled: true, Path: "/traces", Mode: "sometimes"},
		"unknown lint":       {Enabled: true, Path: "/traces", Lint: &config.RecordingLint{Profiles: []string{"nope"}}},
	}
	for want, spec := range cases {
		if _, err := NewRecorder(RecorderOptions{Spec: &spec}); err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("got %v, want %q", err, want)
		}
	}
	file := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(file, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := NewRecorder(RecorderOptions{Spec: &config.RecordingSpec{Enabled: true, Path: filepath.Join(file, "traces")}, Logger: quietLogger})
	if err == nil || !strings.Contains(err.Error(), "recording directory") {
		t.Errorf("got %v", err)
	}
}

func TestFlaggedModeRecordsNothingUntilAProcessorFlagsTheCall(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeFlagged})
	h.send(traceRequest(), nil, false)
	if len(h.writes) != 0 || len(h.sessions) != 0 {
		t.Errorf("writes %d, sessions %d", len(h.writes), len(h.sessions))
	}
}

func TestFlaggedModeRecordsTheCallAndEveryLaterMessage(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{})
	h.send(traceRequest(), traceRequest(func(r *processor.MessageRequest) {
		r.Metadata = map[string]string{"trace.record": "trunk-01", "accountRef": "a"}
	}), false)
	h.clock = h.clock.Add(80 * time.Millisecond)
	bye := func(r *processor.MessageRequest) { r.Method = processor.Method_BYE }
	h.send(traceRequest(bye), traceRequest(bye), false)

	records := h.records(t)
	if len(records) != 2 {
		t.Fatalf("records: %d", len(records))
	}
	first, second := records[0], records[1]
	want := map[string]any{
		"traceVersion": 1.0, "seq": 1.0, "tOffsetMs": 0.0, "kind": "request", "method": "INVITE",
		"trunkRef": "trunk-01", "outcome": "forwarded", "callId": "call-1", "recordedAt": "2023-11-14T22:13:20.000Z",
	}
	for k, v := range want {
		if first[k] != v {
			t.Errorf("%s: got %v, want %v", k, first[k], v)
		}
	}
	if !reflect.DeepEqual(first["edgePort"], map[string]any{"ref": "edgeport-01", "version": "2.18.0"}) {
		t.Errorf("edgePort: %v", first["edgePort"])
	}
	if !reflect.DeepEqual(first["dispatcher"], map[string]any{"ref": "dispatcher-test", "version": "3.0.0"}) {
		t.Errorf("dispatcher: %v", first["dispatcher"])
	}
	if !reflect.DeepEqual(first["response"].(map[string]any)["metadata"], map[string]any{"accountRef": "a"}) {
		t.Errorf("response: %v", first["response"])
	}
	if second["seq"] != 2.0 || second["tOffsetMs"] != 80.0 || second["method"] != "BYE" {
		t.Errorf("second: %v %v %v", second["seq"], second["tOffsetMs"], second["method"])
	}
	if h.writes[0].file != h.writes[1].file || h.writes[0].file != "/traces/20231114T221320000Z-call-1.jsonl" {
		t.Errorf("files: %s, %s", h.writes[0].file, h.writes[1].file)
	}
}

func TestAllModeRecordsEveryCallAndClassifiesOutcomes(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll})
	ringing := traceRequest(answering(pb.ResponseType_RINGING))
	register := func(r *processor.MessageRequest) { r.Ref, r.Method = "call-3", processor.Method_REGISTER }
	h.send(traceRequest(), traceRequest(answering(pb.ResponseType_FORBIDDEN)), false)
	h.send(ringing, ringing, false)
	h.send(traceRequest(func(r *processor.MessageRequest) { r.Ref = "call-2" }), nil, true)
	h.send(traceRequest(register), traceRequest(register, answering(pb.ResponseType_OK)), false)

	got := [][3]any{}
	for _, r := range h.records(t) {
		got = append(got, [3]any{r["kind"], r["outcome"], r["status"]})
	}
	want := [][3]any{
		{"request", "rejected", 403.0},
		{"response", "relayed", 180.0},
		{"request", "error", nil},
		{"request", "answered", 200.0},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v", got)
	}
	if h.records(t)[2]["response"] != nil {
		t.Errorf("response: %v", h.records(t)[2]["response"])
	}
	if len(h.sessions) != 3 {
		t.Errorf("sessions: %d", len(h.sessions))
	}
}

func withDigest(r *processor.MessageRequest) {
	r.Message = traceMessage(func(m *pb.SIPMessage) {
		m.Authorization = &pb.Authorization{Username: "1001", Realm: "sip.local", Nonce: "n1", CNonce: "c1", Response: "d1g3st", Scheme: "Digest"}
		m.Extensions = append(m.Extensions, &pb.Extension{Name: "X-Gateway-Auth", Value: "secretvalue"})
	})
}

func TestRecorderRedactsBeforeWriting(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll})
	req := traceRequest(withDigest)
	h.send(req, req, false)
	line := h.writes[0].line
	if strings.Contains(line, "d1g3st") || strings.Contains(line, "secretvalue") {
		t.Errorf("a secret reached the file: %s", line)
	}
	auth := h.records(t)[0]["request"].(map[string]any)["message"].(map[string]any)["authorization"].(map[string]any)
	if auth["response"] != "REDACTED" {
		t.Errorf("authorization: %v", auth)
	}
	if req.GetMessage().GetAuthorization().GetResponse() != "d1g3st" {
		t.Error("the message on its way changed")
	}
}

func TestRecorderCapsRecordsPerCallAndForgetsIdleCalls(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll, MaxRecordsPerCall: 2, IdleTimeoutSeconds: 10})
	req := traceRequest()
	h.send(req, req, false)
	h.send(req, req, false)
	h.send(req, req, false)
	if len(h.writes) != 2 {
		t.Errorf("writes: %d", len(h.writes))
	}
	h.sweep()
	if len(h.sessions) != 1 {
		t.Errorf("a live call is kept: %d", len(h.sessions))
	}
	h.clock = h.clock.Add(11 * time.Second)
	h.sweep()
	if len(h.sessions) != 0 {
		t.Errorf("sessions: %d", len(h.sessions))
	}
}

func TestRecorderStopsStartingCallsAtMaxCalls(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll, MaxCalls: 1})
	h.send(traceRequest(), nil, false)
	h.send(traceRequest(func(r *processor.MessageRequest) { r.Ref = "call-2" }), nil, false)
	if len(h.writes) != 1 || h.refused != 1 {
		t.Errorf("writes %d, refused %d", len(h.writes), h.refused)
	}
}

func TestRecorderSurvivesAFailedWriteAndABrokenMessage(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll})
	h.append = func(string, []byte) error { return errors.New("disk full") }
	h.send(traceRequest(), nil, false)
	if h.failedWrites != 1 {
		t.Errorf("failed writes: %d", h.failedWrites)
	}
	h.append = func(string, []byte) error { panic("boom") }
	h.send(traceRequest(), nil, false)
}

func TestRecordDropsAndCountsWhenTheQueueIsFull(t *testing.T) {
	spec := &config.RecordingSpec{Enabled: true, Path: "/traces", Mode: config.RecordingModeAll}
	r, err := newRecorder(RecorderOptions{Spec: spec, Logger: quietLogger, QueueSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	d, err := New(Options{
		Logger:     quietLogger,
		Recorder:   r,
		Processors: []Binding{{Ref: "connect", Methods: []string{"INVITE"}, Client: &fakeBackend{handle: echo}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	// No writer is running: the second message finds the queue full
	for range 2 {
		if _, err := d.ProcessMessage(context.Background(), traceRequest()); err != nil {
			t.Fatalf("a full queue reached the call: %v", err)
		}
	}
	if r.Dropped() != 1 {
		t.Errorf("dropped: %d", r.Dropped())
	}
}

func TestRecorderWritesFilesAndCloseDrainsTheQueue(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "traces")
	r, err := NewRecorder(RecorderOptions{
		Ref:     "d",
		Version: "3.0.0",
		Spec:    &config.RecordingSpec{Enabled: true, Path: dir, Mode: config.RecordingModeAll},
		Logger:  quietLogger,
	})
	if err != nil {
		t.Fatal(err)
	}
	req := traceRequest()
	for range 3 {
		r.record(req, req, newHopCollector(), false)
	}
	r.Close()
	r.Close()
	// After Close nothing blocks and nothing panics
	r.record(req, req, newHopCollector(), false)

	files, err := filepath.Glob(filepath.Join(dir, "*-call-1.jsonl"))
	if err != nil || len(files) != 1 {
		t.Fatalf("files: %v %v", files, err)
	}
	data, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatal(err)
	}
	if lines := strings.Count(string(data), "\n"); lines != 3 {
		t.Errorf("lines: %d", lines)
	}
}

// versionedBackend announces a version in its headers, as @routr/processor does.
type versionedBackend struct {
	handle func(*processor.MessageRequest) (*processor.MessageResponse, error)
}

func (b versionedBackend) ProcessMessage(_ context.Context, req *processor.MessageRequest, opts ...grpc.CallOption) (*processor.MessageResponse, error) {
	for _, opt := range opts {
		if h, ok := opt.(grpc.HeaderCallOption); ok {
			*h.HeaderAddr = metadata.Pairs(versionMetadataKey, "9.9.9")
		}
	}
	return b.handle(req)
}

func pipeline(t *testing.T, h *recorderHarness, handle func(*processor.MessageRequest) (*processor.MessageResponse, error)) *Dispatcher {
	t.Helper()
	d, err := New(Options{
		Logger:     quietLogger,
		Recorder:   h.Recorder,
		Processors: []Binding{{Ref: "connect-processor", Methods: []string{"INVITE", "BYE"}, Client: versionedBackend{handle: handle}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func TestPipelineCollectsHopsWithTimingVersionsAndDiffsAndStripsTheFlag(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{})
	d := pipeline(t, h, func(req *processor.MessageRequest) (*processor.MessageResponse, error) {
		return &processor.MessageResponse{
			Metadata: map[string]string{"trace.record": "trunk-01"},
			Message: traceMessage(func(m *pb.SIPMessage) {
				m.MessageType = &pb.SIPMessage_RequestUri{RequestUri: &pb.SipURI{User: "17853178070", Host: "sip.provider.net"}}
				m.MaxForwards = &pb.MaxForwards{MaxForwards: 69}
			}),
		}, nil
	})
	res, err := d.ProcessMessage(context.Background(), traceRequest())
	if err != nil {
		t.Fatal(err)
	}
	if len(res.GetMetadata()) != 0 {
		t.Errorf("metadata: %v", res.GetMetadata())
	}
	h.drain()

	record := h.records(t)[0]
	if record["trunkRef"] != "trunk-01" {
		t.Errorf("trunkRef: %v", record["trunkRef"])
	}
	hops := record["hops"].([]any)
	if len(hops) != 2 || hops[0].(map[string]any)["component"] != "dispatcher" || hops[0].(map[string]any)["action"] != "matched" {
		t.Fatalf("hops: %v", hops)
	}
	hop := hops[1].(map[string]any)
	if hop["component"] != "connect-processor" || hop["version"] != "9.9.9" || hop["action"] != "forwarded" {
		t.Errorf("hop: %v", hop)
	}
	diff := hop["diff"].(map[string]any)
	if !reflect.DeepEqual(diff["requestUri"], map[string]any{"from": "sip:17853178070@sip.local", "to": "sip:17853178070@sip.provider.net"}) {
		t.Errorf("requestUri: %v", diff["requestUri"])
	}
	changed := diff["headers"].(map[string]any)["changed"].(map[string]any)
	if !reflect.DeepEqual(changed["Max-Forwards"], map[string]any{"from": "70", "to": "69"}) {
		t.Errorf("changed: %v", changed)
	}
	if record["totalMs"].(float64) < hop["durationMs"].(float64) {
		t.Errorf("totalMs: %v", record["totalMs"])
	}
}

func TestPipelineLiftsTraceMetadataIntoTheHop(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll})
	d := pipeline(t, h, func(req *processor.MessageRequest) (*processor.MessageResponse, error) {
		return &processor.MessageResponse{Message: req.GetMessage(), Metadata: map[string]string{
			"trace.record":    "agent-1001",
			"trace.direction": "agentToPSTN",
			"trace.trunk":     "trunk-01",
			"accountRef":      "acc-1",
		}}, nil
	})
	res, err := d.ProcessMessage(context.Background(), traceRequest(func(r *processor.MessageRequest) {
		r.Metadata = map[string]string{"trace.stale": "x", "kept": "y"}
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(res.GetMetadata(), map[string]string{"accountRef": "acc-1"}) {
		t.Errorf("metadata: %v", res.GetMetadata())
	}
	h.drain()

	record := h.records(t)[0]
	if record["trunkRef"] != "agent-1001" {
		t.Errorf("trunkRef: %v", record["trunkRef"])
	}
	hop := record["hops"].([]any)[1].(map[string]any)
	if hop["action"] != "pass-through" || !reflect.DeepEqual(hop["metadata"], map[string]any{"direction": "agentToPSTN", "trunk": "trunk-01"}) {
		t.Errorf("hop: %v", hop)
	}
	if !reflect.DeepEqual(record["response"].(map[string]any)["metadata"], map[string]any{"accountRef": "acc-1"}) {
		t.Errorf("response: %v", record["response"])
	}
	request := record["request"].(map[string]any)
	if !reflect.DeepEqual(request["metadata"], map[string]any{"kept": "y"}) {
		t.Errorf("request metadata: %v", request["metadata"])
	}
	if _, ok := request["receivedOn"]; ok {
		t.Errorf("receivedOn: %v", request["receivedOn"])
	}
}

func TestPipelineKeepsCredentialsAndEvaluatesRulesWhenConfiguredTo(t *testing.T) {
	redact := false
	window := 4
	h := newHarness(t, config.RecordingSpec{
		Mode:   config.RecordingModeAll,
		Redact: &redact,
		Lint:   &config.RecordingLint{Profiles: []string{"sip"}, Window: &window},
	})
	d := pipeline(t, h, func(req *processor.MessageRequest) (*processor.MessageResponse, error) {
		// Forwarded without decrementing Max-Forwards, the digest still on it
		return &processor.MessageResponse{Message: traceMessage(withDigestMessage, func(m *pb.SIPMessage) {
			m.Via = append([]*pb.Via{{Host: "10.0.0.1", Port: 5060, Transport: "UDP"}}, m.Via...)
		})}, nil
	})
	req := traceRequest(withDigest, func(r *processor.MessageRequest) {
		r.ListeningPoints = []*processor.NetInterface{{Host: "10.0.0.1", Port: 5060, Transport: common.Transport_UDP}}
	})
	if _, err := d.ProcessMessage(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	h.drain()

	record := h.records(t)[0]
	auth := record["request"].(map[string]any)["message"].(map[string]any)["authorization"].(map[string]any)
	if auth["response"] != "d1g3st" {
		t.Errorf("authorization: %v", auth)
	}
	lint := record["lint"].(map[string]any)
	if !reflect.DeepEqual(lint, map[string]any{"version": "3.0.0", "profiles": []any{"sip"}}) {
		t.Errorf("lint: %v", lint)
	}
	var rules []string
	for _, f := range record["findings"].([]any) {
		rules = append(rules, f.(map[string]any)["rule"].(string))
	}
	joined := strings.Join(rules, ",")
	if !strings.Contains(joined, "sip/max-forwards") || !strings.Contains(joined, "sip/credentials-stripped") {
		t.Errorf("findings: %v", rules)
	}
	if len(h.sessions["call-1"].recent) != 1 {
		t.Errorf("window: %d", len(h.sessions["call-1"].recent))
	}
}

func withDigestMessage(m *pb.SIPMessage) {
	m.Authorization = &pb.Authorization{Username: "1001", Realm: "sip.local", Response: "d1g3st"}
}

func TestLintWindowKeepsTheLastRecordsOnly(t *testing.T) {
	window := 2
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll, Lint: &config.RecordingLint{Profiles: []string{"sip"}, Window: &window}})
	req := traceRequest()
	for range 3 {
		h.send(req, req, false)
	}
	recent := h.sessions["call-1"].recent
	if len(recent) != 2 || recent[0].Seq != 2 || recent[1].Seq != 3 {
		t.Errorf("recent: %d", len(recent))
	}
}

func TestPipelineRecordsAnErrorHopWhenTheProcessorIsUnavailable(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll})
	d := pipeline(t, h, func(*processor.MessageRequest) (*processor.MessageResponse, error) {
		return nil, status.Error(codes.Unavailable, "down")
	})
	if _, err := d.ProcessMessage(context.Background(), traceRequest()); err == nil || !strings.Contains(err.Error(), "connect-processor") {
		t.Fatalf("got %v", err)
	}
	h.drain()
	record := h.records(t)[0]
	if record["outcome"] != "error" {
		t.Errorf("outcome: %v", record["outcome"])
	}
	hop := record["hops"].([]any)[1].(map[string]any)
	if hop["action"] != "error" || !strings.Contains(hop["error"].(string), "connect-processor") {
		t.Errorf("hop: %v", hop)
	}
}

func TestPipelineRecordsAnErrorHopWhenNoProcessorMatches(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll})
	d := pipeline(t, h, echo)
	if _, err := d.ProcessMessage(context.Background(), traceRequest(func(r *processor.MessageRequest) { r.Method = processor.Method_OPTIONS })); err == nil {
		t.Fatal("no processor takes OPTIONS")
	}
	h.drain()
	hop := h.records(t)[0]["hops"].([]any)[0].(map[string]any)
	if hop["component"] != "dispatcher" || hop["action"] != "error" || !strings.Contains(hop["error"].(string), "not matching processor") {
		t.Errorf("hop: %v", hop)
	}
}

func TestPipelineRecordsAMiddleware(t *testing.T) {
	h := newHarness(t, config.RecordingSpec{Mode: config.RecordingModeAll})
	d, err := New(Options{
		Logger:      quietLogger,
		Recorder:    h.Recorder,
		Processors:  []Binding{{Ref: "connect", Methods: []string{"INVITE"}, Client: &fakeBackend{handle: echo}}},
		Middlewares: []MiddlewareBinding{{Ref: "rtprelay", Client: &fakeBackend{handle: echo}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := d.ProcessMessage(context.Background(), traceRequest()); err != nil {
		t.Fatal(err)
	}
	h.drain()
	hops := h.records(t)[0]["hops"].([]any)
	if len(hops) != 3 {
		t.Fatalf("hops: %v", hops)
	}
	first := hops[0].(map[string]any)
	if first["component"] != "rtprelay" || first["kind"] != "middleware" || first["action"] != "pass-through" {
		t.Errorf("hop: %v", first)
	}
}

func TestHopWithoutAMessageIsAnError(t *testing.T) {
	e := hopEvent{component: "c", isCall: true, before: traceMessage(), metadata: map[string]string{"trace.a": "1"}}
	hop := e.hop(true)
	if hop.Action != "error" || hop.Diff != nil || hop.Metadata["a"] != "1" {
		t.Errorf("hop: %+v", hop)
	}
}
