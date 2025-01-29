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
import { JsonObject, struct } from "pb-util"
import {
  CommonTypes as CT,
  CommonConnect as CC,
  CommonErrors as CE
} from "@routr/common"
import { PrismaUpdateOperation } from "../types"
import { getManager } from "../mappers/utils"
import { prisma } from "../db"

export function update(
  operation: PrismaUpdateOperation,
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

      manager.validOrThrowUpdate()

      if (kind === CC.Kind.DOMAIN && request.egressPolicy) {
        await prisma.egressPolicy.deleteMany({
          where: {
            domainRef: request.ref
          }
        })
      }

      if (kind === CC.Kind.TRUNK && request.uris) {
        await prisma.trunkURI.deleteMany({
          where: {
            trunkRef: request.ref
          }
        })
      }

      const objectFromDB = (await operation({
        where: {
          ref: request.ref
        },
        data: manager.mapToPrisma(),
        include: Manager.includeFields()
      })) as { extended: unknown }

      if (objectFromDB.extended) {
        objectFromDB.extended = struct.encode(
          objectFromDB.extended as JsonObject
        )
      }

      callback(null, Manager.mapToDto(objectFromDB as any))
    } catch (e) {
      if (e.code === "P2025") {
        callback(new CE.ResourceNotFoundError(call.request.ref), null)
      } else if (e.code === "P2003") {
        callback(
          new CE.BadRequestError(
            "Dependent resource doesn't exist for: " + e.meta.field_name
          ),
          null
        )
      } else {
        callback(e, null)
      }
    }
  }
}
