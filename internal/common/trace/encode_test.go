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
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"

	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

const emptyURI = `{"user":"","userPassword":"","host":"sip.local","transportParam":"","mAddrParam":"","methodParam":"","userParam":"","ttlParam":0,"port":0,"lrParam":false,"bncParam":false,"secure":false}`

const emptyHeaders = `"extensions":[],"via":[],"route":[],"recordRoute":[],"from":null,"to":null,"contact":null,"callId":null,"contentLength":null,"expires":null,"wwwAuthenticate":null,"maxForwards":null,"authorization":null,"reasonPhrase":"","body":""`

func encodedRecord() *Record {
	return &Record{
		RecordedAt: "2026-10-23T02:41:10.321Z",
		CallID:     "c1",
		Seq:        1,
		Kind:       KindRequest,
		Method:     "INVITE",
		Status:     403,
		EdgePort:   Component{Ref: "ep", Version: "3.0.0"},
		Dispatcher: Component{Ref: "d", Version: "3.0.0"},
		TrunkRef:   "trunk-01",
		Request: &processor.MessageRequest{
			Ref:         "c1",
			EdgePortRef: "ep",
			Method:      processor.Method_INVITE,
			Sender:      &processor.NetInterface{Host: "10.0.0.2", Port: 5060, Transport: common.Transport_UDP},
			Message:     &pb.SIPMessage{MessageType: &pb.SIPMessage_RequestUri{RequestUri: &pb.SipURI{Host: "sip.local"}}},
		},
		Hops: []Hop{
			{Component: "dispatcher", Kind: HopDispatcher, Action: ActionMatched},
			{
				Component: "connect", Kind: HopProcessor, Version: "9.9.9", DurationMs: 2.1, Action: ActionResponded,
				Diff: &Diff{
					RequestURI: &HeaderChange{From: "a", To: "b"},
					Added:      []HeaderValue{{Name: "Z", Value: "1"}, {Name: "A", Value: "2"}},
					Removed:    []HeaderValue{{Name: "Via", Value: "x"}},
					Changed:    []ChangedHeader{{Name: "Max-Forwards", HeaderChange: HeaderChange{From: "70", To: "69"}}},
				},
				Metadata: map[string]string{"direction": "in"},
			},
			{Component: "rtprelay", Kind: HopMiddleware, DurationMs: 0.1, Action: ActionError, Error: "down"},
		},
		Response: &Response{
			Message:  &pb.SIPMessage{MessageType: &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_FORBIDDEN}},
			Metadata: map[string]string{"accountRef": "a"},
		},
		Outcome: OutcomeRejected,
		TotalMs: 15.9,
		Lint:    &Lint{Version: "3.0.0", Profiles: []Profile{ProfileSIP}},
		Findings: []Finding{
			{Rule: "sip/via", Profile: ProfileSIP, Severity: SeverityError, Spec: "RFC", Message: "m", Side: SideOut, Header: "Via"},
			{Rule: "sip/ack-2xx", Profile: ProfileSIP, Severity: SeverityWarning, Spec: "RFC", Message: "n", Side: SideCall},
		},
	}
}

func encodedRequest(messageLast bool) string {
	head := `{"listeningPoints":[],"externalAddrs":[],"localnets":[],"aliases":[],"ref":"c1","edgePortRef":"ep","method":"INVITE","sender":{"host":"10.0.0.2","port":5060,"transport":"UDP"},`
	message := `"message":{` + emptyHeaders + `,"requestUri":` + emptyURI + `,"messageType":"requestUri"}`
	if messageLast {
		return head + `"edgePortVersion":"","metadata":{},` + message + `}`
	}
	return head + message + `,"edgePortVersion":"","metadata":{}}`
}

