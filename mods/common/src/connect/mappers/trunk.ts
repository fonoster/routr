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
import { Transport } from "../../types"
import { TrunkConfig } from "../config"
import { schemaValidators } from "../schemas"
import { Trunk, Kind } from "../types"
import { assertValidSchema } from "./assertions"

const valid = schemaValidators.get(Kind.TRUNK)

export function mapToTrunk(config: TrunkConfig): Trunk {
  assertValidSchema(config, valid)

  return {
    apiVersion: config.apiVersion,
    ref: config.ref,
    name: config.metadata.name,
    sendRegister: config.spec.outbound?.sendRegister,
    inboundUri: config.spec.inbound?.uri,
    inboundCredentialsRef: config.spec.inbound?.credentialsRef,
    outboundCredentialsRef: config.spec.outbound?.credentialsRef,
    accessControlListRef: config.spec.inbound?.accessControlListRef,
    uris: config.spec.outbound?.uris?.map((entry) => {
      return {
        user: entry.uri.user,
        host: entry.uri.host,
        port: entry.uri.port,
        transport: entry.uri.transport?.toUpperCase() as Transport,
        enabled: entry.enabled,
        weight: entry.weight,
        priority: entry.priority
      }
    }),
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime()
  }
}
