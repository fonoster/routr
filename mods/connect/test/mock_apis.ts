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
import { DataAPI, Resource } from "../src/types"
import { r1 } from './examples'
import loadResources from "../../simpledata/src/utils"
import jp from "jsonpath"

const resources: Resource[] = loadResources(__dirname + "/../../simpledata/etc/schemas",
  __dirname + "/../../../config/resources")

export const dataAPI: DataAPI = {
  find: (query: string) => {
    return Promise
      .resolve(jp.query(resources, query)) as unknown as Promise<Resource[]>
  },
  get: (ref: string): Promise<Resource> => {
    // Nothing to do here
    return null
  }
}

export const locationAPI = { findRoutes: (aor: string) => [r1] }