func TestAppendRecordWritesWhatTheNodeRecorderWrote(t *testing.T) {
	want := `{"traceVersion":1,"recordedAt":"2026-10-23T02:41:10.321Z","callId":"c1","seq":1,"tOffsetMs":0,"kind":"request","method":"INVITE","status":403,` +
		`"edgePort":{"ref":"ep","version":"3.0.0"},"dispatcher":{"ref":"d","version":"3.0.0"},"trunkRef":"trunk-01",` +
		`"request":` + encodedRequest(false) + `,` +
		`"hops":[{"component":"dispatcher","kind":"dispatcher","durationMs":0,"action":"matched"},` +
		`{"component":"connect","kind":"processor","version":"9.9.9","durationMs":2.1,"action":"responded","diff":{"headers":{"added":{"Z":"1","A":"2"},"removed":{"Via":"x"},"changed":{"Max-Forwards":{"from":"70","to":"69"}}},"requestUri":{"from":"a","to":"b"}},"metadata":{"direction":"in"}},` +
		`{"component":"rtprelay","kind":"middleware","durationMs":0.1,"action":"error","error":"down"}],` +
		`"response":{"message":{` + emptyHeaders + `,"responseType":"FORBIDDEN","messageType":"responseType"},"metadata":{"accountRef":"a"}},` +
		`"outcome":"rejected","totalMs":15.9,"lint":{"version":"3.0.0","profiles":["sip"]},` +
		`"findings":[{"rule":"sip/via","profile":"sip","severity":"error","spec":"RFC","message":"m","side":"out","header":"Via"},{"rule":"sip/ack-2xx","profile":"sip","severity":"warning","spec":"RFC","message":"n","side":"call"}]}`
	if got := string(NewEncoder().AppendRecord(nil, encodedRecord())); got != want {
		t.Errorf("got\n%s\nwant\n%s", got, want)
	}
}

func TestAppendRecordPutsTheMessageLastWhenRedacted(t *testing.T) {
	r := encodedRecord()
	r.MessageLast = true
	var doc struct {
		Request json.RawMessage `json:"request"`
	}
	if err := json.Unmarshal(NewEncoder().AppendRecord(nil, r), &doc); err != nil {
		t.Fatal(err)
	}
	if got, want := string(doc.Request), encodedRequest(true); got != want {
		t.Errorf("got\n%s\nwant\n%s", got, want)
	}
}

func TestAppendRecordOmitsWhatTheNodeRecorderOmitted(t *testing.T) {
	r := encodedRecord()
	r.Status, r.TrunkRef, r.Lint, r.Findings, r.Response = 0, "", nil, nil, nil
	r.Hops = nil
	r.EdgePort.Version = ""
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(NewEncoder().AppendRecord(nil, r), &doc); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"status", "trunkRef", "lint", "findings"} {
		if _, ok := doc[key]; ok {
			t.Errorf("%s should be absent", key)
		}
	}
	if string(doc["response"]) != "null" || string(doc["hops"]) != "[]" || string(doc["edgePort"]) != `{"ref":"ep"}` {
		t.Errorf("doc: %s %s %s", doc["response"], doc["hops"], doc["edgePort"])
	}
}

func TestAppendRecordEmptyFindingsAreWrittenWhenLinted(t *testing.T) {
	r := encodedRecord()
	r.Findings = []Finding{}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(NewEncoder().AppendRecord(nil, r), &doc); err != nil {
		t.Fatal(err)
	}
	if string(doc["findings"]) != "[]" {
		t.Errorf("findings: %s", doc["findings"])
	}
}

func TestAppendMessageWritesReceivedOnAndMapsInOrder(t *testing.T) {
	r := encodedRecord()
	r.Request.ReceivedOn = &processor.NetInterface{Host: "10.0.0.1", Port: 5060}
	r.Request.Metadata = map[string]string{"b": "2", "a": "1"}
	var doc struct {
		Request json.RawMessage `json:"request"`
	}
	if err := json.Unmarshal(NewEncoder().AppendRecord(nil, r), &doc); err != nil {
		t.Fatal(err)
	}
	want := `"edgePortVersion":"","receivedOn":{"host":"10.0.0.1","port":5060,"transport":"UDP"},"metadata":{"a":"1","b":"2"}}`
	if got := string(doc.Request); len(got) < len(want) || got[len(got)-len(want):] != want {
		t.Errorf("got %s", got)
	}
}

