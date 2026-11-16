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
	"github.com/fonoster/routr/internal/common/sipconv"
)

const fixtures = "../common/sipconv/testdata"

type javaFixture struct {
	DTO      json.RawMessage `json:"dto"`
	Sent     string          `json:"sent"`
	Answered string          `json:"answered"`
}

func normalize(text string) string {
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

func parse(t *testing.T, text string) sip.Message {
	t.Helper()
	msg, err := sipconv.NewParser().ParseSIP([]byte(text))
	if err != nil {
		t.Fatalf("parse: %v\n%s", err, text)
	}
	return msg
}

func load(t *testing.T, name string) (sip.Message, javaFixture) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(fixtures, "sip", name+".sip"))
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(fixtures, "java", name+".json"))
	if err != nil {
		t.Fatal(err)
	}
	var fx javaFixture
	if err := json.Unmarshal(data, &fx); err != nil {
		t.Fatal(err)
	}
	return parse(t, normalize(string(raw))), fx
}

// sameMessage compares two messages by what a processor would be given for
// them: equal SIPMessages mean equal headers, values and order of values, and
// leave out what only differs in formatting (one Via per line or comma joined).
func sameMessage(t *testing.T, got sip.Message, want string) {
	t.Helper()
	g, err := sipconv.MessageToDTO(parse(t, got.String()))
	if err != nil {
		t.Fatal(err)
	}
	w, err := sipconv.MessageToDTO(parse(t, want))
	if err != nil {
		t.Fatal(err)
	}
	if !proto.Equal(g, w) {
		t.Errorf("message differs from Java's\n got:\n%s\nwant:\n%s", got.String(), want)
	}
}

// TestForwardedMessagesMatchJava: with an identity processor, the request the
// EdgePort forwards and the response it relays carry what the Java EdgePort's
// do (fixtures from testdata/FixtureDump.java).
func TestForwardedMessagesMatchJava(t *testing.T) {
	names, _ := filepath.Glob(filepath.Join(fixtures, "sip", "*.sip"))
	for _, path := range names {
		name := strings.TrimSuffix(filepath.Base(path), ".sip")
		t.Run(name, func(t *testing.T) {
			msg, fx := load(t, name)
			dto := &pb.SIPMessage{}
			if err := protojson.Unmarshal(fx.DTO, dto); err != nil {
				t.Fatal(err)
			}
			headers := sipconv.HeadersFromDTO(dto)
			switch m := msg.(type) {
			case *sip.Request:
				out := BuildForwardedRequest(m, sipconv.RequestURIFromDTO(dto.GetRequestUri()), m.Body(), headers)
				sameMessage(t, out, fx.Sent)

				reply := &pb.SIPMessage{
					MessageType: &pb.SIPMessage_ResponseType{ResponseType: pb.ResponseType_OK},
					Contact:     dto.GetContact(),
					Extensions: []*pb.Extension{
						{Name: "X-Reply", Value: "1"},
						{Name: "Allow", Value: "INVITE"},
					},
				}
				answer := BuildAnswer(m, 200, reply, sipconv.HeadersFromDTO(reply), nil)
				sameMessage(t, answer, fx.Answered)
				if !strings.HasPrefix(answer.String(), "SIP/2.0 200 \r\n") {
					t.Errorf("an empty reason phrase is sent empty, as Java does: %q", answer.StartLine())
				}
			case *sip.Response:
				out := rebuildResponse(m, dto.GetReasonPhrase(), RelayedHeaders(m, headers), m.Body())
				sameMessage(t, out, fx.Sent)
			}
		})
	}
}

// TestRelayedResponseRepeatsListHeaders: JAIN-SIP appends the processor's list
// headers to the ones a relayed response already has, so they appear twice.
func TestRelayedResponseRepeatsListHeaders(t *testing.T) {
	msg, _ := load(t, "ok_record_route")
	res := msg.(*sip.Response)
	dto, err := sipconv.MessageToDTO(res)
	if err != nil {
		t.Fatal(err)
	}
	out := rebuildResponse(res, res.Reason, RelayedHeaders(res, sipconv.HeadersFromDTO(dto)), res.Body())
	if got := out.GetHeader("Allow").Value(); got != "INVITE,ACK,BYE,INVITE,ACK,BYE" {
		t.Errorf("Allow = %q", got)
	}
	if got := len(out.GetHeaders("X-Carrier")); got != 2 {
		t.Errorf("X-Carrier appears %d times", got)
	}
	if got := len(out.GetHeaders("Server")); got != 1 {
		t.Errorf("Server, a singleton, appears %d times", got)
	}
}
