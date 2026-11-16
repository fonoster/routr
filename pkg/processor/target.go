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

package processor

import (
	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The address-of-record functions of mods/processor/src/target.ts.

// DefaultExpires is how long a REGISTER binds when it carries neither a
// Contact expires parameter nor an Expires header (RFC 3261 section 10.3,
// step 7).
const DefaultExpires int32 = 3600

// AOR is the address of record a URI names: sip:user@host, sip:host without
// a user, sips for a secure URI.
func AOR(uri *sipmessage.SipURI) string {
	scheme := "sip"
	if uri.GetSecure() {
		scheme = "sips"
	}
	if uri.GetUser() != "" {
		return scheme + ":" + uri.GetUser() + "@" + uri.GetHost()
	}
	return scheme + ":" + uri.GetHost()
}

// TargetAOR is the address of record the request's To names.
func TargetAOR(req *MessageRequest) string {
	return AOR(req.GetMessage().GetTo().GetAddress().GetUri())
}

// TargetExpires is how long a REGISTER asks to be bound for: the Contact's
// expires parameter takes precedence over the Expires header, and def (which
// a caller usually passes DefaultExpires for) is the answer when neither
// names one.
func TargetExpires(req *MessageRequest, def int32) int32 {
	expires := int32(-1)
	if c := req.GetMessage().GetContact(); c != nil {
		expires = c.GetExpires()
	}
	if expires > -1 {
		return expires
	}
	if e := req.GetMessage().GetExpires(); e != nil && e.GetExpires() > -1 {
		return e.GetExpires()
	}
	return def
}
