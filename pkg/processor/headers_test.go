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

import "testing"

// The cases of mods/processor/test/extensions.unit.test.ts.

func TestHeaderValue(t *testing.T) {
	req := exampleRequest()
	if got := HeaderValue(req, "Allow"); got != "INVITE" {
		t.Errorf("Allow = %q", got)
	}
	if got := HeaderValue(req, "allow"); got != "INVITE" {
		t.Errorf("case-insensitive lookup = %q", got)
	}
	if got := HeaderValue(req, "Allowx"); got != "" {
		t.Errorf("a missing header = %q", got)
	}
}

func TestUpdateHeader(t *testing.T) {
	req := exampleRequest()
	UpdateHeader(req, Header{Name: "Allow", Value: "REGISTER"})
	if got := HeaderValue(req, "Allow"); got != "REGISTER" {
		t.Errorf("Allow = %q", got)
	}
	if len(req.GetMessage().GetExtensions()) != 4 {
		t.Errorf("extensions = %v", req.GetMessage().GetExtensions())
	}
	// The exact name, as the Node twin
	UpdateHeader(req, Header{Name: "allow", Value: "INVITE"})
	if got := HeaderValue(req, "Allow"); got != "REGISTER" {
		t.Errorf("a name in another case updated the header: %q", got)
	}
	// A header the request doesn't have is not added
	UpdateHeader(req, Header{Name: "X-Room", Value: "lobby"})
	if got := HeaderValue(req, "X-Room"); got != "" {
		t.Errorf("X-Room = %q", got)
	}
}

func TestAddHeader(t *testing.T) {
	req := exampleRequest()
	AddHeader(req, Header{Name: "X-Room", Value: "lobby"})
	exts := req.GetMessage().GetExtensions()
	if len(exts) != 5 || exts[4].GetName() != "X-Room" || exts[4].GetValue() != "lobby" {
		t.Errorf("extensions = %v", exts)
	}
}

func TestRemoveHeader(t *testing.T) {
	req := exampleRequest()
	RemoveHeader(req, "Allow")
	if got := HeaderValue(req, "Allow"); got != "" {
		t.Errorf("Allow = %q", got)
	}
	if len(req.GetMessage().GetExtensions()) != 3 {
		t.Errorf("extensions = %v", req.GetMessage().GetExtensions())
	}
	// The exact name, as the Node twin
	RemoveHeader(req, "cseq")
	if got := HeaderValue(req, "CSeq"); got == "" {
		t.Error("a name in another case removed the header")
	}
}
