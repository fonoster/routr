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
import { NumberFormat } from "../types"

const format = z
  .enum(NumberFormat, { error: "the number format is not one Routr knows" })
  .nullish()

const prefix = z
  .string({ error: "the number prefix must be a string" })
  .nullish()

/** Schema for the number format settings a Trunk is about to be stored with. */
export const trunkNumberFormatSchema = z.object({
  calledNumberFormat: format,
  calledNumberPrefix: prefix,
  callerNumberFormat: format,
  callerNumberPrefix: prefix
})

/**
 * Schema for the number format fields of a request that creates or updates a
 * Trunk. A field the request leaves out keeps its stored value.
 */
export const assertTrunkNumberFormatSchema = trunkNumberFormatSchema.extend({
  // Absent on create
  ref: z.string({ error: "ref must be a string" }).optional()
})

export type TrunkNumberFormatInput = z.infer<typeof trunkNumberFormatSchema>
export type AssertTrunkNumberFormatInput = z.infer<
  typeof assertTrunkNumberFormatSchema
>
