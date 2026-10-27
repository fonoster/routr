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
import type { z } from "zod/v4"

export interface FieldError {
  field: string
  message: string
  code: string
}

/**
 * Custom error class that wraps Zod validation errors with structured details.
 * Provides field-level errors suitable for API responses.
 */
export class ValidationError extends Error {
  public readonly code = "VALIDATION_ERROR"
  public readonly fieldErrors: FieldError[]
  public readonly zodError: z.ZodError

  /**
   * Constructs a new ValidationError.
   *
   * @param {z.ZodError} zodError - The error Zod returned
   */
  constructor(zodError: z.ZodError) {
    const fieldErrors = ValidationError.extractFieldErrors(zodError)
    const message = ValidationError.formatMessage(fieldErrors)

    super(message)
    this.name = "ValidationError"
    this.zodError = zodError
    this.fieldErrors = fieldErrors

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError)
    }
  }

  /**
   * Extracts field-level errors from a ZodError for API responses.
   *
   * @param {z.ZodError} zodError - The error Zod returned
   * @return {FieldError[]} One entry per failed field
   */
  private static extractFieldErrors(zodError: z.ZodError): FieldError[] {
    return zodError.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      code: issue.code
    }))
  }

  /**
   * Builds a single human-readable message from the field errors.
   *
   * @param {FieldError[]} fieldErrors - The failed fields
   * @return {string} The message
   */
  private static formatMessage(fieldErrors: FieldError[]): string {
    if (fieldErrors.length === 0) return "Validation failed"
    return fieldErrors
      .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
      .join("; ")
  }
}
