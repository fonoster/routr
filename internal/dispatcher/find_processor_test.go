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
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/fonoster/routr/internal/common/config"
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// compiled builds a compiledProcessor whose matchFunc is the Go function
// given: the Node tests' configs, with their matchFuncs written in Go.
func compiled(ref string, methods []string, match matchFunc) *compiledProcessor {
	return &compiledProcessor{ref: ref, methods: methodSet(methods), match: match}
}

func isMethod(m processor.Method) matchFunc {
	return func(req *processor.MessageRequest) (bool, error) { return req.GetMethod() == m, nil }
}

func withMethod(m processor.Method) *processor.MessageRequest {
	req := registerRequest()
	req.Method = m
	return req
}

// "checks if method of the request is enabled"
func TestHasMethod(t *testing.T) {
	p := compiled("processor-ref1", []string{"REGISTER"}, alwaysMatch)
	if !p.hasMethod(withMethod(processor.Method_REGISTER)) {
		t.Fatal("REGISTER should be enabled")
	}
	if p.hasMethod(withMethod(processor.Method_MESSAGE)) {
		t.Fatal("MESSAGE should not be enabled")
	}
}

func TestFindProcessor(t *testing.T) {
	ref1 := compiled("processor-ref1", []string{"REGISTER"}, isMethod(processor.Method_REGISTER))
	ref2 := compiled("processor-ref2", []string{"REGISTER", "INVITE"}, func(req *processor.MessageRequest) (bool, error) {
		return req.GetMethod() == processor.Method_REGISTER || req.GetMethod() == processor.Method_INVITE, nil
	})
	ref3 := compiled("processor-ref3", []string{"REGISTER", "INVITE", "MESSAGE"}, alwaysMatch)
	// Methods match but the matchFunc says no: the next processor is tried
	picky := compiled("picky", []string{"MESSAGE"}, func(*processor.MessageRequest) (bool, error) { return false, nil })

	cases := []struct {
		name   string
		list   []*compiledProcessor
		method processor.Method
		want   string
	}{
		{"matches incoming request as a REGISTER", []*compiledProcessor{ref1, ref2}, processor.Method_REGISTER, "processor-ref1"},
		{"matches incoming request as an INVITE", []*compiledProcessor{ref1, ref2}, processor.Method_INVITE, "processor-ref2"},
		{"matches incoming request as a MESSAGE", []*compiledProcessor{ref1, ref2, ref3}, processor.Method_MESSAGE, "processor-ref3"},
		{"skips a processor whose matchFunc declines", []*compiledProcessor{picky, ref3}, processor.Method_MESSAGE, "processor-ref3"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p, err := findProcessor(c.list, withMethod(c.method))
			if err != nil {
				t.Fatalf("findProcessor: %v", err)
			}
			if p.ref != c.want {
				t.Fatalf("ref = %s, want %s", p.ref, c.want)
			}
		})
	}

	t.Run("fails because there is not matching processor", func(t *testing.T) {
		_, err := findProcessor([]*compiledProcessor{ref1, ref2, ref3}, withMethod(processor.Method_PUBLISH))
		if status.Code(err) != codes.NotFound {
			t.Fatalf("code = %v, want NotFound", status.Code(err))
		}
		if msg := status.Convert(err).Message(); msg != "not matching processor found for request ref: call-id" {
			t.Fatalf("message = %q", msg)
		}
	})

	t.Run("a failing matchFunc fails the request", func(t *testing.T) {
		broken := compiled("broken", []string{"REGISTER"}, func(*processor.MessageRequest) (bool, error) {
			return false, errors.New("matchFunc threw: TypeError")
		})
		_, err := findProcessor([]*compiledProcessor{broken, ref3}, withMethod(processor.Method_REGISTER))
		if status.Code(err) != codes.Unknown {
			t.Fatalf("code = %v, want Unknown", status.Code(err))
		}
		if msg := status.Convert(err).Message(); msg != "matchFunc of processor ref = broken failed: matchFunc threw: TypeError" {
			t.Fatalf("message = %q", msg)
		}
	})

	t.Run("the matchFunc only runs when the method is enabled", func(t *testing.T) {
		ran := false
		p := compiled("p", []string{"INVITE"}, func(*processor.MessageRequest) (bool, error) { ran = true; return true, nil })
		if _, err := findProcessor([]*compiledProcessor{p}, withMethod(processor.Method_REGISTER)); err == nil {
			t.Fatal("expected no match")
		}
		if ran {
			t.Fatal("matchFunc ran for a method the processor does not accept")
		}
	})
}

