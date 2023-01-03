/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
import { DomainConfig } from "../config"
import { schemaValidators } from "../schemas"
import { Domain, Kind } from "../types"
import { assertValidSchema } from "./assertions"

const valid = schemaValidators.get(Kind.DOMAIN)

export function mapToDomain(config: DomainConfig): Domain {
  assertValidSchema(config, valid)

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    domainUri: config.spec.context.domainUri,
    accessControlListRef: config.spec.accessControlListRef,
    egressPolicies: config.spec.context.egressPolicies
  }
}
