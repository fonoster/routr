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
	"fmt"
	"sort"
	"strconv"
	"strings"

	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// FormatURI renders a SIP URI the way it appears on the wire. Like the Node
// recorder it prints any port that isn't 0, so an unset port of the Java
// converter's reads :-1 in a diff, as it does in the corpus.
func FormatURI(uri *pb.SipURI) string {
	if uri == nil {
		return ""
	}
	var b strings.Builder
	b.WriteString("sip")
	if uri.GetSecure() {
		b.WriteByte('s')
	}
	b.WriteByte(':')
	if uri.GetUser() != "" {
		b.WriteString(uri.GetUser())
		b.WriteByte('@')
	}
	b.WriteString(uri.GetHost())
	if uri.GetPort() != 0 {
		b.WriteByte(':')
		b.WriteString(strconv.Itoa(int(uri.GetPort())))
	}
	if uri.GetTransportParam() != "" {
		b.WriteString(";transport=" + strings.ToLower(uri.GetTransportParam()))
	}
	if uri.GetUserParam() != "" {
		b.WriteString(";user=" + uri.GetUserParam())
	}
	if uri.GetLrParam() {
		b.WriteString(";lr")
	}
	if uri.GetMethodParam() != "" {
		b.WriteString(";method=" + uri.GetMethodParam())
	}
	return b.String()
}

func formatAddress(address *pb.Address) string {
	if address == nil {
		return ""
	}
	name := ""
	if address.GetDisplayName() != "" {
		name = `"` + address.GetDisplayName() + `" `
	}
	return name + "<" + FormatURI(address.GetUri()) + ">"
}

func formatVia(via *pb.Via) string {
	var b strings.Builder
	fmt.Fprintf(&b, "SIP/2.0/%s %s:%d", via.GetTransport(), via.GetHost(), via.GetPort())
	if via.GetBranch() != "" {
		b.WriteString(";branch=" + via.GetBranch())
	}
	if via.GetReceived() != "" {
		b.WriteString(";received=" + via.GetReceived())
	}
	switch {
	case via.GetRPort() != 0:
		b.WriteString(";rport=" + strconv.Itoa(int(via.GetRPort())))
	case via.GetRPortFlag():
		b.WriteString(";rport")
	}
	return b.String()
}

// sortedStrings returns the keys of a map in order. Proto maps have none, and
// a diff must not report a reordering as a change.
func sortedStrings(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func appendParam(b *strings.Builder, key, value string) {
	b.WriteByte(';')
	b.WriteString(key)
	if value != "" {
		b.WriteByte('=')
		b.WriteString(value)
	}
}

// withParams renders an address and its parameters. A tag comes first, and a
// tag among the parameters wins over the field, as the object spread of
// diff.ts has it.
func withParams(address *pb.Address, tag string, parameters map[string]string) string {
	var b strings.Builder
	b.WriteString(formatAddress(address))
	if tag != "" {
		if v, ok := parameters["tag"]; ok {
			tag = v
		}
		appendParam(&b, "tag", tag)
	}
	for _, k := range sortedStrings(parameters) {
		if k == "tag" && tag != "" {
			continue
		}
		appendParam(&b, k, parameters[k])
	}
	return b.String()
}

// flatHeader is one header name and its values, as on the wire.
type flatHeader struct {
	name   string
	values []string
}

func (h flatHeader) joined() string {
	return strings.Join(h.values, ", ")
}

// flatHeaders are the headers of a message in the order they first appear.
type flatHeaders struct {
	list  []flatHeader
	index map[string]int
}

func (f *flatHeaders) put(name, value string) {
	if value == "" {
		return
	}
	if i, ok := f.index[name]; ok {
		f.list[i].values = append(f.list[i].values, value)
		return
	}
	f.index[name] = len(f.list)
	f.list = append(f.list, flatHeader{name: name, values: []string{value}})
}

func (f *flatHeaders) get(name string) (flatHeader, bool) {
	i, ok := f.index[name]
	if !ok {
		return flatHeader{}, false
	}
	return f.list[i], true
}

// flatten renders a message as header name to values. Multi-valued headers
// keep one entry per line; the body is summarized by its media lines so SDP
// changes show up.
func flatten(m *pb.SIPMessage) *flatHeaders {
	f := &flatHeaders{index: map[string]int{}}
	for _, via := range m.GetVia() {
		f.put("Via", formatVia(via))
	}
	for _, r := range m.GetRoute() {
		f.put("Route", withParams(r.GetAddress(), "", r.GetParameters()))
	}
	for _, r := range m.GetRecordRoute() {
		f.put("Record-Route", withParams(r.GetAddress(), "", r.GetParameters()))
	}
	if from := m.GetFrom(); from != nil {
		f.put("From", withParams(from.GetAddress(), from.GetTag(), from.GetParameters()))
	}
	if to := m.GetTo(); to != nil {
		f.put("To", withParams(to.GetAddress(), to.GetTag(), to.GetParameters()))
	}
	if contact := m.GetContact(); contact != nil {
		f.put("Contact", formatAddress(contact.GetAddress()))
	}
	if mf := m.GetMaxForwards(); mf != nil {
		f.put("Max-Forwards", strconv.Itoa(int(mf.GetMaxForwards())))
	}
	if exp := m.GetExpires(); exp != nil {
		f.put("Expires", strconv.Itoa(int(exp.GetExpires())))
	}
	if auth := m.GetAuthorization(); auth != nil {
		f.put("Authorization", fmt.Sprintf(`Digest username="%s", realm="%s"`, auth.GetUsername(), auth.GetRealm()))
	}
	if www := m.GetWwwAuthenticate(); www != nil {
		f.put("WWW-Authenticate", fmt.Sprintf(`Digest realm="%s", nonce="%s"`, www.GetRealm(), www.GetNonce()))
	}
	for _, ext := range m.GetExtensions() {
		f.put(ext.GetName(), ext.GetValue())
	}
	var media []string
	for _, line := range strings.Split(m.GetBody(), "\n") {
		line = strings.TrimSuffix(line, "\r")
		if strings.HasPrefix(line, "m=") || strings.HasPrefix(line, "c=") {
			media = append(media, line)
		}
	}
	f.put("Body", strings.Join(media, " "))
	return f
}

// DiffMessages computes what a component changed between the message it
// received and the one it returned.
func DiffMessages(before, after *pb.SIPMessage) *Diff {
	a, b := flatten(before), flatten(after)
	diff := &Diff{}
	for _, h := range b.list {
		if _, ok := a.get(h.name); !ok {
			diff.Added = append(diff.Added, HeaderValue{Name: h.name, Value: h.joined()})
		}
	}
	for _, h := range a.list {
		other, ok := b.get(h.name)
		if !ok {
			diff.Removed = append(diff.Removed, HeaderValue{Name: h.name, Value: h.joined()})
			continue
		}
		if from, to := h.joined(), other.joined(); from != to {
			diff.Changed = append(diff.Changed, ChangedHeader{Name: h.name, HeaderChange: HeaderChange{From: from, To: to}})
		}
	}
	uriBefore, uriAfter := FormatURI(before.GetRequestUri()), FormatURI(after.GetRequestUri())
	if uriBefore != "" && uriAfter != "" && uriBefore != uriAfter {
		diff.RequestURI = &HeaderChange{From: uriBefore, To: uriAfter}
	}
	return diff
}

// IsEmpty tells whether the diff carries no change at all.
func (d *Diff) IsEmpty() bool {
	return d.RequestURI == nil && len(d.Added) == 0 && len(d.Removed) == 0 && len(d.Changed) == 0
}
