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
	"encoding/base64"
	"math"
	"sort"
	"strconv"
	"unicode/utf8"

	"google.golang.org/protobuf/reflect/protoreflect"

	"github.com/fonoster/routr/internal/common/pb/processor"
)

// Encoder writes records as the Node recorder wrote them: JSON.stringify over
// what @grpc/proto-loader made of the message (camelCase names, enums by name,
// defaults filled in, null for an unset message, the oneof's name beside its
// member, longs as strings). protojson can't: it has no oneof name, and it
// varies its whitespace on purpose. Keys come in protobuf.js's toObject order:
// repeated fields, then maps, then singular fields, each by field number, then
// the oneofs. An Encoder keeps the field order of each message type, so it
// belongs to one goroutine.
type Encoder struct {
	plans map[protoreflect.FullName]*messagePlan
}

// NewEncoder returns an Encoder.
func NewEncoder() *Encoder {
	return &Encoder{plans: map[protoreflect.FullName]*messagePlan{}}
}

// fieldPlan is a field and its key, quoted, colon included.
type fieldPlan struct {
	desc protoreflect.FieldDescriptor
	key  string
}

// messagePlan is the order the fields of a message type are written in.
type messagePlan struct {
	// fixed fields are always written
	fixed []fieldPlan
	// oneofs members are written when set, each followed by oneofKeys[i] and
	// its own name
	oneofs    []fieldPlan
	oneofKeys []string
	byName    map[protoreflect.Name]fieldPlan
}

func quotedKey(name string) string {
	return string(appendString(nil, name)) + ":"
}

// lowerCamel is protobuf.js's camelCase, for the name of a oneof.
func lowerCamel(name string) string {
	out := make([]byte, 0, len(name))
	for i := 0; i < len(name); i++ {
		if name[i] == '_' && i > 0 && i+1 < len(name) && name[i+1] >= 'a' && name[i+1] <= 'z' {
			i++
			out = append(out, name[i]-'a'+'A')
			continue
		}
		out = append(out, name[i])
	}
	return string(out)
}

func (e *Encoder) plan(desc protoreflect.MessageDescriptor) *messagePlan {
	if p, ok := e.plans[desc.FullName()]; ok {
		return p
	}
	fields := desc.Fields()
	sorted := make([]protoreflect.FieldDescriptor, 0, fields.Len())
	for i := range fields.Len() {
		sorted = append(sorted, fields.Get(i))
	}
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Number() < sorted[j].Number() })

	p := &messagePlan{byName: make(map[protoreflect.Name]fieldPlan, len(sorted))}
	var repeated, maps, normal []fieldPlan
	for _, fd := range sorted {
		f := fieldPlan{desc: fd, key: quotedKey(fd.JSONName())}
		p.byName[fd.Name()] = f
		switch {
		case fd.ContainingOneof() != nil:
			p.oneofs = append(p.oneofs, f)
			p.oneofKeys = append(p.oneofKeys, quotedKey(lowerCamel(string(fd.ContainingOneof().Name()))))
		case fd.IsList():
			repeated = append(repeated, f)
		case fd.IsMap():
			maps = append(maps, f)
		default:
			normal = append(normal, f)
		}
	}
	p.fixed = append(append(repeated, maps...), normal...)
	e.plans[desc.FullName()] = p
	return p
}

// appendString writes s as JSON.stringify does: only the quote, the backslash
// and control characters are escaped.
func appendString(b []byte, s string) []byte {
	b = append(b, '"')
	for i := 0; i < len(s); {
		c := s[i]
		if c >= utf8.RuneSelf {
			r, size := utf8.DecodeRuneInString(s[i:])
			if r == utf8.RuneError && size == 1 {
				b = append(b, "�"...)
			} else {
				b = append(b, s[i:i+size]...)
			}
			i += size
			continue
		}
		i++
		switch c {
		case '"':
			b = append(b, '\\', '"')
		case '\\':
			b = append(b, '\\', '\\')
		case '\b':
			b = append(b, '\\', 'b')
		case '\f':
			b = append(b, '\\', 'f')
		case '\n':
			b = append(b, '\\', 'n')
		case '\r':
			b = append(b, '\\', 'r')
		case '\t':
			b = append(b, '\\', 't')
		default:
			if c < 0x20 {
				const hex = "0123456789abcdef"
				b = append(b, '\\', 'u', '0', '0', hex[c>>4], hex[c&0xf])
			} else {
				b = append(b, c)
			}
		}
	}
	return append(b, '"')
}

