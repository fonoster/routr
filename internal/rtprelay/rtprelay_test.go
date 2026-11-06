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

package rtprelay

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/common"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

const offeredSDP = "v=0\r\nm=audio 4000 RTP/AVP 0\r\n"
const relayedSDP = "v=0\r\nm=audio 10000 RTP/AVP 0\r\n"

// fakeEngine answers from what the test sets and records every command.
type fakeEngine struct {
	query    Result
	queryErr error
	result   Result
	err      error
	commands []string
	last     Params
}

func newFakeEngine() *fakeEngine {
	return &fakeEngine{query: Result{Result: "ok"}, result: Result{Result: "ok", SDP: relayedSDP}}
}

func (f *fakeEngine) Query(_ context.Context, params Params) (Result, error) {
	f.commands = append(f.commands, "query")
	return f.query, f.queryErr
}

func (f *fakeEngine) Offer(_ context.Context, params Params) (Result, error) {
	return f.record("offer", params)
}

func (f *fakeEngine) Answer(_ context.Context, params Params) (Result, error) {
	return f.record("answer", params)
}

func (f *fakeEngine) Delete(_ context.Context, params Params) (Result, error) {
	return f.record("delete", params)
}

func (f *fakeEngine) record(command string, params Params) (Result, error) {
	f.commands = append(f.commands, command)
	f.last = params
	return f.result, f.err
}

func newRelay(t *testing.T, engine Engine) *RTPRelay {
	t.Helper()
	relay, err := New(engine, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	return relay
}

func message(body string) *sipmessage.SIPMessage {
	return &sipmessage.SIPMessage{
		From:   &sipmessage.From{Tag: "caller"},
		To:     &sipmessage.To{Tag: "callee"},
		CallId: &sipmessage.CallID{CallId: "call-1"},
		Via:    []*sipmessage.Via{{Host: "10.0.0.1", Port: 5060, Transport: "UDP"}},
		Body:   body,
	}
}

func request(method processor.Method, body string) *processor.MessageRequest {
	msg := message(body)
	msg.MessageType = &sipmessage.SIPMessage_RequestUri{RequestUri: &sipmessage.SipURI{Host: "sip.local"}}
	return &processor.MessageRequest{
		Ref:      "call-1",
		Method:   method,
		Sender:   &processor.NetInterface{Host: "10.0.0.2", Port: 5060, Transport: common.Transport_UDP},
		Message:  msg,
		Metadata: map[string]string{"k": "v"},
	}
}

func response(code sipmessage.ResponseType, body string) *processor.MessageRequest {
	req := request(processor.Method_INVITE, body)
	req.Message.MessageType = &sipmessage.SIPMessage_ResponseType{ResponseType: code}
	return req
}

func isInternalServerError(res *processor.MessageResponse) bool {
	return res.GetMessage().GetResponseType() == sipmessage.ResponseType_SERVER_INTERNAL_ERROR &&
		res.GetMessage().GetReasonPhrase() == "Internal Server Error"
}

func TestNewRequiresAnEngine(t *testing.T) {
	if _, err := New(nil, nil, nil); err == nil {
		t.Fatal("no engine must fail")
	}
}

func TestMessagesItDoesNotHandlePassThroughWithoutACommand(t *testing.T) {
	for name, req := range map[string]*processor.MessageRequest{
		"register":        request(processor.Method_REGISTER, ""),
		"invite, no sdp":  request(processor.Method_INVITE, ""),
		"ack, no sdp":     request(processor.Method_ACK, ""),
		"refer":           request(processor.Method_REFER, ""),
		"ok, no sdp":      response(sipmessage.ResponseType_OK, ""),
		"183 with sdp":    response(sipmessage.ResponseType_SESSION_PROGRESS, offeredSDP),
		"notify with sdp": request(processor.Method_NOTIFY, offeredSDP),
	} {
		t.Run(name, func(t *testing.T) {
			engine := newFakeEngine()
			res, err := newRelay(t, engine).ProcessMessage(context.Background(), req)
			if err != nil {
				t.Fatal(err)
			}
			if len(engine.commands) != 0 {
				t.Errorf("commands: %v", engine.commands)
			}
			if res.GetMessage() != req.GetMessage() || res.GetSender() != req.GetSender() {
				t.Errorf("not passed through: %v", res)
			}
		})
	}
}

func TestCommandForEachMessage(t *testing.T) {
	cases := map[string]struct {
		req      *processor.MessageRequest
		newCall  bool
		command  string
		fromTag  string
		toTag    any
		wantBody string
	}{
		"invite is an offer":                {request(processor.Method_INVITE, offeredSDP), true, "offer", "caller", nil, relayedSDP},
		"re-invite is an offer":             {request(processor.Method_INVITE, offeredSDP), false, "offer", "caller", nil, relayedSDP},
		"ack with sdp answers, inverted":    {request(processor.Method_ACK, offeredSDP), false, "answer", "callee", "caller", relayedSDP},
		"ok on a known call answers":        {response(sipmessage.ResponseType_OK, offeredSDP), false, "answer", "caller", "callee", relayedSDP},
		"ringing with sdp on a known call":  {response(sipmessage.ResponseType_RINGING, offeredSDP), false, "answer", "caller", "callee", relayedSDP},
		"ok on a new call offers, inverted": {response(sipmessage.ResponseType_OK, offeredSDP), true, "offer", "callee", nil, relayedSDP},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			engine := newFakeEngine()
			if c.newCall {
				engine.query = Result{Result: "error", ErrorReason: "Unknown call-id"}
			}
			res, err := newRelay(t, engine).ProcessMessage(context.Background(), c.req)
			if err != nil {
				t.Fatal(err)
			}
			if want := []string{"query", c.command}; !reflect.DeepEqual(engine.commands, want) {
				t.Fatalf("commands = %v, want %v", engine.commands, want)
			}
			if engine.last["from-tag"] != c.fromTag || engine.last["to-tag"] != c.toTag {
				t.Errorf("tags = %v, %v", engine.last["from-tag"], engine.last["to-tag"])
			}
			if engine.last["sdp"] != offeredSDP || engine.last["call-id"] != "call-1" {
				t.Errorf("params: %v", engine.last)
			}
			if res.GetMessage().GetBody() != c.wantBody {
				t.Errorf("body = %q", res.GetMessage().GetBody())
			}
			if !reflect.DeepEqual(res.GetMetadata(), c.req.GetMetadata()) {
				t.Errorf("metadata: %v", res.GetMetadata())
			}
		})
	}
}

