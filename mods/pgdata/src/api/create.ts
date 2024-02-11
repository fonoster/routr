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
  CommonConnect as CC,
  CommonErrors as CE
} from "@routr/common"
import { PrismaCreateOperation } from "../types"
import { getManager } from "../mappers/utils"
import { PrismaClientInitializationError } from "@prisma/client/runtime/library"

export function create(
  operation: PrismaCreateOperation,
  kind: CC.KindWithoutUnknown
) {
  return async (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    try {
      const { request } = call

      if (request.extended) {
        request.extended = struct.decode(request.extended)
      }

      const Manager = getManager(kind)
      const manager = new Manager(request as any)

      manager.validOrThrowCreate()

      const objFromDB = (await operation({
        data: manager.mapToPrisma(),
        include: Manager.includeFields()
      })) as { extended: unknown }

      if (objFromDB.extended) {
        objFromDB.extended = struct.encode(objFromDB.extended as JsonObject)
      }

      callback(null, Manager.mapToDto(objFromDB as any))
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
      } else if (e.code === "P2002") {
        callback(
          new CE.BadRequestError(
            "entity already exist for field: " + e.meta.target[0]
          ),
          null
        )
      } else if (e.code === "P2003") {
        callback(
          new CE.BadRequestError(
            "dependent entity doesn't exist for: " + e.meta.field_name
          ),
          null
        )
      } else {
        callback(e, null)
      }
    }
  }
}
