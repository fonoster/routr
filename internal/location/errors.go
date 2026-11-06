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
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// The gRPC answers of the Node service (mods/location/src/errors.ts and
// mods/common/src/errors.ts), code and message alike, so the SDK, rctl and
// the Node Connect see no difference.

// errUnsupportedSchema is UnsupportedSchema: an AOR with a scheme other than
// "sip:" or "backend:".
func errUnsupportedSchema(aor string) error {
	return status.Errorf(codes.InvalidArgument,
		`aor %s has an invalid schema, only "sip:" or "backend:" are allowed`, aor)
}

// errNoRoutesFound is NotRoutesFoundForAOR: a lookup with no live route.
func errNoRoutesFound(aor string) error {
	return status.Errorf(codes.NotFound, "no routes found for aor: %s", aor)
}

// errMaxContacts is the BadRequestError AddRoute answers past maxContacts.
func errMaxContacts(maxContacts int32) error {
	return status.Errorf(codes.InvalidArgument,
		"exceeds maximum of %d allowed contacts", maxContacts)
}

// errMissingRoute answers an AddRoute that carries no route. The Node service
// crashed on it (TypeError, gRPC UNKNOWN); a clear argument error is better.
func errMissingRoute() error {
	return status.Error(codes.InvalidArgument, "route is required")
}

// errStore wraps a store failure as an UNAVAILABLE answer: the caller can
// retry and the message names the operation.
func errStore(op string, err error) error {
	return status.Error(codes.Unavailable, fmt.Sprintf("location store %s: %v", op, err))
}
