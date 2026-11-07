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
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"strconv"
	"strings"

	"github.com/emiago/sipgo/sip"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"github.com/fonoster/routr/internal/common/telemetry"
)

// The EdgePort's signals, the names of the Java EdgePort's io.routr.telemetry:
// one span per SIP server transaction and counters per method. With telemetry
// off EdgePort.tel is nil: a nil check is all the message path pays, and the
// server transaction holds no span.
//
// With telemetry on, a span the sampler drops costs a span ID and a small
// allocation: its attributes are only built for a span that records. Spans live
// in the server transaction, so there is nothing to sweep.

const (
	telemetryScope    = "io.routr.edgeport"
	traceparentHeader = "traceparent"
)

type sipTelemetry struct {
	tracer          trace.Tracer
	requests        metric.Int64Counter
	responses       metric.Int64Counter
	timeouts        metric.Int64Counter
	transportErrors metric.Int64Counter
	overflows       metric.Int64Counter
}

// newSIPTelemetry builds the instruments, or returns nil with telemetry off.
func newSIPTelemetry(log *slog.Logger) *sipTelemetry {
	if !telemetry.Enabled() {
		return nil
	}
	meter := otel.Meter(telemetryScope)
	counter := func(name, description string) metric.Int64Counter {
		c, err := meter.Int64Counter(name, metric.WithDescription(description))
		if err != nil {
			// The SDK still returns a usable instrument
			log.Warn("telemetry: unable to build a counter", "name", name, "error", err)
		}
		return c
	}
	return &sipTelemetry{
		overflows:       counter("routr.sip.overflows", "Limits of the EdgePort that said no, by limit"),
		tracer:          otel.Tracer(telemetryScope),
		requests:        counter("routr.sip.requests", "SIP requests EdgePort received"),
		responses:       counter("routr.sip.responses", "Final SIP responses EdgePort sent"),
		timeouts:        counter("routr.sip.timeouts", "SIP transactions that timed out"),
		transportErrors: counter("routr.sip.transport_errors", "SIP transactions a transport error ended"),
	}
}

// startRequestSpan counts a request and starts its span, whose context the
// calls it causes carry. With telemetry off the context is the background one
// and the span nil.
func (e *EdgePort) startRequestSpan(req *sip.Request) (context.Context, trace.Span) {
	t := e.tel
	if t == nil {
		return context.Background(), nil
	}
	transport := strings.ToLower(req.Transport())
	t.requests.Add(context.Background(), 1, metric.WithAttributes(
		attribute.String("sip.method", knownMethod(req.Method)),
		attribute.String("network.transport", transport),
	))
	ctx, span := t.tracer.Start(e.traceParent(req), "SIP "+knownMethod(req.Method), trace.WithSpanKind(trace.SpanKindServer))
	if span.IsRecording() {
		host, port := splitSource(req.Source())
		span.SetAttributes(
			attribute.String("sip.method", string(req.Method)),
			attribute.String("sip.call_id", callIDOf(req)),
			attribute.String("network.transport", transport),
			attribute.String("network.peer.address", host),
			attribute.Int("network.peer.port", port),
		)
	}
	return ctx, span
}

// instantSpan is the span of a request with no transaction of its own to end it
// (an ACK, a CANCEL the stack answered): it ends at once, and its context still
// parents the calls the request causes.
func (e *EdgePort) instantSpan(req *sip.Request) context.Context {
	ctx, span := e.startRequestSpan(req)
	if span != nil {
		span.End()
	}
	return ctx
}

// traceContext is the context of the server transaction's span, for the calls
// made on its behalf.
func (e *EdgePort) traceContext(tx *ServerTx) context.Context {
	if e.tel != nil && tx != nil {
		if tx.ctx != nil && !tx.released.Load() {
			return tx.ctx
		}
	}
	return context.Background()
}

// clientTraceContext is traceContext for the server transaction a client
// transaction forwards for.
func (e *EdgePort) clientTraceContext(tx *ClientTx) context.Context {
	if e.tel != nil {
		if info := e.clientInfo(tx); info != nil {
			return e.traceContext(info.server)
		}
	}
	return context.Background()
}

// traceParent is the context a request's span starts from: the traceparent it
// carries when it comes from the EdgePort's own networks. One from outside (a
// carrier, a phone) is not trusted: it would put the span in a trace someone
// else chose.
func (e *EdgePort) traceParent(req *sip.Request) context.Context {
	ctx := context.Background()
	header := traceparentOf(req)
	if header == nil {
		return ctx
	}
	if host, _ := splitSource(req.Source()); !e.isInternal(host) {
		return ctx
	}
	carrier := propagation.MapCarrier{traceparentHeader: strings.ToLower(strings.TrimSpace(header.Value()))}
	return propagation.TraceContext{}.Extract(ctx, carrier)
}

