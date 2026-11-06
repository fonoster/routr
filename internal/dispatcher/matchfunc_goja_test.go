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
	"strings"
	"sync"
	"testing"
	"time"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

func TestCompileMatchFuncLoadFailures(t *testing.T) {
	cases := []struct {
		name string
		src  string
		want string
	}{
		{"syntax error", "req => req.method ===", "does not compile"},
		{"not a function", "42", "is not a function"},
		{"not a function (object)", "({ method: 'INVITE' })", "is not a function"},
		{"throws while evaluating", "(function () { throw new Error('nope') })()", "does not evaluate"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := compileMatchFunc(c.src)
			if err == nil || !strings.Contains(err.Error(), c.want) || !strings.Contains(err.Error(), c.src) {
				t.Fatalf("compileMatchFunc(%q) = %v, want an error containing %q and the source", c.src, err, c.want)
			}
		})
	}
}

// The matchFuncs Routr 2 configs write, against the req the Node dispatcher
// passed: camelCase names, enums as strings, the oneof messageType.
func TestCompileMatchFuncEvaluatesAgainstTheNodeRequestShape(t *testing.T) {
	invite := registerRequest()
	invite.Method = processor.Method_INVITE
	invite.Metadata = map[string]string{"x-connect-token": "abc"}
	invite.EdgePortRef = "ep001"
	invite.ExternalAddrs = []string{"203.0.113.10"}
	invite.Message.To = &sipmessage.To{Address: &sipmessage.Address{Uri: &sipmessage.SipURI{User: "+15551234567", Host: "pstn.example"}}}

	ok := registerRequest()
	ok.Message = responseMessage(sipmessage.ResponseType_OK)

	noMessage := registerRequest()
	noMessage.Message = nil

	cases := []struct {
		name string
		src  string
		req  *processor.MessageRequest
		want bool
	}{
		{"method", `req => req.method === "INVITE"`, invite, true},
		{"method mismatch", `req => req.method === "REGISTER"`, invite, false},
		{"method with ==", `req => req.method == 'INVITE'`, invite, true},
		{"or", `req => req.method === "REGISTER" || req.method === "INVITE"`, invite, true},
		{"block body", `(req) => { return req.method === "INVITE" }`, invite, true},
		{"function expression", `function (req) { return req.method === "INVITE" }`, invite, true},
		{"edgePortRef", `req => req.edgePortRef === "ep001"`, invite, true},
		{"nested uri", `req => req.message.to.address.uri.user.startsWith("+1")`, invite, true},
		{"request-uri host", `req => req.message.requestUri.host === "sip.local"`, invite, true},
		{"messageType request", `req => req.message.messageType === "requestUri"`, invite, true},
		{"messageType response", `req => req.message.messageType === "responseType"`, ok, true},
		{"responseType as string", `req => req.message.responseType === "OK"`, ok, true},
		{"metadata", `req => req.metadata["x-connect-token"] === "abc"`, invite, true},
		{"defaults present", `req => Array.isArray(req.localnets) && req.localnets.length === 0`, invite, true},
		{"externalAddrs", `req => req.externalAddrs.includes("203.0.113.10")`, invite, true},
		{"listeningPoints", `req => req.listeningPoints[0].transport === "TCP" && req.listeningPoints[0].port === 5060`, invite, true},
		{"unset message is null", `req => req.message === null`, noMessage, true},
		{"truthy result", `req => req.ref`, invite, true},
		{"falsy result", `req => ""`, invite, false},
		{"undefined result", `req => undefined`, invite, false},
		{"unknown field", `req => req.nope === undefined`, invite, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			match, err := compileMatchFunc(c.src)
			if err != nil {
				t.Fatalf("compileMatchFunc: %v", err)
			}
			got, err := match(c.req)
			if err != nil {
				t.Fatalf("match: %v", err)
			}
			if got != c.want {
				t.Fatalf("%s: got %v, want %v", c.src, got, c.want)
			}
		})
	}
}

func TestCompileMatchFuncEvaluationFailures(t *testing.T) {
	cases := []struct {
		name string
		src  string
		want string
	}{
		{"throws", `req => { throw new Error("nope") }`, "matchFunc threw: Error: nope"},
		{"type error", `req => req.message.to.address.uri.user === "x"`, "matchFunc threw: TypeError"},
		{"infinite loop", `req => { while (true) {} }`, "timed out after " + matchFuncTimeout.String()},
		{"unbounded recursion", `req => { const f = () => f(); return f() }`, "matchFunc threw: RangeError"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			match, err := compileMatchFunc(c.src)
			if err != nil {
				t.Fatalf("compileMatchFunc: %v", err)
			}
			started := time.Now()
			_, err = match(registerRequest())
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("match = %v, want an error containing %q", err, c.want)
			}
			if elapsed := time.Since(started); elapsed > 20*matchFuncTimeout {
				t.Fatalf("match took %s", elapsed)
			}
			// The matcher recovers: the next evaluation runs in a clean runtime
			if _, err := match(registerRequest()); err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("second match = %v, want the same error", err)
			}
		})
	}
}

func TestCompileMatchFuncRecoversAfterATimeout(t *testing.T) {
	match, err := compileMatchFunc(`req => { if (req.method === "INVITE") { while (true) {} } return true }`)
	if err != nil {
		t.Fatalf("compileMatchFunc: %v", err)
	}
	invite := registerRequest()
	invite.Method = processor.Method_INVITE
	if _, err := match(invite); err == nil {
		t.Fatal("expected the INVITE evaluation to time out")
	}
	ok, err := match(registerRequest())
	if err != nil || !ok {
		t.Fatalf("after a timeout, match = %v, %v; want true", ok, err)
	}
}

func TestCompileMatchFuncNeverChangesTheRequest(t *testing.T) {
	match, err := compileMatchFunc(`req => { req.method = "BYE"; req.message.from.address.uri.user = "evil"; delete req.ref; return true }`)
	if err != nil {
		t.Fatalf("compileMatchFunc: %v", err)
	}
	req := registerRequest()
	before := proto.Clone(req)
	if _, err := match(req); err != nil {
		t.Fatalf("match: %v", err)
	}
	if !proto.Equal(req, before) {
		t.Fatalf("the request was changed: %v", req)
	}
}

func TestCompileMatchFuncHasNoHostAccess(t *testing.T) {
	for _, src := range []string{
		`req => typeof require === "undefined" && typeof process === "undefined"`,
		`req => typeof fetch === "undefined" && typeof setTimeout === "undefined"`,
		`req => typeof globalThis.Go === "undefined"`,
	} {
		match, err := compileMatchFunc(src)
		if err != nil {
			t.Fatalf("compileMatchFunc(%q): %v", src, err)
		}
		ok, err := match(registerRequest())
		if err != nil || !ok {
			t.Fatalf("%s: got %v, %v; want true", src, ok, err)
		}
	}
}

func TestCompileMatchFuncIsSafeForConcurrentUse(t *testing.T) {
	match, err := compileMatchFunc(`req => req.method === "INVITE"`)
	if err != nil {
		t.Fatalf("compileMatchFunc: %v", err)
	}
	invite := registerRequest()
	invite.Method = processor.Method_INVITE
	var wg sync.WaitGroup
	for i := range 64 {
		wg.Go(func() {
			req := registerRequest()
			if i%2 == 0 {
				req = invite
			}
			ok, err := match(req)
			if err != nil || ok != (i%2 == 0) {
				t.Errorf("match = %v, %v", ok, err)
			}
		})
	}
	wg.Wait()
}