func TestMethodSet(t *testing.T) {
	set := methodSet([]string{"INVITE", "BYE", "NOPE"})
	if _, ok := set[processor.Method_INVITE]; !ok {
		t.Fatal("INVITE missing")
	}
	if _, ok := set[processor.Method_BYE]; !ok {
		t.Fatal("BYE missing")
	}
	if len(set) != 2 {
		t.Fatalf("len = %d, want 2 (unknown names are skipped)", len(set))
	}
}

// inDialog is a message of the method with a To tag: inside a dialog.
func inDialog(m processor.Method) *processor.MessageRequest {
	req := withMethod(m)
	if req.Message == nil {
		req.Message = &sipmessage.SIPMessage{}
	}
	req.Message.To = &sipmessage.To{Tag: "callee-tag"}
	return req
}

func TestFindProcessorInDialog(t *testing.T) {
	connect := compiled("connect", config.DefaultMethods, alwaysMatch)
	for _, m := range []processor.Method{processor.Method_INFO, processor.Method_UPDATE, processor.Method_PRACK, processor.Method_OPTIONS} {
		if p, err := findProcessor([]*compiledProcessor{connect}, inDialog(m)); err != nil || p != connect {
			t.Errorf("in-dialog %s: %v, %v, want connect", m, p, err)
		}
	}
	// OPTIONS is in the default list (a carrier's keepalive); the others aren't
	for _, m := range []processor.Method{processor.Method_INFO, processor.Method_MESSAGE} {
		if _, err := findProcessor([]*compiledProcessor{connect}, withMethod(m)); status.Code(err) != codes.NotFound {
			t.Errorf("out-of-dialog %s: %v, want NotFound", m, err)
		}
	}

	// A 200 OK to an UPDATE matches under its CSeq method
	ok := inDialog(processor.Method_UPDATE)
	ok.Message.MessageType = &sipmessage.SIPMessage_ResponseType{ResponseType: sipmessage.ResponseType_OK}
	if p, err := findProcessor([]*compiledProcessor{connect}, ok); err != nil || p != connect {
		t.Errorf("200 to UPDATE: %v, %v", p, err)
	}

	a := compiled("a", []string{"INFO"}, alwaysMatch)
	b := compiled("b", []string{"INVITE"}, alwaysMatch)
	if p, _ := findProcessor([]*compiledProcessor{b, a}, inDialog(processor.Method_INFO)); p != a {
		t.Errorf("pass 1 wins: %v", p)
	}
	if p, _ := findProcessor([]*compiledProcessor{b}, inDialog(processor.Method_INFO)); p != b {
		t.Errorf("only the INVITE processor: %v", p)
	}

	// The matchFunc sees the real method and can refuse
	refuses := compiled("refuses", []string{"INVITE"}, isMethod(processor.Method_INVITE))
	if p, _ := findProcessor([]*compiledProcessor{refuses, b}, inDialog(processor.Method_INFO)); p != b {
		t.Errorf("the next INVITE processor is tried: %v", p)
	}
	if _, err := findProcessor([]*compiledProcessor{refuses, a}, inDialog(processor.Method_UPDATE)); status.Code(err) != codes.NotFound {
		t.Errorf("none takes it: %v", err)
	}
}
