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
package sipconv

import (
	pb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// The status codes of io.routr.headers.ResponseCode, by ResponseType.
var codeByType = map[pb.ResponseType]int{
	pb.ResponseType_UNKNOWN:                            -1,
	pb.ResponseType_TRYING:                             100,
	pb.ResponseType_RINGING:                            180,
	pb.ResponseType_CALL_IS_BEING_FORWARDED:            181,
	pb.ResponseType_QUEUED:                             182,
	pb.ResponseType_SESSION_PROGRESS:                   183,
	pb.ResponseType_OK:                                 200,
	pb.ResponseType_ACCEPTED:                           202,
	pb.ResponseType_MULTIPLE_CHOICES:                   300,
	pb.ResponseType_MOVED_PERMANENTLY:                  301,
	pb.ResponseType_MOVED_TEMPORARILY:                  302,
	pb.ResponseType_USE_PROXY:                          305,
	pb.ResponseType_ALTERNATIVE_SERVICE:                380,
	pb.ResponseType_BAD_REQUEST:                        400,
	pb.ResponseType_UNAUTHORIZED:                       401,
	pb.ResponseType_PAYMENT_REQUIRED:                   402,
	pb.ResponseType_FORBIDDEN:                          403,
	pb.ResponseType_NOT_FOUND:                          404,
	pb.ResponseType_METHOD_NOT_ALLOWED:                 405,
	pb.ResponseType_NOT_ACCEPTABLE:                     406,
	pb.ResponseType_PROXY_AUTHENTICATION_REQUIRED:      407,
	pb.ResponseType_REQUEST_TIMEOUT:                    408,
	pb.ResponseType_GONE:                               410,
	pb.ResponseType_REQUEST_ENTITY_TOO_LARGE:           413,
	pb.ResponseType_REQUEST_URI_TOO_LONG:               414,
	pb.ResponseType_UNSUPPORTED_MEDIA_TYPE:             415,
	pb.ResponseType_UNSUPPORTED_URI_SCHEME:             416,
	pb.ResponseType_BAD_EXTENSION:                      420,
	pb.ResponseType_EXTENSION_REQUIRED:                 421,
	pb.ResponseType_INTERVAL_TOO_BRIEF:                 423,
	pb.ResponseType_TEMPORARILY_UNAVAILABLE:            480,
	pb.ResponseType_CALL_OR_TRANSACTION_DOES_NOT_EXIST: 481,
	pb.ResponseType_LOOP_DETECTED:                      482,
	pb.ResponseType_TOO_MANY_HOPS:                      483,
	pb.ResponseType_ADDRESS_INCOMPLETE:                 484,
	pb.ResponseType_AMBIGUOUS:                          485,
	pb.ResponseType_BUSY_HERE:                          486,
	pb.ResponseType_REQUEST_TERMINATED:                 487,
	pb.ResponseType_NOT_ACCEPTABLE_HERE:                488,
	pb.ResponseType_BAD_EVENT:                          489,
	pb.ResponseType_REQUEST_PENDING:                    491,
	pb.ResponseType_UNDECIPHERABLE:                     493,
	pb.ResponseType_SERVER_INTERNAL_ERROR:              500,
	pb.ResponseType_NOT_IMPLEMENTED:                    501,
	pb.ResponseType_BAD_GATEWAY:                        502,
	pb.ResponseType_SERVICE_UNAVAILABLE:                503,
	pb.ResponseType_SERVER_TIMEOUT:                     504,
	pb.ResponseType_VERSION_NOT_SUPPORTED:              505,
	pb.ResponseType_MESSAGE_TOO_LARGE:                  513,
	pb.ResponseType_BUSY_EVERYWHERE:                    600,
	pb.ResponseType_DECLINE:                            603,
	pb.ResponseType_DOES_NOT_EXIST_ANYWHERE:            604,
	pb.ResponseType_SESSION_NOT_ACCEPTABLE:             606,
}

var typeByCode = map[int]pb.ResponseType{}

func init() {
	for t, code := range codeByType {
		typeByCode[code] = t
	}
}

// CodeOf returns the status code of a ResponseType (-1 for UNKNOWN and for the
// types with no code, such as SUCCESS).
func CodeOf(t pb.ResponseType) int {
	if code, ok := codeByType[t]; ok {
		return code
	}
	return -1
}

// TypeOf returns the ResponseType of a status code and whether it has one.
// The Java EdgePort fails on a code ResponseCode does not list (for example
// 422); this one reports UNKNOWN instead, so such a response is still relayed.
func TypeOf(code int) (pb.ResponseType, bool) {
	t, ok := typeByCode[code]
	if !ok {
		return pb.ResponseType_UNKNOWN, false
	}
	return t, true
}
