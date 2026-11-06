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
	"strings"
	"sync"
	"time"

	"github.com/nats-io/nats.go"

	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
	"github.com/fonoster/routr/internal/common/sipconv"
)

// The event names of io.routr.events.EventTypes.
const (
	EventCallStarted        = "call.started"
	EventCallEnded          = "call.ended"
	EventEndpointRegistered = "endpoint.registered"
)

const (
	maxStartedCalls = 50_000
	startedCallTTL  = 24 * time.Hour
)

// hangupCauses is io.routr.HangupCauses.
var hangupCauses = map[int]string{
	200: "NORMAL_CLEARING",
	401: "CALL_REJECTED",
	403: "CALL_REJECTED",
	404: "UNALLOCATED",
	407: "CALL_REJECTED",
	408: "NO_USER_RESPONSE",
	420: "NO_ROUTE_DESTINATION",
	480: "NO_ANSWER",
	483: "NO_ANSWER",
	486: "USER_BUSY",
	487: "NORMAL_CLEARING",
	488: "NOT_ACCEPTABLE_HERE",
	503: "SERVICE_UNAVAILABLE",
	600: "USER_BUSY",
	604: "UNALLOCATED",
	603: "CALL_REJECTED",
	484: "INVALID_NUMBER_FORMAT",
	485: "UNALLOCATED",
}

// HangupCause returns the hangup cause of a status code.
func HangupCause(code int) string {
	if cause, ok := hangupCauses[code]; ok {
		return cause
	}
	return "UNKNOWN"
}

// Publisher sends an event somewhere.
type Publisher interface {
	Publish(name string, event map[string]any)
}

// ConsolePublisher logs events (CONSOLE_PUBLISHER_ENABLED).
type ConsolePublisher struct{}

// Publish logs the event at debug level.
func (ConsolePublisher) Publish(name string, event map[string]any) {
	logger().Debug("event: "+name, "message", event)
}

// NATSPublisher publishes events as JSON on <subject>.<event name>.
type NATSPublisher struct {
	conn    *nats.Conn
	subject string
}

// NewNATSPublisher connects to NATS.
func NewNATSPublisher(url, subject string) (*NATSPublisher, error) {
	conn, err := nats.Connect(url)
	if err != nil {
		return nil, err
	}
	return &NATSPublisher{conn: conn, subject: subject}, nil
}

// Publish sends the event.
func (p *NATSPublisher) Publish(name string, event map[string]any) {
	data, err := json.Marshal(event)
	if err != nil {
		logger().Error("error publishing event: " + err.Error())
		return
	}
	logger().Debug("event: " + name + " message: " + string(data))
	if err := p.conn.Publish(p.subject+"."+name, data); err != nil {
		logger().Error("error publishing event: " + err.Error())
	}
}

type startedCall struct {
	at           time.Time
	extraHeaders map[string]string
}

// EventProcessor is io.routr.utils.EventProcessor.
type EventProcessor struct {
	publishers []Publisher

	mu           sync.Mutex
	startedCalls map[string]*startedCall
	order        []string
	now          func() time.Time
}

// NewEventProcessor returns a processor that sends to the given publishers.
func NewEventProcessor(publishers []Publisher) *EventProcessor {
	return &EventProcessor{publishers: publishers, startedCalls: map[string]*startedCall{}, now: time.Now}
}

func isoNow(t time.Time) string {
	return t.UTC().Truncate(time.Millisecond).Format("2006-01-02T15:04:05.000Z")
}

func extraHeaders(msg *pb.SIPMessage) map[string]string {
	headers := map[string]string{}
	for _, ext := range msg.GetExtensions() {
		if strings.HasPrefix(strings.ToLower(ext.GetName()), "x-") {
			headers[ext.GetName()] = ext.GetValue()
		}
	}
	return headers
}

func aor(uri *pb.SipURI) string {
	return "sip:" + uri.GetUser() + "@" + uri.GetHost()
}

func (p *EventProcessor) enabled() bool {
	return len(p.publishers) > 0
}

func (p *EventProcessor) publish(name string, event map[string]any) {
	for _, pub := range p.publishers {
		pub.Publish(name, event)
	}
}

// CallStarted publishes call.started. caller is the From the INVITE arrived
// with, which the processor's reply may have rewritten.
func (p *EventProcessor) CallStarted(response *ppb.MessageResponse, caller *pb.From) {
	if !p.enabled() {
		return
	}
	msg := response.GetMessage()
	callID := msg.GetCallId().GetCallId()
	from := msg.GetFrom()
	if caller != nil {
		from = caller
	}
	headers := extraHeaders(msg)
	event := map[string]any{
		"callId":       callID,
		"from":         aor(from.GetAddress().GetUri()),
		"to":           aor(msg.GetTo().GetAddress().GetUri()),
		"startTime":    isoNow(p.now()),
		"extraHeaders": headers,
	}
	for k, v := range response.GetMetadata() {
		event[k] = v
	}
	p.rememberStartedCall(callID, headers)
	p.publish(EventCallStarted, event)
}

// CallEnded publishes call.ended.
func (p *EventProcessor) CallEnded(response *ppb.MessageResponse) {
	if !p.enabled() {
		return
	}
	msg := response.GetMessage()
	callID := msg.GetCallId().GetCallId()
	code := sipconv.CodeOf(msg.GetResponseType())
	if msg.GetResponseType() == pb.ResponseType_UNKNOWN {
		code = 200
	}
	p.publish(EventCallEnded, map[string]any{
		"callId":       callID,
		"endTime":      isoNow(p.now()),
		"hangupCause":  HangupCause(code),
		"extraHeaders": p.endedCallHeaders(callID, msg),
	})
}

// Registration publishes endpoint.registered.
func (p *EventProcessor) Registration(request *ppb.MessageRequest, expires int) {
	if !p.enabled() {
		return
	}
	p.publish(EventEndpointRegistered, map[string]any{
		"aor":          aor(request.GetMessage().GetFrom().GetAddress().GetUri()),
		"registeredAt": isoNow(p.now()),
		"expires":      expires,
		"extraHeaders": extraHeaders(request.GetMessage()),
	})
}

func (p *EventProcessor) rememberStartedCall(callID string, headers map[string]string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := p.now()
	for len(p.order) > 0 {
		eldest, ok := p.startedCalls[p.order[0]]
		if ok && now.Sub(eldest.at) < startedCallTTL {
			break
		}
		delete(p.startedCalls, p.order[0])
		p.order = p.order[1:]
	}
	previous, ok := p.startedCalls[callID]
	merged := map[string]string{}
	at := now
	if ok {
		at = previous.at
		for k, v := range previous.extraHeaders {
			merged[k] = v
		}
	} else {
		p.order = append(p.order, callID)
	}
	for k, v := range headers {
		merged[k] = v
	}
	p.startedCalls[callID] = &startedCall{at: at, extraHeaders: merged}
	if len(p.startedCalls) > maxStartedCalls && len(p.order) > 0 {
		delete(p.startedCalls, p.order[0])
		p.order = p.order[1:]
	}
}

func (p *EventProcessor) endedCallHeaders(callID string, msg *pb.SIPMessage) map[string]string {
	p.mu.Lock()
	defer p.mu.Unlock()
	headers := map[string]string{}
	if started, ok := p.startedCalls[callID]; ok {
		delete(p.startedCalls, callID)
		if p.now().Sub(started.at) < startedCallTTL {
			for k, v := range started.extraHeaders {
				headers[k] = v
			}
		}
	}
	for k, v := range extraHeaders(msg) {
		headers[k] = v
	}
	return headers
}
