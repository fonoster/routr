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

package data

import (
	"errors"
	"fmt"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestToStatus(t *testing.T) {
	tests := []struct {
		err     error
		code    codes.Code
		message string
	}{
		{nil, codes.OK, ""},
		{&NotFoundError{Ref: "x"}, codes.NotFound, "Resource not found: x"},
		{fmt.Errorf("wrapped: %w", &NotFoundError{Ref: "x"}), codes.NotFound, "Resource not found: x"},
		{&BadRequestError{Message: "parameter ref is required"}, codes.InvalidArgument, "parameter ref is required"},
		{&BadRequestError{}, codes.InvalidArgument, "Bad request"},
		{status.Error(codes.Unavailable, "Service unavailable"), codes.Unavailable, "Service unavailable"},
		{errors.New("boom"), codes.Unknown, "boom"},
		{unimplemented(), codes.Unimplemented, unimplementedMessage},
	}
	for _, tt := range tests {
		got := toStatus(tt.err)
		if tt.err == nil {
			if got != nil {
				t.Errorf("toStatus(nil) = %v", got)
			}
			continue
		}
		st, ok := status.FromError(got)
		if !ok || st.Code() != tt.code || st.Message() != tt.message {
			t.Errorf("toStatus(%v) = %v, want %s %q", tt.err, got, tt.code, tt.message)
		}
	}
}
