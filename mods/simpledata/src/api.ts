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
import logger from "@fonoster/logger"
import { BadRequest, ResourceNotFound } from "./errors"
import { Resource } from "./types"
import jp from "jsonpath"

// Will find the first resource that matches the reference
export function get(resources: Resource[]) {
  return (call: any, callback: any) => {
    if (resources == null || resources.length === 0) {
      return callback(new ResourceNotFound(call.request.ref), null)
    }

    if (call.request.ref == null) {
      return callback(new BadRequest("parameter ref is required"), null)
    }

    const resource = resources.find(r => r.metadata.ref === call.request.ref)

    resource 
      ? callback(null, resource )
      : callback(new ResourceNotFound(call.request.ref), null)
  }
}

export function find(resources: Resource[]) {
  return (call: any, callback: any) => {
    if (resources == null || resources.length === 0) {
      return callback(new ResourceNotFound(call.request.query), null)
    }

    if (call.request.query == null) {
      return callback(new BadRequest("parameter query is required"), null)
    }

    try {
      callback(null, jp.query(resources, call.request.query))
    } catch (e) {
      return callback(new BadRequest(`invalid JSONPath expression: ${call.request.query}`), null)
    }
  }
}
