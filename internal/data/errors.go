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
	// Cause is set when the database refused the request, not a validation:
	// the store's error, with the SQL. It is for the log, never for the
	// client, and errors.As does not reach it.
	Cause error
}

func (e *BadRequestError) Error() string {
	if e.Message == "" {
		return "Bad request"
	}
	return e.Message
}

// AlreadyExistsError is a write a unique value refused: gRPC ALREADY_EXISTS
// with the message of @routr/common's ResourceAlreadyExistsError.
type AlreadyExistsError struct {
	Message string
}

func (e *AlreadyExistsError) Error() string {
	if e.Message == "" {
		return "Resource already exists"
	}
	return e.Message
}

// StoreError is a failure of the backend itself: a query the database
// refused, a connection that dropped, a row that would not map. Its text
// names the SQL and the driver's error, which is for the log, never for the
// client: toStatus answers a fixed message, as pgdata did for what Prisma
// threw.
type StoreError struct {
	// Unavailable is set when the database could not be reached, the
	// PrismaClientInitializationError of pgdata
	Unavailable bool
	Err         error
}

func (e *StoreError) Error() string { return e.Err.Error() }

// Unwrap exposes the cause to errors.Is and errors.As.
func (e *StoreError) Unwrap() error { return e.Err }

// The fixed messages pgdata answered for a failure of the database
// (mods/pgdata/src/api/get.ts on main).
const (
	unavailableMessage = "Service unavailable"
	unknownMessage     = "Unknown error"
)

// unimplementedMessage is @routr/common's UnimplementedError message, which
// simpledata answered for every write.
const unimplementedMessage = "This operation is not supported/enabled in this data api implementation."

// unimplemented is a read-only backend's answer to every write.
func unimplemented() error {
	return status.Error(codes.Unimplemented, unimplementedMessage)
}

// toStatus maps a Store error to the gRPC status the Node service answered:
// NotFoundError to NOT_FOUND, BadRequestError to INVALID_ARGUMENT,
// AlreadyExistsError to ALREADY_EXISTS, a status error as it is, a StoreError to UNAVAILABLE "Service unavailable" when the
// database could not be reached and UNKNOWN "Unknown error" otherwise, and
// anything else to UNKNOWN "Unknown error" too. The client never reads the
// SQL or the driver's text; the service logs it (Data.fail).
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
	var exists *AlreadyExistsError
	if errors.As(err, &exists) {
		return status.Error(codes.AlreadyExists, exists.Error())
	}
	if _, ok := status.FromError(err); ok {
		return err
	}
	var store *StoreError
	if errors.As(err, &store) && store.Unavailable {
		return status.Error(codes.Unavailable, unavailableMessage)
	}
	return status.Error(codes.Unknown, unknownMessage)
}