// appendNumber writes f as JSON.stringify does for the values a record holds.
func appendNumber(b []byte, f float64) []byte {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return append(b, "null"...)
	}
	return strconv.AppendFloat(b, f, 'f', -1, 64)
}

func (e *Encoder) appendScalar(b []byte, fd protoreflect.FieldDescriptor, v protoreflect.Value) []byte {
	switch fd.Kind() {
	case protoreflect.BoolKind:
		return strconv.AppendBool(b, v.Bool())
	case protoreflect.Int32Kind, protoreflect.Sint32Kind, protoreflect.Sfixed32Kind:
		return strconv.AppendInt(b, v.Int(), 10)
	case protoreflect.Uint32Kind, protoreflect.Fixed32Kind:
		return strconv.AppendUint(b, v.Uint(), 10)
	case protoreflect.Int64Kind, protoreflect.Sint64Kind, protoreflect.Sfixed64Kind:
		// longs: String
		b = append(b, '"')
		b = strconv.AppendInt(b, v.Int(), 10)
		return append(b, '"')
	case protoreflect.Uint64Kind, protoreflect.Fixed64Kind:
		b = append(b, '"')
		b = strconv.AppendUint(b, v.Uint(), 10)
		return append(b, '"')
	case protoreflect.FloatKind, protoreflect.DoubleKind:
		return appendNumber(b, v.Float())
	case protoreflect.StringKind:
		return appendString(b, v.String())
	case protoreflect.BytesKind:
		return appendString(b, base64.StdEncoding.EncodeToString(v.Bytes()))
	case protoreflect.EnumKind:
		value := fd.Enum().Values().ByNumber(v.Enum())
		if value == nil {
			return strconv.AppendInt(b, int64(v.Enum()), 10)
		}
		return appendString(b, string(value.Name()))
	case protoreflect.MessageKind, protoreflect.GroupKind:
		return e.appendMessage(b, v.Message())
	}
	return append(b, "null"...)
}

func (e *Encoder) appendField(b []byte, m protoreflect.Message, fd protoreflect.FieldDescriptor) []byte {
	switch {
	case fd.IsList():
		list := m.Get(fd).List()
		b = append(b, '[')
		for i := range list.Len() {
			if i > 0 {
				b = append(b, ',')
			}
			b = e.appendScalar(b, fd, list.Get(i))
		}
		return append(b, ']')
	case fd.IsMap():
		entries := m.Get(fd).Map()
		keys := make([]protoreflect.MapKey, 0, entries.Len())
		entries.Range(func(k protoreflect.MapKey, _ protoreflect.Value) bool {
			keys = append(keys, k)
			return true
		})
		sort.Slice(keys, func(i, j int) bool { return keys[i].String() < keys[j].String() })
		b = append(b, '{')
		for i, k := range keys {
			if i > 0 {
				b = append(b, ',')
			}
			b = appendString(b, k.String())
			b = append(b, ':')
			b = e.appendScalar(b, fd.MapValue(), entries.Get(k))
		}
		return append(b, '}')
	case fd.Message() != nil && !m.Has(fd):
		return append(b, "null"...)
	}
	return e.appendScalar(b, fd, m.Get(fd))
}

