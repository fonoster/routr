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

// Package trace is the format of Routr's call recordings and what reads it
// while it is written: one JSON record per line, one file per call, with
// credentials redacted and the SIP rules evaluated. It is the Go port of
// mods/common/src/trace. rctl trace stays TypeScript and reads these files, so
// the format here is the one traceRecordSchema (schema.ts) validates.
package trace

import (
	"github.com/fonoster/routr/internal/common/pb/processor"
	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// Version is the traceVersion this build writes.
const Version = 1

// The metadata keys reserved for the trace. A component may put any trace.*
// key in its response: the Dispatcher copies it into the hop and removes it
// before the message reaches the EdgePort. FlagMetadataKey is the one with a
// meaning: a processor sets it to have the call recorded, and its value is the
// ref of the resource that asked. It is never copied into a hop.
const (
	MetadataPrefix  = "trace."
	FlagMetadataKey = "trace.record"
)

// Profile is a set of rules a lint run evaluates.
type Profile string

// The rule profiles.
const (
	// ProfileSIP is RFC 3261 and companions.
	ProfileSIP Profile = "sip"
	// ProfileSIPConnect is the SIPconnect 1.1 Technical Recommendation.
	ProfileSIPConnect Profile = "sip-connect"
)

// Severity is how bad a finding is.
type Severity string

// The severities.
const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
)

// Side is the part of a record a finding points at.
type Side string

// The sides.
const (
	SideIn   Side = "in"
	SideOut  Side = "out"
	SideCall Side = "call"
)

// Finding is one rule firing on one record.
type Finding struct {
	Rule     string
	Profile  Profile
	Severity Severity
	Spec     string
	Message  string
	Side     Side
	Header   string
}

// Lint names the rule set that produced a record's findings.
type Lint struct {
	Version  string
	Profiles []Profile
}

// Kind tells whether the Dispatcher received a request or a response.
type Kind string

// The kinds.
const (
	KindRequest  Kind = "request"
	KindResponse Kind = "response"
)

// Outcome is what became of a message.
type Outcome string

// The outcomes.
const (
	// OutcomeForwarded: a request left the Dispatcher as a request
	OutcomeForwarded Outcome = "forwarded"
	// OutcomeRelayed: a response left the Dispatcher as a response
	OutcomeRelayed Outcome = "relayed"
	// OutcomeAnswered: a component answered a request with a 2xx
	OutcomeAnswered Outcome = "answered"
	// OutcomeRejected: a component answered a request with a 3xx-6xx
	OutcomeRejected Outcome = "rejected"
	// OutcomeError: the Dispatcher returned an error to the EdgePort
	OutcomeError Outcome = "error"
)

// HopKind is the kind of component a hop crossed.
type HopKind string

// The hop kinds.
const (
	HopDispatcher HopKind = "dispatcher"
	HopMiddleware HopKind = "middleware"
	HopProcessor  HopKind = "processor"
)

// HopAction is what a component did to the message.
type HopAction string

// The hop actions.
const (
	ActionMatched     HopAction = "matched"
	ActionPassThrough HopAction = "pass-through"
	ActionForwarded   HopAction = "forwarded"
	ActionResponded   HopAction = "responded"
	ActionRelayed     HopAction = "relayed"
	ActionError       HopAction = "error"
)

// HeaderChange is a value before and after a component.
type HeaderChange struct {
	From string
	To   string
}

// HeaderValue is a header a component added or removed.
type HeaderValue struct {
	Name  string
	Value string
}

// ChangedHeader is a header a component changed.
type ChangedHeader struct {
	Name string
	HeaderChange
}

// Diff is what a component changed. The slices keep the order the headers
// appear in the message, the order the Node recorder's objects had.
type Diff struct {
	RequestURI *HeaderChange
	Added      []HeaderValue
	Removed    []HeaderValue
	Changed    []ChangedHeader
}

// Hop is one component a message crossed.
type Hop struct {
	Component  string
	Kind       HopKind
	Version    string
	DurationMs float64
	Action     HopAction
	Diff       *Diff
	Error      string
	// Metadata holds the trace.* keys of the response, prefix removed
	Metadata map[string]string
}

// Component names an EdgePort or a Dispatcher.
type Component struct {
	Ref     string
	Version string
}

// Response is what the Dispatcher returned.
type Response struct {
	Message  *sipmessage.SIPMessage
	Metadata map[string]string
}

// Record is one line of a trace file: one message crossing the Dispatcher.
type Record struct {
	RecordedAt string
	CallID     string
	Seq        int
	TOffsetMs  float64
	Kind       Kind
	Method     string
	// Status is 0 when the message carries none
	Status     int
	EdgePort   Component
	Dispatcher Component
	TrunkRef   string
	// Request is the message as received, without trace.* metadata
	Request *processor.MessageRequest
	// MessageLast writes request.message after the request's other fields,
	// where the Node recorder's redaction left it. Readers don't care; it keeps
	// the files byte for byte what Routr 2 wrote.
	MessageLast bool
	Hops        []Hop
	// Response is nil when the Dispatcher returned an error
	Response *Response
	Outcome  Outcome
	TotalMs  float64
	// Lint and Findings are set when rules were evaluated while writing
	Lint     *Lint
	Findings []Finding
}