func TestByeDeletesTheCall(t *testing.T) {
	engine := newFakeEngine()
	engine.result = Result{Result: "ok"}
	req := request(processor.Method_BYE, "")
	res, err := newRelay(t, engine).ProcessMessage(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"query", "delete"}; !reflect.DeepEqual(engine.commands, want) {
		t.Fatalf("commands = %v", engine.commands)
	}
	if want := (Params{"call-id": "call-1", "from-tag": "caller"}); !reflect.DeepEqual(engine.last, want) {
		t.Errorf("params = %v", engine.last)
	}
	if res.GetMessage().GetBody() != "" || isInternalServerError(res) {
		t.Errorf("response: %v", res)
	}
}

func TestRingingFromABrowserToAPhoneLosesItsBody(t *testing.T) {
	engine := newFakeEngine()
	req := response(sipmessage.ResponseType_RINGING, offeredSDP)
	req.Sender.Transport = common.Transport_WSS
	res, err := newRelay(t, engine).ProcessMessage(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"query"}; !reflect.DeepEqual(engine.commands, want) {
		t.Errorf("commands = %v", engine.commands)
	}
	if res.GetMessage().GetBody() != "" {
		t.Errorf("body = %q", res.GetMessage().GetBody())
	}
}

func TestSendsTheProfileOfTheLegAndItsOwnKeysWin(t *testing.T) {
	engine := newFakeEngine()
	relay, err := New(engine, Profiles{
		"phone-to-secure-phone": {"transport-protocol": "RTP/SAVP", "sdp": "from the profile"},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	req := request(processor.Method_INVITE, offeredSDP)
	req.Message.Via[0].Transport = "TLS"
	if _, err := relay.ProcessMessage(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	if engine.last["transport-protocol"] != "RTP/SAVP" || engine.last["sdp"] != offeredSDP {
		t.Errorf("params = %v", engine.last)
	}
}

func TestFailuresBecomeA500(t *testing.T) {
	noVia := request(processor.Method_INVITE, offeredSDP)
	noVia.Message.Via = nil
	cases := map[string]struct {
		req   *processor.MessageRequest
		setUp func(*fakeEngine)
	}{
		"no message": {&processor.MessageRequest{}, func(*fakeEngine) {}},
		"no via":     {noVia, func(*fakeEngine) {}},
		"query times out": {request(processor.Method_INVITE, offeredSDP), func(f *fakeEngine) {
			f.queryErr = errors.New("rtpengine timeout")
		}},
		"offer times out": {request(processor.Method_INVITE, offeredSDP), func(f *fakeEngine) {
			f.err = errors.New("rtpengine timeout")
		}},
		"offer refused": {request(processor.Method_INVITE, offeredSDP), func(f *fakeEngine) {
			f.result = Result{Result: "error", ErrorReason: "Invalid dialogue association"}
		}},
		"delete refused": {request(processor.Method_BYE, ""), func(f *fakeEngine) {
			f.result = Result{Result: "error", ErrorReason: "Unknown call-id"}
		}},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			engine := newFakeEngine()
			c.setUp(engine)
			res, err := newRelay(t, engine).ProcessMessage(context.Background(), c.req)
			if err != nil {
				t.Fatalf("a failure is a SIP answer, not a gRPC error: %v", err)
			}
			if !isInternalServerError(res) {
				t.Errorf("response: %v", res)
			}
		})
	}
}

func TestNeverChangesTheMessageItReceived(t *testing.T) {
	for name, req := range map[string]*processor.MessageRequest{
		"invite":  request(processor.Method_INVITE, offeredSDP),
		"bye":     request(processor.Method_BYE, "a body"),
		"ringing": response(sipmessage.ResponseType_RINGING, offeredSDP),
	} {
		t.Run(name, func(t *testing.T) {
			before := proto.Clone(req)
			if _, err := newRelay(t, newFakeEngine()).ProcessMessage(context.Background(), req); err != nil {
				t.Fatal(err)
			}
			if !proto.Equal(before, req) {
				t.Errorf("request changed: %v", req)
			}
		})
	}
}
