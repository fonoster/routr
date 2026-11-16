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
	"strings"
	"testing"

	"github.com/emiago/sipgo/sip"
	"go.opentelemetry.io/otel/trace"
)

func forwarded(host string, headers ...sip.Header) *sip.Request {
	out := sip.NewRequest(sip.INVITE, sip.Uri{Scheme: "sip", User: "1001", Host: host})
	for _, h := range headers {
		out.AppendHeader(h)
	}
	return out
}

const parentTraceparent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"

func TestIsInternal(t *testing.T) {
	e := &EdgePort{internalNets: parseInternalNets([]string{"10.0.0.0/8", "192.168.1.5", "not a net"})}
	cases := map[string]bool{
		"10.1.2.3":    true,
		"192.168.1.5": true,
		"192.168.1.6": false,
		"8.8.8.8":     false,
		"pbx.local":   false,
		"":            false,
	}
	for host, want := range cases {
		if got := e.isInternal(host); got != want {
			t.Errorf("isInternal(%q) = %v, want %v", host, got, want)
		}
	}
}

func TestOffPaysNothingAndHasNoSpan(t *testing.T) {
	e := &EdgePort{}
	req := forwarded("10.0.0.1")
	ctx, span := e.startRequestSpan(req)
	if span != nil || ctx != context.Background() {
		t.Errorf("off: %v %v", ctx, span)
	}
	if e.instantSpan(req) != context.Background() || e.traceContext(nil) != context.Background() {
		t.Error("off: the background context")
	}
	e.responseSent(nil, &sip.Response{StatusCode: 200}, nil)
	e.failSpan(nil, "no")
	e.clientEnded(nil, nil)
}

func TestForwardingStripsTheHeaderOnTheWayOut(t *testing.T) {
	e := &EdgePort{internalNets: parseInternalNets([]string{"10.0.0.0/8"})}

	out := forwarded("8.8.8.8", sip.NewHeader("Traceparent", parentTraceparent))
	e.forwardTraceContext(nil, out)
	if traceparentOf(out) != nil {
		t.Error("a carrier never gets a traceparent")
	}

	out = forwarded("10.0.0.1", sip.NewHeader(traceparentHeader, parentTraceparent))
	e.forwardTraceContext(nil, out)
	if h := traceparentOf(out); h == nil || h.Value() != parentTraceparent {
		t.Errorf("an internal hop keeps it with telemetry off: %v", h)
	}

	out = forwarded("8.8.8.8")
	e.forwardTraceContext(nil, out)
	if traceparentOf(out) != nil {
		t.Error("nothing is added with telemetry off")
	}
}

func TestTraceParentTrustsOnlyInternalPeers(t *testing.T) {
	e := &EdgePort{internalNets: parseInternalNets([]string{"10.0.0.0/8"})}
	req := forwarded("10.0.0.1", sip.NewHeader(traceparentHeader, parentTraceparent))

	req.SetSource("10.0.0.9:5060")
	sc := trace.SpanContextFromContext(e.traceParent(req))
	if !sc.IsValid() || !strings.Contains(parentTraceparent, sc.TraceID().String()) {
		t.Errorf("an internal peer sets the parent: %v", sc)
	}

	req.SetSource("8.8.8.8:5060")
	if sc := trace.SpanContextFromContext(e.traceParent(req)); sc.IsValid() {
		t.Errorf("an external peer doesn't: %v", sc)
	}

	bad := forwarded("10.0.0.1", sip.NewHeader(traceparentHeader, "garbage"))
	bad.SetSource("10.0.0.9:5060")
	if sc := trace.SpanContextFromContext(e.traceParent(bad)); sc.IsValid() {
		t.Errorf("a malformed value is no parent: %v", sc)
	}
}

func TestKnownMethodBoundsTheLabel(t *testing.T) {
	if knownMethod(sip.INVITE) != "INVITE" || knownMethod(sip.RequestMethod("X-ANYTHING")) != "other" {
		t.Error("known methods keep their name, the rest are other")
	}
}
