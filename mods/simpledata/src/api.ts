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
import { JsonObject, struct } from "pb-util"
import {
  CommonTypes as CT,
  CommonConnect as CC,
  CommonErrors as CE,
  Helper as H
} from "@routr/common"

/**
 * Enclosure with method to obtain a resource by reference.
 *
 * @param {CC.ConnectModel[]} resources - the resources to search from
 * @return {Function } enclosed method with actual "get" logic
 */
export function get(resources: CC.ConnectModel[]) {
  return (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    if (resources == null || resources.length === 0) {
      return callback(new CE.ResourceNotFoundError(call.request.ref), null)
    }

    if (call.request.ref == null) {
      return callback(new CE.BadRequestError("parameter ref is required"), null)
    }

    const resource = H.deepCopy(
      resources.find((r) => r.ref === call.request.ref)
    ) as { extended: unknown }

    // Serialize to protobuf
    if (resource?.extended) {
      resource.extended = struct.encode(resource.extended as JsonObject)
    }

    resource
      ? callback(null, resource)
      : callback(new CE.ResourceNotFoundError(call.request.ref), null)
  }
}

/**
 * Enclosure with method to obtain a resource with a query.
 *
 * @param {CC.ConnectModel[]} resources - the resources to search from
 * @return {Function} enclosed method with actual "findBy" logic
 */
export function findBy(resources: CC.ConnectModel[]) {
  return (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    const { request } = call
    const queryResult = resources.filter(
      (r) =>
        `${r[request.fieldName as keyof CC.ConnectModel]}` ===
        `${request.fieldValue}`
    )

    queryResult.forEach((resource: { extended?: unknown }) => {
      // Serialize to protobuf
      if (resource.extended) {
        resource.extended = struct.encode(resource.extended as JsonObject)
      }
      return resource
    })

    callback(null, {
      items: queryResult
    })
  }
}
