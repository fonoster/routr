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
import { BadRequest, ResourceNotFound } from "./errors"
import { CommonTypes as CT } from "@routr/common"
import { createQuery } from "./utils"
import { CommonConnect as CC } from "@routr/common"
import { Helper as H } from "@routr/common"
import * as protobufUtil from "pb-util"
import jp from "jsonpath"
const jsonToStruct = protobufUtil.struct.encode

/**
 * Enclosure with method to obtain a resource by reference.
 *
 * @param {Resource[]} resources - the resources to search from
 * @return {Function } enclosed method with actual "get" logic
 */
export function get(resources: CC.Resource[]) {
  return (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    if (resources == null || resources.length === 0) {
      return callback(new ResourceNotFound(call.request.ref), null)
    }

    if (call.request.ref == null) {
      return callback(new BadRequest("parameter ref is required"), null)
    }

    const resource = H.deepCopy(
      resources.find((r) => r.ref === call.request.ref)
    )

    // Serialize to protobuf
    if (resource) resource.spec = jsonToStruct(resource.spec)

    resource
      ? callback(null, resource)
      : callback(new ResourceNotFound(call.request.ref), null)
  }
}

/**
 * Enclosure with method to obtain a resource with a query.
 *
 * @param {Resource[]} resources - the resources to search from
 * @return {Function} enclosed method with actual "find" logic
 */
export function findBy(resources: CC.Resource[]) {
  return (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    const filteredResources = resources.filter(
      (resource: CC.Resource) =>
        resource.kind?.toLowerCase() === call.request.kind?.toLowerCase()
    )

    // WARNING: This seems to contradict the result of the query
    if (filteredResources.length === 0) {
      return callback(new ResourceNotFound(""), null)
    }

    const queryObject = createQuery(call.request as CC.FindParameters)

    if (queryObject instanceof BadRequest) {
      return callback(queryObject, null)
    }

    const queryResult = H.deepCopy(
      jp.query(filteredResources, queryObject.query)
    )

    try {
      queryResult.forEach((resource: CC.Resource) => {
        // Serialize to protobuf
        resource.spec = jsonToStruct(resource.spec)
        return resource
      })

      callback(null, {
        resources: queryResult
      })
    } catch (e) {
      callback(
        new BadRequest(`invalid JSONPath expression: ${queryObject.query}`),
        null
      )
    }
  }
}