func TestAppendStringEscapesAsJSONStringify(t *testing.T) {
	cases := map[string]string{
		"plain":            `"plain"`,
		"a\"b\\c":          `"a\"b\\c"`,
		"\r\n\t\b\f":       `"\r\n\t\b\f"`,
		"\x01\x1f":         `"\u0001\u001f"`,
		"<sip:a&b>ñ\u2028": "\"<sip:a&b>ñ\u2028\"",
		"bad\xff":          "\"bad\uFFFD\"",
	}
	for in, want := range cases {
		if got := string(appendString(nil, in)); got != want {
			t.Errorf("%q: got %s, want %s", in, got, want)
		}
	}
}

func TestLowerCamel(t *testing.T) {
	if got := lowerCamel("message_type"); got != "messageType" {
		t.Errorf("got %s", got)
	}
}

// isEmptyJSON tells a value a key can hold when the recording predates the key.
func isEmptyJSON(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return x == ""
	case bool:
		return !x
	case float64:
		return x == 0
	case []any:
		return len(x) == 0
	case map[string]any:
		return len(x) == 0
	}
	return false
}

// sameJSON checks that got says everything the recording says. A key the
// recording doesn't have may only hold an empty value: a field the proto
// gained since (aliases).
func sameJSON(path string, recorded, got any) error {
	switch r := recorded.(type) {
	case map[string]any:
		g, ok := got.(map[string]any)
		if !ok {
			return fmt.Errorf("%s: got %v", path, got)
		}
		for k, v := range r {
			other, present := g[k]
			if !present {
				return fmt.Errorf("%s.%s: missing", path, k)
			}
			if err := sameJSON(path+"."+k, v, other); err != nil {
				return err
			}
		}
		for k, v := range g {
			if _, present := r[k]; !present && !isEmptyJSON(v) {
				return fmt.Errorf("%s.%s: not in the recording: %v", path, k, v)
			}
		}
	case []any:
		g, ok := got.([]any)
		if !ok || len(g) != len(r) {
			return fmt.Errorf("%s: got %v", path, got)
		}
		for i := range r {
			if err := sameJSON(fmt.Sprintf("%s[%d]", path, i), r[i], g[i]); err != nil {
				return err
			}
		}
	default:
		if !reflect.DeepEqual(recorded, got) {
			return fmt.Errorf("%s: recorded %v, got %v", path, recorded, got)
		}
	}
	return nil
}

func recordingFiles(t *testing.T) []string {
	t.Helper()
	var files []string
	for _, pattern := range []string{"../../../etc/corpus/*.jsonl", "../../../interop/*/*.jsonl"} {
		found, err := filepath.Glob(pattern)
		if err != nil {
			t.Fatal(err)
		}
		files = append(files, found...)
	}
	if len(files) == 0 {
		t.Fatal("no recordings found")
	}
	return files
}

// Every recording of the corpus, read and written again, says what Routr 2
// wrote: the proof the files stay what rctl trace reads.
func TestEncoderReproducesTheCorpus(t *testing.T) {
	encoder := NewEncoder()
	for _, file := range recordingFiles(t) {
		t.Run(filepath.Base(file), func(t *testing.T) {
			for i, line := range readLines(t, file) {
				record, err := decodeRecord(line)
				if err != nil {
					t.Fatalf("line %d: %v", i+1, err)
				}
				var recorded, got any
				if err := json.Unmarshal(line, &recorded); err != nil {
					t.Fatal(err)
				}
				if err := json.Unmarshal(encoder.AppendRecord(nil, record), &got); err != nil {
					t.Fatal(err)
				}
				if err := sameJSON("$", recorded, got); err != nil {
					t.Errorf("line %d: %v", i+1, err)
				}
			}
		})
	}
}

