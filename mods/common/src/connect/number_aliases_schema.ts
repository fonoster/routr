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

const aliasList = z.array(z.string({ error: "an alias must be a string" }), {
  error: "aliases must be a list"
})

/** Schema for checking the aliases a Number is about to be stored with. */
export const validateNumberAliasesSchema = z.object({
  number: z.object(
    {
      ref: z.string({ error: "ref must be a string" }).optional(),
      trunkRef: z.string({ error: "trunkRef must be a string" }).nullish(),
      aliases: aliasList
    },
    { error: "number is required" }
  ),
  trunkNumbers: z.array(
    z.object({
      ref: z.string({ error: "ref must be a string" }),
      aliases: aliasList.nullish()
    }),
    { error: "trunkNumbers must be a list" }
  )
})

/** Schema for the alias fields of a request that creates or updates a Number. */
export type ValidateNumberAliasesInput = z.infer<
  typeof validateNumberAliasesSchema
>
