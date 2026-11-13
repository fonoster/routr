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
import { z } from "zod/v4"
import { ValidationError } from "./validation_error"

/**
 * Wraps a function so its input is validated before it runs: the door of every
 * validated function. Invalid input never reaches fn.
 *
 * @param {Function} fn - the function, typed with the schema's output
 * @param {z.ZodType} schema - the schema its input must satisfy
 * @return {Function} fn behind the validation
 * @throws {ValidationError} from the returned function, when the input is invalid
 */
export function withErrorHandlingAndValidation<
  TSchema extends z.ZodType,
  TResult
>(
  fn: (params: z.infer<TSchema>) => Promise<TResult>,
  schema: TSchema
): (params: unknown) => Promise<TResult> {
  return async (params: unknown) => {
    const result = schema.safeParse(params)

    if (!result.success) {
      throw new ValidationError(result.error)
    }

    return fn(result.data)
  }
}
