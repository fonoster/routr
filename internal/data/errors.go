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

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// NotFoundError is a lookup that found nothing: gRPC NOT_FOUND with the
// message of @routr/common's ResourceNotFoundError.
type NotFoundError struct {
	Ref string
}

func (e *NotFoundError) Error() string { return "Resource not found: " + e.Ref }

// BadRequestError is a request the API cannot serve: gRPC INVALID_ARGUMENT
// with the message of @routr/common's BadRequestError.
type BadRequestError struct {
	Message string
}

func (e *BadRequestError) Error() string {
	if e.Message == "" {
		return "Bad request"
	}
	return e.Message
}

// unimplementedMessage is @routr/common's UnimplementedError message, which
// both Node services answered for every write they did not serve, plus where
// the writes come in Routr 3.
const unimplementedMessage = "This operation is not supported/enabled in this data api implementation. " +
	"Routr 3 milestone 1 serves reads only; Create, Update and Delete arrive in milestone 2."

// unimplemented is the answer to every write in milestone 1.
func unimplemented() error {
	return status.Error(codes.Unimplemented, unimplementedMessage)
}

// toStatus maps a Store error to the gRPC status the Node service answered:
// NotFoundError to NOT_FOUND, BadRequestError to INVALID_ARGUMENT, a status
// error as it is, and anything else to UNKNOWN with its message (grpc-js
// gave an error without a code that status).
func toStatus(err error) error {
	if err == nil {
		return nil
	}
	var notFound *NotFoundError
	if errors.As(err, &notFound) {
		return status.Error(codes.NotFound, notFound.Error())
	}
	var bad *BadRequestError
	if errors.As(err, &bad) {
		return status.Error(codes.InvalidArgument, bad.Error())
	}
	if _, ok := status.FromError(err); ok {
		return err
	}
	return status.Error(codes.Unknown, err.Error())
}
