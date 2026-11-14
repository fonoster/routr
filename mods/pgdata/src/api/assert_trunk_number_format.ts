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
  CommonTypes as CT,
  withErrorHandlingAndValidation
} from "@routr/common"

type StoredFormats = {
  calledNumberFormat: string | null
  calledNumberPrefix: string | null
  callerNumberFormat: string | null
  callerNumberPrefix: string | null
}

// The read the check makes; the Prisma client satisfies it
export interface TrunkNumberFormatClient {
  trunk: {
    findUnique: (query: {
      where: { ref: string }
      select: {
        calledNumberFormat: true
        calledNumberPrefix: true
        callerNumberFormat: true
        callerNumberPrefix: true
      }
    }) => Promise<StoredFormats | null>
  }
}

const select = {
  calledNumberFormat: true,
  calledNumberPrefix: true,
  callerNumberFormat: true,
  callerNumberPrefix: true
} as const

// A field the update request carries replaces the stored one
const sent = <T>(value: T | null | undefined, stored: T | null) =>
  value !== undefined && value !== null ? value : stored ?? undefined

/**
 * Creates the check a Trunk Update makes before it reaches the database: the
 * request's number formats and prefixes are merged over the stored row, and
 * the result must pass validateTrunkNumberFormat. A request that sends none
 * of them reads nothing. An Update that resets a
 * format while a prefix is stored must therefore also clear that prefix.
 *
 * @param {TrunkNumberFormatClient} client - the database client (injected)
 * @return {Function} a validated function that throws BadRequestError
 * (INVALID_ARGUMENT) when the merged Trunk breaks a rule
 */
export function createAssertTrunkNumberFormat(client: TrunkNumberFormatClient) {
  const fn = async (params: CC.AssertTrunkNumberFormatInput): Promise<void> => {
    const { ref, ...fields } = params

    // A request that leaves every format and prefix alone keeps them as stored
    if (Object.values(fields).every((v) => v === undefined || v === null)) {
      return
    }

    const stored = await client.trunk.findUnique({
      where: { ref },
      select
    })

    // The update itself answers NOT_FOUND
    if (!stored) return

    CC.validateTrunkNumberFormat({
      calledNumberFormat: sent(
        params.calledNumberFormat,
        stored.calledNumberFormat as CT.NumberFormat
      ),
      calledNumberPrefix: sent(
        params.calledNumberPrefix,
        stored.calledNumberPrefix
      ),
      callerNumberFormat: sent(
        params.callerNumberFormat,
        stored.callerNumberFormat as CT.NumberFormat
      ),
      callerNumberPrefix: sent(
        params.callerNumberPrefix,
        stored.callerNumberPrefix
      )
    })
  }

  return withErrorHandlingAndValidation(fn, CC.assertTrunkNumberFormatSchema)
}
