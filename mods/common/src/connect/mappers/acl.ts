/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
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
import { AccessControlListConfig } from "../config"
import { schemaValidators } from "../schemas"
import { AccessControlList, Kind } from "../types"
import { assertValidSchema } from "./assertions"

const valid = schemaValidators.get(Kind.ACL)

export function mapToACL(config: AccessControlListConfig): AccessControlList {
  assertValidSchema(config, valid)

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    allow: config.spec.accessControlList?.allow ?? [],
    deny: config.spec.accessControlList?.deny ?? [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}
