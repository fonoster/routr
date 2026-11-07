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

package dispatcher

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// The errors the dispatcher answers with, as gRPC statuses with the codes and
// messages of mods/dispatcher/src/errors.ts, so the EdgePort maps them as it
// maps the Node dispatcher's.

// errNotMatchingProcessor is NotMatchingProcessorFound: no processor takes
// the request (NOT_FOUND).
func errNotMatchingProcessor(ref string) error {
	return status.Errorf(codes.NotFound, "not matching processor found for request ref: %s", ref)
}

// errProcessorUnavailable is ProcessorUnavailableError: the matched
// processor could not be reached (UNAVAILABLE).
func errProcessorUnavailable(ref string) error {
	return status.Errorf(codes.Unavailable, "processor ref = %s is unavailable", ref)
}

// errMiddlewareUnavailable is MiddlewareUnavailableError: a middleware
// could not be reached (UNAVAILABLE).
func errMiddlewareUnavailable(ref string) error {
	return status.Errorf(codes.Unavailable, "middleware ref = %s is unavailable", ref)
}

// errMiddlewareFailed is what the Node dispatcher's uncaught TypeError became
// on the wire (UNKNOWN) when a middleware failed with any other status or
// answered without a message.
func errMiddlewareFailed(ref string, cause error) error {
	return status.Errorf(codes.Unknown, "middleware ref = %s failed: %v", ref, cause)
}

// errMatchFuncFailed is what a throwing matchFunc became on the wire (UNKNOWN).
func errMatchFuncFailed(ref string, cause error) error {
	return status.Errorf(codes.Unknown, "matchFunc of processor ref = %s failed: %v", ref, cause)
}

// isUnavailable tells whether a backend call failed with UNAVAILABLE, the
// only status the Node dispatcher turned into its own error.
func isUnavailable(err error) bool {
	return status.Code(err) == codes.Unavailable
}

// statusMessage is the message of an error without gRPC's framing, what a
// recording's hop says went wrong.
func statusMessage(err error) string {
	return status.Convert(err).Message()
}
