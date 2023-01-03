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
import { EdgePortConfig, Transport } from "./types"

// We need to have the spec.securityContext for all secure protocol
export const isSecureProto = (proto: string) =>
  proto === "wss" || proto === "tls"

// We need to have the spec.securityContext for all secure protocol
export const assertHasSecurityContext = (config: EdgePortConfig) => {
  const hasSecureProto = config.spec.transport.some((t1) =>
    isSecureProto(t1.protocol)
  )
  if (hasSecureProto && !config.spec.securityContext) {
    throw new Error(
      "found at least one secure protocol which requires setting the .spec.securityContext"
    )
  }
}

// Only one entry per protocol is allowed
export const assertNoDuplicatedProto = (transports: Array<Transport>) => {
  if (
    transports.some(
      (t1) => transports.filter((t2) => t1.protocol === t2.protocol).length > 1
    )
  ) {
    throw new Error("found duplicated entries at .spec.transport")
  }
}

// The only protocol that can accept the same port twice are udp and tcp
export const assertNoDuplicatedPort = (transports: Array<Transport>) => {
  const duplicateCondition = (t1: Transport, t2: Transport) =>
    t1.port === t2.port && t1.protocol !== "UDP" && t1.protocol !== "TCP"

  if (
    transports
      .map((t) => {
        return {
          port: t.port,
          protocol: t.protocol.toUpperCase()
        }
      })
      .some(
        (t1) => transports.filter((t2) => duplicateCondition(t1, t2)).length > 1
      )
  ) {
    throw new Error(
      "found the same port on more that one entry at .spec.transport"
    )
  }
}
