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
package sipconv

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/emiago/sipgo/sip"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// JavaFixture is what the Java EdgePort's converter made of a message in
// testdata/sip (testdata/java, written by testdata/FixtureDump.java).
type JavaFixture struct {
	DTO      json.RawMessage `json:"dto"`
	Headers  []string        `json:"headers"`
	Sent     string          `json:"sent"`
	Answered string          `json:"answered"`
}

// NormalizeFixture turns a fixture file into a SIP message: CRLF line ends and
// the Content-Length of the body, as FixtureDump.java does.
func NormalizeFixture(text string) string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	head, body, _ := strings.Cut(text, "\n\n")
	body = strings.ReplaceAll(body, "\n", "\r\n")
	var b strings.Builder
	for _, line := range strings.Split(head, "\n") {
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "content-length:") || strings.HasPrefix(lower, "l:") {
			line = line[:strings.IndexByte(line, ':')+1] + " " + strconv.Itoa(len(body))
		}
		b.WriteString(line + "\r\n")
	}
	b.WriteString("\r\n" + body)
	return b.String()
}

// LoadFixture parses testdata/sip/<name>.sip and its Java output.
func LoadFixture(t *testing.T, dir, name string) (sip.Message, JavaFixture) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(dir, "sip", name+".sip"))
	if err != nil {
		t.Fatal(err)
	}
	msg, err := NewParser().ParseSIP([]byte(NormalizeFixture(string(raw))))
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "java", name+".json"))
	if err != nil {
		t.Fatal(err)
	}
	var fx JavaFixture
	if err := json.Unmarshal(data, &fx); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return msg, fx
}

// Fixtures lists the fixture names.
func Fixtures(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := filepath.Glob(filepath.Join(dir, "sip", "*.sip"))
	if err != nil || len(entries) == 0 {
		t.Fatalf("no fixtures in %s", dir)
	}
	var names []string
	for _, e := range entries {
		names = append(names, strings.TrimSuffix(filepath.Base(e), ".sip"))
	}
	return names
}

// TestMessageToDTOMatchesJava: the SIPMessage the processor gets is the one the
// Java EdgePort gives it, field for field.
func TestMessageToDTOMatchesJava(t *testing.T) {
	for _, name := range Fixtures(t, "testdata") {
		t.Run(name, func(t *testing.T) {
			msg, fx := LoadFixture(t, "testdata", name)
			want := &pb.SIPMessage{}
			if err := protojson.Unmarshal(fx.DTO, want); err != nil {
				t.Fatal(err)
			}
			got, err := MessageToDTO(msg)
			if err != nil {
				t.Fatal(err)
			}
			if !proto.Equal(got, want) {
				gj, _ := protojson.MarshalOptions{Multiline: true}.Marshal(got)
				wj, _ := protojson.MarshalOptions{Multiline: true}.Marshal(want)
				t.Errorf("SIPMessage differs from Java's\n got: %s\nwant: %s", gj, wj)
			}
		})
	}
}

// TestHeadersFromDTOMatchJava: each header rebuilt from the SIPMessage reads
// the same as the one Java rebuilds (header parameters may be ordered
// differently: a protobuf map has no order).
func TestHeadersFromDTOMatchJava(t *testing.T) {
	for _, name := range Fixtures(t, "testdata") {
		t.Run(name, func(t *testing.T) {
			_, fx := LoadFixture(t, "testdata", name)
			dto := &pb.SIPMessage{}
			if err := protojson.Unmarshal(fx.DTO, dto); err != nil {
				t.Fatal(err)
			}
			got := HeadersFromDTO(dto)
			// createHeadersFromMessage walks the Vias and Record-Routes backwards
			// (each one is then put on top); HeadersFromDTO lists them in order
			fx.Headers = reverseRuns(fx.Headers, "Via:")
			fx.Headers = reverseRuns(fx.Headers, "Record-Route:")
			if len(got) != len(fx.Headers) {
				var lines []string
				for _, h := range got {
					lines = append(lines, h.String())
				}
				t.Fatalf("got %d headers, Java %d\n got: %s\nwant: %s", len(got), len(fx.Headers),
					strings.Join(lines, "\n"), strings.Join(fx.Headers, "\n"))
			}
			for i, h := range got {
				if !SameHeaderLine(h.String(), fx.Headers[i]) {
					t.Errorf("header %d\n got: %s\nwant: %s", i, h.String(), fx.Headers[i])
				}
			}
		})
	}
}

// SameHeaderLine compares two header lines, ignoring case in the name and the
// order of ;-separated parameters outside angle brackets.
func SameHeaderLine(a, b string) bool {
	norm := func(s string) string {
		name, value, _ := strings.Cut(strings.TrimSpace(s), ":")
		value = strings.TrimSpace(value)
		// WWW-Authenticate and Authorization: compare the comma-separated set
		if c := CanonicalName(name); c == "WWW-Authenticate" || c == "Authorization" ||
			c == "Proxy-Authenticate" || c == "Proxy-Authorization" {
			scheme, rest, _ := strings.Cut(value, " ")
			parts := SplitTopLevel(rest, ',')
			sortStrings(parts)
			return strings.ToLower(CanonicalName(name)) + ":" + scheme + " " + strings.Join(parts, ",")
		}
		closeIdx := strings.LastIndexByte(value, '>')
		head, tail := value, ""
		if closeIdx >= 0 {
			head, tail = value[:closeIdx+1], value[closeIdx+1:]
		} else if i := strings.IndexByte(value, ';'); i >= 0 && CanonicalName(name) != "CSeq" {
			head, tail = value[:i], value[i:]
		}
		params := SplitTopLevel(tail, ';')
		for i, p := range params {
			// JAIN-SIP writes a flag parameter it was given as "name=" (not valid
			// grammar); the Go EdgePort writes "name"
			params[i] = strings.TrimSuffix(p, "=")
		}
		sortStrings(params)
		return strings.ToLower(CanonicalName(name)) + ":" + head + ";" + strings.Join(params, ";")
	}
	return norm(a) == norm(b)
}

// reverseRuns reverses the order of the lines that start with prefix, in the
// positions they hold.
func reverseRuns(lines []string, prefix string) []string {
	var idx []int
	for i, l := range lines {
		if strings.HasPrefix(l, prefix) {
			idx = append(idx, i)
		}
	}
	out := append([]string(nil), lines...)
	for i, j := range idx {
		out[j] = lines[idx[len(idx)-1-i]]
	}
	return out
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
