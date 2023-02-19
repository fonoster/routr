/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { PrismaClientInitializationError } from "@prisma/client/runtime"

export function findBy(
  operation: PrismaFindByOperation,
  kind: CC.KindWithoutUnknown
) {
  return async (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    try {
      const request = { [call.request.fieldName]: call.request.fieldValue }
      const Manager = getManager(kind)

      // WARNING: This function currently doesn't work for boolean or enum fields
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
            message: "database is not available"
          },
          null
        )
        return
      }
      callback(e, null)
    }
  }
}
