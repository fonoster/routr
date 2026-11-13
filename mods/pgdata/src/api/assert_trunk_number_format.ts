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

const FIELDS = [
  "calledNumberFormat",
  "calledNumberPrefix",
  "callerNumberFormat",
  "callerNumberPrefix"
] as const

type StoredNumberFormat = Record<(typeof FIELDS)[number], string | null>

const select = {
  calledNumberFormat: true,
  calledNumberPrefix: true,
  callerNumberFormat: true,
  callerNumberPrefix: true
} as const

// The read the check makes; the Prisma client satisfies it
export interface TrunkNumberFormatClient {
  trunk: {
    findUnique: (query: {
      where: { ref: string }
      select: typeof select
    }) => Promise<StoredNumberFormat | null>
  }
}

/**
 * Creates the check a Trunk update makes before it reaches the database: the
 * number format fields of the request are merged over the stored ones, and
 * the result must hold no prefix without its format. A rejected update
 * therefore changes nothing.
 *
 * @param {TrunkNumberFormatClient} client - the database client (injected)
 * @return {Function} a validated function that throws BadRequestError
 * (INVALID_ARGUMENT) when a prefix breaks a rule
 */
export function createAssertTrunkNumberFormat(client: TrunkNumberFormatClient) {
  const fn = async (params: CC.AssertTrunkNumberFormatInput): Promise<void> => {
    const { ref } = params
    const sent = Object.fromEntries(
      FIELDS.filter(
        (field) => params[field] !== undefined && params[field] !== null
      ).map((field) => [field, params[field]])
    )

    // The request leaves the formats and the prefixes as they are
    if (Object.keys(sent).length === 0) return

    const stored = ref
      ? await client.trunk.findUnique({ where: { ref }, select })
      : null

    logger.verbose("checking trunk number format", { ref })

    CC.validateTrunkNumberFormat({ ...stored, ...sent })

    logger.verbose("trunk number format checked", { ref })
  }

  return withErrorHandlingAndValidation(fn, CC.assertTrunkNumberFormatSchema)
}
