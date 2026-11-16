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

package location

import (
	"errors"
	"testing"

	"google.golang.org/grpc/codes"
)

// The codes and messages of mods/location/src/errors.ts and the
// BadRequestError of mods/common/src/errors.ts.

func TestErrors(t *testing.T) {
	cases := []struct {
		name    string
		err     error
		code    codes.Code
		message string
	}{
		{
			"unsupported schema", errUnsupportedSchema("tel:1001"), codes.InvalidArgument,
			`aor tel:1001 has an invalid schema, only "sip:" or "backend:" are allowed`,
		},
		{
			"no routes", errNoRoutesFound("sip:1001@sip.local"), codes.NotFound,
			"no routes found for aor: sip:1001@sip.local",
		},
		{"max contacts", errMaxContacts(2), codes.InvalidArgument, "exceeds maximum of 2 allowed contacts"},
		{"missing route", errMissingRoute(), codes.InvalidArgument, "route is required"},
		{"store", errStore("put", errors.New("down")), codes.Unavailable, "location store put: down"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assertStatus(t, c.err, c.code, c.message)
		})
	}
}
