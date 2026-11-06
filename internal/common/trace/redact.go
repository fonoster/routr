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
	"strings"

	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// Redacted replaces a credential in a recording.
const Redacted = "REDACTED"

func isSecretHeader(name string) bool {
	switch strings.ToLower(name) {
	case "authorization", "proxy-authorization", "x-gateway-auth":
		return true
	}
	return false
}

func redactURI(uri *sipmessage.SipURI) {
	if uri.GetUserPassword() != "" {
		uri.UserPassword = Redacted
	}
}

// RedactMessage returns a deep copy of the message with credentials replaced
// by Redacted. The digest response is the hash of the password and the only
// secret in a Digest exchange; nonce, realm and username stay so the exchange
// remains readable.
func RedactMessage(message *sipmessage.SIPMessage) *sipmessage.SIPMessage {
	if message == nil {
		return nil
	}
	c := proto.Clone(message).(*sipmessage.SIPMessage)
	if auth := c.GetAuthorization(); auth != nil {
		auth.Response = Redacted
		if auth.GetCNonce() != "" {
			auth.CNonce = Redacted
		}
	}
	for _, ext := range c.GetExtensions() {
		if isSecretHeader(ext.GetName()) {
			ext.Value = Redacted
		}
	}
	redactURI(c.GetFrom().GetAddress().GetUri())
	redactURI(c.GetTo().GetAddress().GetUri())
	redactURI(c.GetContact().GetAddress().GetUri())
	for _, r := range c.GetRoute() {
		redactURI(r.GetAddress().GetUri())
	}
	for _, r := range c.GetRecordRoute() {
		redactURI(r.GetAddress().GetUri())
	}
	redactURI(c.GetRequestUri())
	return c
}
