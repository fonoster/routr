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

// Package sipconv maps SIP messages to the gRPC SIPMessage and back, with the
// field semantics of the Java EdgePort's io.routr.headers.MessageConverter:
// the processors depend on them.
package sipconv

import "strings"

// The header names JAIN-SIP (gov.nist) parses, in the case it reports them.
// JAIN-SIP gives a known header its canonical name whatever case or compact form
// arrived on the wire; an unknown header keeps the name it arrived with.
var canonicalNames = map[string]string{}

// Compact forms (RFC 3261 section 7.3.3 and extensions JAIN-SIP knows)
var compactNames = map[string]string{
	"a": "Accept-Contact",
	"b": "Referred-By",
	"c": "Content-Type",
	"e": "Content-Encoding",
	"f": "From",
	"i": "Call-ID",
	"k": "Supported",
	"l": "Content-Length",
	"m": "Contact",
	"o": "Event",
	"r": "Refer-To",
	"s": "Subject",
	"t": "To",
	"u": "Allow-Events",
	"v": "Via",
	"x": "Session-Expires",
}

// Headers JAIN-SIP holds in a list (SIPHeaderList): one value per comma (or per
// semicolon for Privacy). Each value is its own Extension in a SIPMessage, and
// several values of one name are encoded joined on one line.
var listSeparators = map[string]byte{
	"Accept":                ',',
	"Accept-Encoding":       ',',
	"Accept-Language":       ',',
	"Alert-Info":            ',',
	"Allow":                 ',',
	"Allow-Events":          ',',
	"Call-Info":             ',',
	"Content-Encoding":      ',',
	"Content-Language":      ',',
	"Error-Info":            ',',
	"In-Reply-To":           ',',
	"Proxy-Require":         ',',
	"Require":               ',',
	"Supported":             ',',
	"Unsupported":           ',',
	"Warning":               ',',
	"P-Asserted-Identity":   ',',
	"P-Preferred-Identity":  ',',
	"P-Associated-URI":      ',',
	"P-Media-Authorization": ',',
	"P-Visited-Network-ID":  ',',
	"Path":                  ',',
	"Service-Route":         ',',
	"Reason":                ',',
	"Security-Client":       ',',
	"Security-Server":       ',',
	"Security-Verify":       ',',
	"Privacy":               ';',
}

// Headers JAIN-SIP keeps one of (not a SIPHeaderList). Adding one to a message
// that already has it is ignored (SIPMessage.attachHeader).
var singletons = map[string]bool{}

func init() {
	known := []string{
		"Accept", "Accept-Encoding", "Accept-Language", "Alert-Info", "Allow",
		"Allow-Events", "Authentication-Info", "Authorization", "Call-ID",
		"Call-Info", "Contact", "Content-Disposition", "Content-Encoding",
		"Content-Language", "Content-Length", "Content-Type", "CSeq", "Date",
		"Error-Info", "Event", "Expires", "From", "In-Reply-To", "Max-Forwards",
		"MIME-Version", "Min-Expires", "Organization", "Priority",
		"Proxy-Authenticate", "Proxy-Authorization", "Proxy-Require", "RAck",
		"Reason", "Record-Route", "Referred-By", "Refer-To", "Reply-To",
		"Require", "Retry-After", "Route", "RSeq", "Server", "Subject",
		"Subscription-State", "Supported", "Timestamp", "To", "Unsupported",
		"User-Agent", "Via", "Warning", "WWW-Authenticate", "SIP-ETag",
		"SIP-If-Match", "Session-Expires", "Min-SE", "Replaces", "Join",
		"References", "Privacy", "P-Asserted-Identity", "P-Preferred-Identity",
		"P-Access-Network-Info", "P-Associated-URI", "P-Called-Party-ID",
		"P-Charging-Function-Addresses", "P-Charging-Vector",
		"P-Media-Authorization", "Path", "P-Visited-Network-ID",
		"Security-Client", "Security-Server", "Security-Verify",
		"Service-Route", "P-Asserted-Service", "P-Preferred-Service",
		"P-Served-User", "P-Profile-Key", "P-User-Database",
	}
	for _, name := range known {
		canonicalNames[strings.ToLower(name)] = name
	}
	for _, name := range []string{
		"From", "To", "Call-ID", "CSeq", "Max-Forwards", "Content-Length",
		"Content-Type", "Expires", "Min-Expires", "Date", "Timestamp",
		"User-Agent", "Server", "Organization", "Priority", "Subject",
		"Reply-To", "Retry-After", "MIME-Version", "Content-Disposition",
		"Event", "Subscription-State", "Refer-To", "Referred-By", "RAck",
		"RSeq", "Session-Expires", "Min-SE", "Replaces", "Join", "SIP-ETag",
		"SIP-If-Match", "P-Called-Party-ID", "P-Charging-Vector",
		"P-Charging-Function-Addresses", "P-Access-Network-Info",
		"Authentication-Info", "P-Asserted-Service", "P-Preferred-Service",
		"P-Served-User", "P-Profile-Key", "P-User-Database", "References",
	} {
		singletons[name] = true
	}
}

// CanonicalName returns the name JAIN-SIP reports for a header: its canonical
// name when it is a header JAIN-SIP knows (including compact forms), and the
// name as received otherwise.
func CanonicalName(name string) string {
	lower := strings.ToLower(strings.TrimSpace(name))
	if full, ok := compactNames[lower]; ok {
		return full
	}
	if canonical, ok := canonicalNames[lower]; ok {
		return canonical
	}
	return strings.TrimSpace(name)
}

// IsKnown tells whether JAIN-SIP parses the header (as opposed to keeping it as
// an extension header).
func IsKnown(name string) bool {
	_, ok := canonicalNames[strings.ToLower(CanonicalName(name))]
	return ok
}

// ListSeparator returns the separator of a list header, or 0 when the header
// holds a single value.
func ListSeparator(name string) byte {
	return listSeparators[CanonicalName(name)]
}

// IsSingleton tells whether a message keeps a single header of this name.
func IsSingleton(name string) bool {
	return singletons[CanonicalName(name)]
}
