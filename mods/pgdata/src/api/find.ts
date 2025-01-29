/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import * as grpc from "@grpc/grpc-js"
import { JsonObject, struct } from "pb-util"
import { CommonTypes as CT, CommonConnect as CC } from "@routr/common"
import { PrismaFindByOperation } from "../types"
import { getManager } from "../mappers/utils"
import { PrismaClientInitializationError } from "@prisma/client/runtime/library"

export function findBy(
  operation: PrismaFindByOperation,
  kind: CC.KindWithoutUnknown
) {
  return async (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    try {
      const request = { [call.request.fieldName]: call.request.fieldValue }
      const Manager = getManager(kind)

      // WARNING: As of Prisma 4.15.0, we can't pass string equivalents of booleans due to its internals.
      // Previously, this was feasible. This workaround is temporary until find a better solution.
      if (call.request.fieldValue === "true") {
        request[call.request.fieldName] = true
      } else if (call.request.fieldValue === "false") {
        request[call.request.fieldName] = false
      }

      const items = (await operation({
        where: request,
        include: Manager.includeFields()
      })) as { extended: unknown }[]

      items.forEach((item: { extended: unknown }) => {
        if (item.extended) {
          item.extended = struct.encode(item.extended as JsonObject)
        }
      })

      callback(null, {
        items: items
      })
    } catch (e) {
      if (e instanceof PrismaClientInitializationError) {
        callback(
          {
            code: grpc.status.UNAVAILABLE,
            message: "Service unavailable"
          },
          null
        )
        return
      }
      callback(e, null)
    }
  }
}
