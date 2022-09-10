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
import {BadRequest, ResourceNotFound} from "./errors"
import {FindParameters, Resource} from "./types"
import {CommonTypes as CT} from "@routr/common"
import jp from "jsonpath"
import {createQuery} from "./utils"

/**
 * Enclosure with method to obtain a resource by reference.
 *
 * @param {Resource[]} resources - the resources to search from
 * @return {Function } enclosed method with actual "get" logic
 */
export function get(resources: Resource[]) {
  return (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    if (resources == null || resources.length === 0) {
      return callback(new ResourceNotFound(call.request.ref), null)
    }

    if (call.request.ref == null) {
      return callback(new BadRequest("parameter ref is required"), null)
    }

    const resource = resources.find((r) => r.metadata.ref === call.request.ref)

    resource
      ? callback(null, resource)
      : callback(new ResourceNotFound(call.request.ref), null)
  }
}

/**
 * Enclosure with method to obtain a resource with a query.
 *
 * @param {Resource[]} resources - the resources to search from
 * @return {Function } enclosed method with actual "find" logic
 */
export function findBy(resources: Resource[]) {
  return (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    const res = resources.filter(
      (r: Resource) =>
        r.kind?.toLowerCase() === call.request.kind?.toLowerCase()
    )

    if (res == null || res.length === 0) {
      return callback(new ResourceNotFound("unknown"), null)
    }

    const result = createQuery(call.request as FindParameters)

    if (result instanceof BadRequest) {
      return callback(result, null)
    }

    try {
      callback(null, {
        resources: jp.query(res, result.query)
      })
    } catch (e) {
      return callback(
        new BadRequest(`invalid JSONPath expression: ${result.query}`),
        null
      )
    }
  }
}
