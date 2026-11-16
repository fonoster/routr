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
	"testing"

	"github.com/fonoster/routr/pkg/processor/pb/sipmessage"
)

// The cases of mods/processor/test/target.unit.test.ts.

func TestAOR(t *testing.T) {
	req := exampleRequest()
	if got := AOR(req.GetMessage().GetRequestUri()); got != "sip:sip.local" {
		t.Errorf("AOR(requestUri) = %q", got)
	}
	if got := TargetAOR(req); got != "sip:1001@sip.local" {
		t.Errorf("TargetAOR() = %q", got)
	}
	if got := AOR(&sipmessage.SipURI{User: "1001", Host: "sip.local", Secure: true}); got != "sips:1001@sip.local" {
		t.Errorf("AOR(secure) = %q", got)
	}
}

func TestTargetExpires(t *testing.T) {
	t.Run("from the Expires header", func(t *testing.T) {
		if got := TargetExpires(exampleRequest(), DefaultExpires); got != 60 {
			t.Errorf("expires = %d", got)
		}
	})
	t.Run("the Contact's expires takes precedence", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Contact.Expires = 600
		if got := TargetExpires(req, DefaultExpires); got != 600 {
			t.Errorf("expires = %d", got)
		}
	})
	t.Run("a Contact expires of 0 unregisters", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Contact.Expires = 0
		if got := TargetExpires(req, DefaultExpires); got != 0 {
			t.Errorf("expires = %d", got)
		}
	})
	t.Run("the default when none is present", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Expires = nil
		if got := TargetExpires(req, DefaultExpires); got != 3600 {
			t.Errorf("expires = %d", got)
		}
		if got := TargetExpires(req, 120); got != 120 {
			t.Errorf("expires = %d, want the given default", got)
		}
	})
	t.Run("the default without a Contact", func(t *testing.T) {
		req := exampleRequest()
		req.Message.Contact = nil
		req.Message.Expires = nil
		if got := TargetExpires(req, 120); got != 120 {
			t.Errorf("expires = %d", got)
		}
	})
}