func (e *Encoder) appendMessage(b []byte, m protoreflect.Message) []byte {
	p := e.plan(m.Descriptor())
	b = append(b, '{')
	first := true
	for _, f := range p.fixed {
		if !first {
			b = append(b, ',')
		}
		first = false
		b = append(b, f.key...)
		b = e.appendField(b, m, f.desc)
	}
	for i, f := range p.oneofs {
		if !m.Has(f.desc) {
			continue
		}
		if !first {
			b = append(b, ',')
		}
		first = false
		b = append(b, f.key...)
		b = e.appendField(b, m, f.desc)
		b = append(b, ',')
		b = append(b, p.oneofKeys[i]...)
		b = appendString(b, f.desc.JSONName())
	}
	return append(b, '}')
}

// appendRequest writes a MessageRequest with the fields in the order the Node
// recorder's stripTrace and redaction left them: receivedOn and metadata after
// the rest, the message last when redacted. A receivedOn the EdgePort couldn't
// name is left out; metadata is always there, as proto-loader always filled it.
func (e *Encoder) appendRequest(b []byte, req *processor.MessageRequest, messageLast bool) []byte {
	m := req.ProtoReflect()
	p := e.plan(m.Descriptor())
	b = append(b, '{')
	first := true
	field := func(f fieldPlan) {
		if !first {
			b = append(b, ',')
		}
		first = false
		b = append(b, f.key...)
		b = e.appendField(b, m, f.desc)
	}
	for _, f := range p.fixed {
		switch f.desc.Name() {
		case "metadata", "received_on":
			continue
		case "message":
			if messageLast {
				continue
			}
		}
		field(f)
	}
	if req.GetReceivedOn() != nil {
		field(p.byName["received_on"])
	}
	field(p.byName["metadata"])
	if messageLast {
		field(p.byName["message"])
	}
	return append(b, '}')
}

func appendStringMap(b []byte, m map[string]string) []byte {
	b = append(b, '{')
	for i, k := range sortedStrings(m) {
		if i > 0 {
			b = append(b, ',')
		}
		b = appendString(b, k)
		b = append(b, ':')
		b = appendString(b, m[k])
	}
	return append(b, '}')
}

func appendComponent(b []byte, c Component) []byte {
	b = append(b, `{"ref":`...)
	b = appendString(b, c.Ref)
	if c.Version != "" {
		b = append(b, `,"version":`...)
		b = appendString(b, c.Version)
	}
	return append(b, '}')
}

func appendChange(b []byte, c HeaderChange) []byte {
	b = append(b, `{"from":`...)
	b = appendString(b, c.From)
	b = append(b, `,"to":`...)
	b = appendString(b, c.To)
	return append(b, '}')
}

func appendHeaderValues(b []byte, values []HeaderValue) []byte {
	b = append(b, '{')
	for i, v := range values {
		if i > 0 {
			b = append(b, ',')
		}
		b = appendString(b, v.Name)
		b = append(b, ':')
		b = appendString(b, v.Value)
	}
	return append(b, '}')
}

func appendDiff(b []byte, d *Diff) []byte {
	b = append(b, `{"headers":{"added":`...)
	b = appendHeaderValues(b, d.Added)
	b = append(b, `,"removed":`...)
	b = appendHeaderValues(b, d.Removed)
	b = append(b, `,"changed":{`...)
	for i, c := range d.Changed {
		if i > 0 {
			b = append(b, ',')
		}
		b = appendString(b, c.Name)
		b = append(b, ':')
		b = appendChange(b, c.HeaderChange)
	}
	b = append(b, "}}"...)
	if d.RequestURI != nil {
		b = append(b, `,"requestUri":`...)
		b = appendChange(b, *d.RequestURI)
	}
	return append(b, '}')
}

func appendHop(b []byte, h *Hop) []byte {
	b = append(b, `{"component":`...)
	b = appendString(b, h.Component)
	b = append(b, `,"kind":`...)
	b = appendString(b, string(h.Kind))
	if h.Version != "" {
		b = append(b, `,"version":`...)
		b = appendString(b, h.Version)
	}
	b = append(b, `,"durationMs":`...)
	b = appendNumber(b, h.DurationMs)
	b = append(b, `,"action":`...)
	b = appendString(b, string(h.Action))
	if h.Diff != nil {
		b = append(b, `,"diff":`...)
		b = appendDiff(b, h.Diff)
	}
	if h.Error != "" {
		b = append(b, `,"error":`...)
		b = appendString(b, h.Error)
	}
	if len(h.Metadata) > 0 {
		b = append(b, `,"metadata":`...)
		b = appendStringMap(b, h.Metadata)
	}
	return append(b, '}')
}