// canonicalParams sorts what follows each semicolon: Node rendered a proto map in
// the order it came off the wire, Go in key order, and neither order means anything.
func canonicalParams(value string) string {
	parts := strings.Split(value, ";")
	sort.Strings(parts)
	return strings.Join(parts, ";")
}

func canonicalDiff(d *Diff) *Diff {
	c := &Diff{RequestURI: d.RequestURI}
	for _, h := range d.Added {
		c.Added = append(c.Added, HeaderValue{Name: h.Name, Value: canonicalParams(h.Value)})
	}
	for _, h := range d.Removed {
		c.Removed = append(c.Removed, HeaderValue{Name: h.Name, Value: canonicalParams(h.Value)})
	}
	for _, h := range d.Changed {
		c.Changed = append(c.Changed, ChangedHeader{Name: h.Name, HeaderChange: HeaderChange{From: canonicalParams(h.From), To: canonicalParams(h.To)}})
	}
	return c
}

// The hop diffs of a recording are what DiffMessages makes of its messages,
// where the request and the outgoing message are the two sides of one hop.
func TestDiffMessagesReproducesTheCorpus(t *testing.T) {
	for _, file := range recordingFiles(t) {
		for _, record := range readRecords(t, file) {
			var calls []*Hop
			for i := range record.Hops {
				if record.Hops[i].Diff != nil {
					calls = append(calls, &record.Hops[i])
				}
			}
			if len(calls) != 1 || record.Response == nil {
				continue
			}
			got, want := DiffMessages(record.Request.GetMessage(), record.Response.Message), calls[0].Diff
			sort.Slice(got.Added, func(i, j int) bool { return got.Added[i].Name < got.Added[j].Name })
			sort.Slice(got.Removed, func(i, j int) bool { return got.Removed[i].Name < got.Removed[j].Name })
			sort.Slice(got.Changed, func(i, j int) bool { return got.Changed[i].Name < got.Changed[j].Name })
			if !reflect.DeepEqual(canonicalDiff(got), canonicalDiff(want)) {
				t.Errorf("%s seq %d:\ngot  %+v\nwant %+v", filepath.Base(file), record.Seq, got, want)
			}
		}
	}
}

// The rules find on the corpus what its manifests declare, as rctl trace
// compat --sip-connect does.
func TestRulesFindWhatTheManifestsDeclare(t *testing.T) {
	manifests := []string{"../../../etc/corpus/manifest.yaml"}
	partners, err := filepath.Glob("../../../interop/*/manifest.yaml")
	if err != nil {
		t.Fatal(err)
	}
	profiles := []Profile{ProfileSIP, ProfileSIPConnect}
	for _, path := range append(manifests, partners...) {
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var manifest struct {
			Files []struct {
				File     string   `yaml:"file"`
				Findings []string `yaml:"findings"`
			} `yaml:"files"`
		}
		if err := yaml.Unmarshal(data, &manifest); err != nil {
			t.Fatal(err)
		}
		for _, entry := range manifest.Files {
			t.Run(entry.File, func(t *testing.T) {
				records := readRecords(t, filepath.Join(filepath.Dir(path), entry.File))
				fired := map[string]bool{}
				for i, r := range records {
					for _, f := range Evaluate(r, records[:i], profiles) {
						fired[f.Rule] = true
					}
				}
				got := make([]string, 0, len(fired))
				for rule := range fired {
					got = append(got, rule)
				}
				sort.Strings(got)
				want := append([]string{}, entry.Findings...)
				sort.Strings(want)
				if !reflect.DeepEqual(got, want) {
					t.Errorf("fired %v, declared %v", got, want)
				}
			})
		}
	}
}
