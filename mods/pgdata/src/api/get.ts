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
import {
  CommonTypes as CT,
  CommonErrors as CE,
  CommonConnect as CC
} from "@routr/common"
import { PrismaOperation } from "../types"
import { getManager } from "../mappers/utils"
import { PrismaClientInitializationError } from "@prisma/client/runtime/library"

export function get(operation: PrismaOperation, kind: CC.KindWithoutUnknown) {
  return async (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    if (!call.request.ref) {
      return callback(new CE.BadRequestError("Parameter ref is required"), null)
    }

    const Manager = getManager(kind)

    try {
      const objectFromDB = (await operation({
        where: {
          ref: call.request.ref
        },
        include: Manager.includeFields()
      })) as { extended: unknown }

      if (objectFromDB?.extended) {
        objectFromDB.extended = struct.encode(
          objectFromDB.extended as JsonObject
        )
      }

      objectFromDB
        ? callback(null, Manager.mapToDto(objectFromDB as any))
        : callback(new CE.ResourceNotFoundError(call.request.ref), null)
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

      callback(
        {
          code: grpc.status.UNKNOWN,
          message: "Unknown error"
        },
        null
      )
    }
  }
}