func appendFinding(b []byte, f *Finding) []byte {
	b = append(b, `{"rule":`...)
	b = appendString(b, f.Rule)
	b = append(b, `,"profile":`...)
	b = appendString(b, string(f.Profile))
	b = append(b, `,"severity":`...)
	b = appendString(b, string(f.Severity))
	b = append(b, `,"spec":`...)
	b = appendString(b, f.Spec)
	b = append(b, `,"message":`...)
	b = appendString(b, f.Message)
	b = append(b, `,"side":`...)
	b = appendString(b, string(f.Side))
	if f.Header != "" {
		b = append(b, `,"header":`...)
		b = appendString(b, f.Header)
	}
	return append(b, '}')
}

// AppendRecord appends the record as one JSON line, without the newline.
func (e *Encoder) AppendRecord(b []byte, r *Record) []byte {
	b = append(b, `{"traceVersion":`...)
	b = strconv.AppendInt(b, Version, 10)
	b = append(b, `,"recordedAt":`...)
	b = appendString(b, r.RecordedAt)
	b = append(b, `,"callId":`...)
	b = appendString(b, r.CallID)
	b = append(b, `,"seq":`...)
	b = strconv.AppendInt(b, int64(r.Seq), 10)
	b = append(b, `,"tOffsetMs":`...)
	b = appendNumber(b, r.TOffsetMs)
	b = append(b, `,"kind":`...)
	b = appendString(b, string(r.Kind))
	b = append(b, `,"method":`...)
	b = appendString(b, r.Method)
	if r.Status != 0 {
		b = append(b, `,"status":`...)
		b = strconv.AppendInt(b, int64(r.Status), 10)
	}
	b = append(b, `,"edgePort":`...)
	b = appendComponent(b, r.EdgePort)
	b = append(b, `,"dispatcher":`...)
	b = appendComponent(b, r.Dispatcher)
	if r.TrunkRef != "" {
		b = append(b, `,"trunkRef":`...)
		b = appendString(b, r.TrunkRef)
	}
	b = append(b, `,"request":`...)
	b = e.appendRequest(b, r.Request, r.MessageLast)
	b = append(b, `,"hops":[`...)
	for i := range r.Hops {
		if i > 0 {
			b = append(b, ',')
		}
		b = appendHop(b, &r.Hops[i])
	}
	b = append(b, `],"response":`...)
	if r.Response == nil {
		b = append(b, "null"...)
	} else {
		b = append(b, `{"message":`...)
		b = e.appendMessage(b, r.Response.Message.ProtoReflect())
		if len(r.Response.Metadata) > 0 {
			b = append(b, `,"metadata":`...)
			b = appendStringMap(b, r.Response.Metadata)
		}
		b = append(b, '}')
	}
	b = append(b, `,"outcome":`...)
	b = appendString(b, string(r.Outcome))
	b = append(b, `,"totalMs":`...)
	b = appendNumber(b, r.TotalMs)
	if r.Lint != nil {
		b = append(b, `,"lint":{"version":`...)
		b = appendString(b, r.Lint.Version)
		b = append(b, `,"profiles":[`...)
		for i, p := range r.Lint.Profiles {
			if i > 0 {
				b = append(b, ',')
			}
			b = appendString(b, string(p))
		}
		b = append(b, "]}"...)
	}
	if r.Lint != nil || len(r.Findings) > 0 {
		b = append(b, `,"findings":[`...)
		for i := range r.Findings {
			if i > 0 {
				b = append(b, ',')
			}
			b = appendFinding(b, &r.Findings[i])
		}
		b = append(b, ']')
	}
	return append(b, '}')
}
