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

package trace

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"sort"
	"testing"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The Dispatcher only writes; rctl reads. Decoding exists for the tests, to
// read the recordings Routr 2 wrote.

var lenient = protojson.UnmarshalOptions{DiscardUnknown: true}

type jsonChange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type jsonRecord struct {
	RecordedAt string    `json:"recordedAt"`
	CallID     string    `json:"callId"`
	Seq        int       `json:"seq"`
	TOffsetMs  float64   `json:"tOffsetMs"`
	Kind       Kind      `json:"kind"`
	Method     string    `json:"method"`
	Status     int       `json:"status"`
	EdgePort   jsonComp  `json:"edgePort"`
	Dispatcher jsonComp  `json:"dispatcher"`
	TrunkRef   string    `json:"trunkRef"`
	Request    jsonRaw   `json:"request"`
	Hops       []jsonHop `json:"hops"`
	Response   *struct {
		Message  jsonRaw           `json:"message"`
		Metadata map[string]string `json:"metadata"`
	} `json:"response"`
	Outcome Outcome `json:"outcome"`
	TotalMs float64 `json:"totalMs"`
	Lint    *struct {
		Version  string    `json:"version"`
		Profiles []Profile `json:"profiles"`
	} `json:"lint"`
	Findings []struct {
		Rule     string   `json:"rule"`
		Profile  Profile  `json:"profile"`
		Severity Severity `json:"severity"`
		Spec     string   `json:"spec"`
		Message  string   `json:"message"`
		Side     Side     `json:"side"`
		Header   string   `json:"header"`
	} `json:"findings"`
}

type (
	jsonRaw  = json.RawMessage
	jsonComp struct {
		Ref     string `json:"ref"`
		Version string `json:"version"`
	}
	jsonHop struct {
		Component  string    `json:"component"`
		Kind       HopKind   `json:"kind"`
		Version    string    `json:"version"`
		DurationMs float64   `json:"durationMs"`
		Action     HopAction `json:"action"`
		Diff       *struct {
			RequestURI *jsonChange `json:"requestUri"`
			Headers    struct {
				Added   map[string]string     `json:"added"`
				Removed map[string]string     `json:"removed"`
				Changed map[string]jsonChange `json:"changed"`
			} `json:"headers"`
		} `json:"diff"`
		Error    string            `json:"error"`
		Metadata map[string]string `json:"metadata"`
	}
)

func headerValuesOf(m map[string]string) []HeaderValue {
	var out []HeaderValue
	for _, k := range sortedStrings(m) {
		out = append(out, HeaderValue{Name: k, Value: m[k]})
	}
	return out
}

func decodeRecord(line []byte) (*Record, error) {
	var j jsonRecord
	if err := json.Unmarshal(line, &j); err != nil {
		return nil, err
	}
	r := &Record{
		RecordedAt: j.RecordedAt,
		CallID:     j.CallID,
		Seq:        j.Seq,
		TOffsetMs:  j.TOffsetMs,
		Kind:       j.Kind,
		Method:     j.Method,
		Status:     j.Status,
		EdgePort:   Component(j.EdgePort),
		Dispatcher: Component(j.Dispatcher),
		TrunkRef:   j.TrunkRef,
		Request:    &processor.MessageRequest{},
		Outcome:    j.Outcome,
		TotalMs:    j.TotalMs,
	}
	if err := lenient.Unmarshal(j.Request, r.Request); err != nil {
		return nil, err
	}
	if j.Response != nil {
		r.Response = &Response{Message: &pb.SIPMessage{}, Metadata: j.Response.Metadata}
		if err := lenient.Unmarshal(j.Response.Message, r.Response.Message); err != nil {
			return nil, err
		}
	}
	for _, h := range j.Hops {
		hop := Hop{Component: h.Component, Kind: h.Kind, Version: h.Version, DurationMs: h.DurationMs, Action: h.Action, Error: h.Error, Metadata: h.Metadata}
		if h.Diff != nil {
			hop.Diff = &Diff{Added: headerValuesOf(h.Diff.Headers.Added), Removed: headerValuesOf(h.Diff.Headers.Removed)}
			if c := h.Diff.RequestURI; c != nil {
				hop.Diff.RequestURI = &HeaderChange{From: c.From, To: c.To}
			}
			names := make([]string, 0, len(h.Diff.Headers.Changed))
			for name := range h.Diff.Headers.Changed {
				names = append(names, name)
			}
			sort.Strings(names)
			for _, name := range names {
				c := h.Diff.Headers.Changed[name]
				hop.Diff.Changed = append(hop.Diff.Changed, ChangedHeader{Name: name, HeaderChange: HeaderChange{From: c.From, To: c.To}})
			}
		}
		r.Hops = append(r.Hops, hop)
	}
	if j.Lint != nil {
		r.Lint = &Lint{Version: j.Lint.Version, Profiles: j.Lint.Profiles}
	}
	for _, f := range j.Findings {
		r.Findings = append(r.Findings, Finding(f))
	}
	return r, nil
}

// readLines returns the non-blank lines of a trace file.
func readLines(t *testing.T, path string) [][]byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var lines [][]byte
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(nil, 16<<20)
	for scanner.Scan() {
		if len(bytes.TrimSpace(scanner.Bytes())) > 0 {
			lines = append(lines, bytes.Clone(scanner.Bytes()))
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
	return lines
}

func readRecords(t *testing.T, path string) []*Record {
	t.Helper()
	var records []*Record
	for i, line := range readLines(t, path) {
		r, err := decodeRecord(line)
		if err != nil {
			t.Fatalf("%s line %d: %v", path, i+1, err)
		}
		records = append(records, r)
	}
	return records
}

// cloneRecord is a deep copy of what the rules read.
func cloneRecord(r *Record) *Record {
	c := *r
	c.Request = proto.Clone(r.Request).(*processor.MessageRequest)
	if r.Response != nil {
		c.Response = &Response{Message: proto.Clone(r.Response.Message).(*pb.SIPMessage), Metadata: r.Response.Metadata}
	}
	c.Hops = append([]Hop(nil), r.Hops...)
	return &c
}