// forwardTraceContext puts the trace context of the server transaction's span on
// the request forwarded for it, so an internal next hop continues the trace. A
// request to anywhere else loses the header: trace context is never sent to a
// carrier or a phone, with telemetry on or off, as in the Java EdgePort.
func (e *EdgePort) forwardTraceContext(tx *ServerTx, out *sip.Request) {
	header := traceparentOf(out)
	if e.tel == nil && header == nil {
		return
	}
	internal := e.isInternal(out.Recipient.Host)
	if !internal && header != nil {
		out.RemoveHeader(header.Name())
	}
	if !internal || e.tel == nil {
		return
	}
	sc := trace.SpanContextFromContext(e.traceContext(tx))
	if !sc.IsValid() {
		return
	}
	if header != nil {
		out.RemoveHeader(header.Name())
	}
	out.AppendHeader(sip.NewHeader(traceparentHeader, fmt.Sprintf("00-%s-%s-%s", sc.TraceID(), sc.SpanID(), sc.TraceFlags())))
}

// responseSent counts a final response and ends the span of its transaction; a
// response that could not be sent ends it as an error and isn't counted.
func (e *EdgePort) responseSent(tx *ServerTx, res *sip.Response, sendErr error) {
	if e.tel == nil || res.StatusCode < 200 {
		return
	}
	span := tx.span
	if sendErr != nil {
		if span != nil {
			span.SetAttributes(attribute.Int("sip.status_code", res.StatusCode))
			span.SetStatus(codes.Error, "final response not sent")
			span.End()
		}
		return
	}
	e.tel.responses.Add(context.Background(), 1, metric.WithAttributes(
		attribute.String("sip.method", knownMethod(tx.Origin().Method)),
		attribute.Int("sip.status_code", res.StatusCode),
	))
	if span == nil {
		return
	}
	span.SetAttributes(attribute.Int("sip.status_code", res.StatusCode))
	if res.StatusCode >= 500 || res.StatusCode == sip.StatusRequestTimeout {
		span.SetStatus(codes.Error, res.Reason)
	}
	span.End()
}

// failSpan ends the server transaction's span as an error: the request will get
// no final response.
func (e *EdgePort) failSpan(tx *ServerTx, reason string) {
	if e.tel == nil || tx == nil {
		return
	}
	if tx.span != nil {
		tx.span.SetStatus(codes.Error, reason)
		tx.span.End()
	}
}

// clientEnded counts how a client transaction failed, if it did.
func (e *EdgePort) clientEnded(tx *ClientTx, server *ServerTx) {
	if e.tel == nil {
		return
	}
	err := tx.Err()
	switch {
	case errors.Is(err, sip.ErrTransactionTimeout):
		e.tel.timeouts.Add(context.Background(), 1, metric.WithAttributes(attribute.String("sip.method", knownMethod(tx.Origin().Method))))
		e.failSpan(server, "timeout: no final response")
	case errors.Is(err, sip.ErrTransactionTransport):
		e.tel.transportErrors.Add(context.Background(), 1, metric.WithAttributes(attribute.String("network.transport", strings.ToLower(tx.Origin().Transport()))))
	}
}

// isInternal tells whether host is an address in the EdgePort's localnets. A
// name is not resolved here, and counts as external.
func (e *EdgePort) isInternal(host string) bool {
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}
	addr = addr.Unmap()
	for _, network := range e.internalNets {
		if network.Contains(addr) {
			return true
		}
	}
	return false
}

// parseInternalNets reads the localnets, CIDRs or single addresses; anything
// else is skipped, as the Java EdgePort skipped it.
func parseInternalNets(localnets []string) []netip.Prefix {
	var nets []netip.Prefix
	for _, entry := range localnets {
		if prefix, err := netip.ParsePrefix(entry); err == nil {
			nets = append(nets, prefix)
			continue
		}
		if addr, err := netip.ParseAddr(entry); err == nil {
			nets = append(nets, netip.PrefixFrom(addr, addr.BitLen()))
		}
	}
	return nets
}

// traceparentOf finds the header whatever its case; a processor may have
// rewritten it.
func traceparentOf(msg *sip.Request) sip.Header {
	for _, h := range msg.Headers() {
		if strings.EqualFold(h.Name(), traceparentHeader) {
			return h
		}
	}
	return nil
}

func splitSource(source string) (string, int) {
	host, port, err := net.SplitHostPort(source)
	if err != nil {
		return source, 0
	}
	n, _ := strconv.Atoi(port)
	return host, n
}

// knownMethod keeps a label a peer picks to the methods SIP defines, so a
// stranger can't grow the metric's series or the span names without bound.
func knownMethod(method sip.RequestMethod) string {
	switch method {
	case sip.INVITE, sip.ACK, sip.CANCEL, sip.BYE, sip.REGISTER, sip.OPTIONS, sip.SUBSCRIBE,
		sip.NOTIFY, sip.REFER, sip.INFO, sip.MESSAGE, sip.PRACK, sip.UPDATE, sip.PUBLISH:
		return string(method)
	}
	return "other"
}
