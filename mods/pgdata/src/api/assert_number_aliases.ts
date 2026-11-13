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
import {
  CommonConnect as CC,
  withErrorHandlingAndValidation
} from "@routr/common"
import { getLogger } from "@fonoster/logger"

const logger = getLogger({ service: "pgdata", filePath: __filename })

type NumberAliases = { ref: string; aliases: string[]; trunkRef: string | null }

// The two reads the check makes; the Prisma client satisfies it
export interface NumberAliasesClient {
  number: {
    findUnique: (query: {
      where: { ref: string }
      select: { ref: true; aliases: true; trunkRef: true }
    }) => Promise<NumberAliases | null>
    findMany: (query: {
      where: { trunkRef: string }
      select: { ref: true; aliases: true; trunkRef: true }
    }) => Promise<NumberAliases[]>
  }
}

const select = { ref: true, aliases: true, trunkRef: true } as const

/**
 * Creates the check a Number write that sends aliases makes before it reaches
 * the database: the request is merged over the stored row, and the aliases
 * sent must be valid and unused by the other Numbers of the Trunk the Number
 * would end on. A rejected write therefore changes nothing.
 *
 * @param {NumberAliasesClient} client - the database client (injected)
 * @return {Function} a validated function that throws BadRequestError
 * (INVALID_ARGUMENT) when an alias breaks a rule
 */
export function createAssertNumberAliases(client: NumberAliasesClient) {
  const fn = async (params: CC.AssertNumberAliasesInput): Promise<void> => {
    const { ref, clearAliases } = params
    const aliases = params.aliases ?? []

    // Only a request that sends aliases is checked; clearAliases removes them
    if (clearAliases || aliases.length === 0) return

    const stored = ref
      ? await client.number.findUnique({ where: { ref }, select })
      : null

    // The update itself answers NOT_FOUND
    if (ref && !stored) return

    // The Trunk the Number will be on: the request's, else the stored one
    const trunkRef = params.trunkRef || stored?.trunkRef

    logger.verbose("checking number aliases", { ref, trunkRef })

    CC.validateNumberAliases({
      number: { ref, trunkRef, aliases },
      trunkNumbers:
        trunkRef && aliases.length > 0
          ? await client.number.findMany({ where: { trunkRef }, select })
          : []
    })

    logger.verbose("number aliases checked", { ref, trunkRef })
  }

  return withErrorHandlingAndValidation(fn, CC.assertNumberAliasesSchema)
}
