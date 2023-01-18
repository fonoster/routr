/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
/* eslint-disable require-jsdoc */
import { JsonObject, struct } from "pb-util"
import { CommonTypes as CT, CommonConnect as CC } from "@routr/common"
import { PrismaListOperation } from "../types"
import { getManager } from "../mappers/utils"

export function list(
  operation: PrismaListOperation,
  kind: CC.KindWithoutUnknown
) {
  return async (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    try {
      const { request } = call
      const cursor = request.pageToken ? { ref: request.pageToken } : undefined
      const skip = request.pageToken ? 1 : 0

      const Manager = getManager(kind)

      const items = (await operation({
        take: request.pageSize,
        skip,
        cursor,
        orderBy: {
          createdAt: "desc"
        },
        include: Manager.includeFields()
      })) as {
        extended: unknown
        ref: string
        createdAt: Date
        updatedAt: Date
      }[]

      const itemsWithEncodedDates = items.map(
        (item: { extended: unknown; createdAt: Date; updatedAt: Date }) => {
          if (item.extended) {
            item.extended = struct.encode(item.extended as JsonObject)
          }

          return Manager.mapToDto(item as any)
        }
      )

      callback(null, {
        items: itemsWithEncodedDates,
        nextPageToken: items[items.length - 1]?.ref
      })
    } catch (e) {
      callback(e, null)
    }
  }
}
