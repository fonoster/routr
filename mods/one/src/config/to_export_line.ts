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
import { CommonErrors } from "@routr/common"

export const toExportLineSchema = z.object({
  name: z
    .string({ error: "name must be an env var name" })
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, {
      error: "name must be an env var name"
    }),
  value: z.string({ error: "value must be a string" })
})

export type ToExportLineParams = z.infer<typeof toExportLineSchema>

/**
 * Writes an env var as a POSIX sh export line whose value is single-quoted, so
 * eval sets it verbatim: nothing in it is expanded or run.
 *
 * @param {ToExportLineParams} params - The env var name and its value
 * @return {string} The line, e.g. export NAME='it'\''s'
 */
export function toExportLine(params: ToExportLineParams): string {
  const parsed = toExportLineSchema.safeParse(params)

  if (!parsed.success) {
    throw new CommonErrors.ValidationError(parsed.error)
  }

  const { name, value } = parsed.data

  return `export ${name}='${value.replace(/'/g, "'\\''")}'`
}
