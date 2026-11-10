/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
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
import * as grpc from "@grpc/grpc-js"
import { Assertions as A } from "@routr/common"
import { ClientOptions } from "./types"
import fs from "fs"
import net from "net"

/**
 * Splits the host from an endpoint the way Go's net.SplitHostPort does:
 * "[::1]:51907" is "::1" and "localhost:51907" is "localhost".
 *
 * @param {string} endpoint - host:port
 * @return {string} The host
 */
function hostOf(endpoint: string): string {
  if (net.isIP(endpoint)) return endpoint
  if (endpoint.startsWith("[")) {
    const end = endpoint.indexOf("]")
    return end === -1 ? endpoint : endpoint.slice(1, end)
  }
  const colon = endpoint.lastIndexOf(":")
  return colon === -1 ? endpoint : endpoint.slice(0, colon)
}

/**
 * Tells if a host is this machine: localhost, 127.0.0.0/8 or ::1. It never
 * resolves a name.
 *
 * @param {string} host - A host name or an IP address
 * @return {boolean} True for loopback
 */
function isLoopback(host: string): boolean {
  return (
    host.toLowerCase() === "localhost" ||
    (net.isIPv4(host) && host.startsWith("127.")) ||
    host === "::1"
  )
}

/**
 * Builds the channel credentials for an endpoint: TLS, verified with cacert or
 * the system store, unless insecure is true or ALLOW_INSECURE=true. A cacert
 * wins over ALLOW_INSECURE. Throws instead of letting ALLOW_INSECURE send a
 * credential in clear beyond loopback.
 *
 * @param {ClientOptions} options - The client's options
 * @return {grpc.ChannelCredentials} The credentials to dial with
 */
export function buildCredentials(
  options: ClientOptions
): grpc.ChannelCredentials {
  if (options.insecure === true) return grpc.credentials.createInsecure()

  if (options.cacert) {
    A.assertFileExist(options.cacert)
    return grpc.credentials.createSsl(fs.readFileSync(options.cacert))
  }

  if (process.env.ALLOW_INSECURE !== "true") {
    return grpc.credentials.createSsl()
  }

  const sendsCredential =
    !!options.apiKey || !!(options.username && options.password)

  if (sendsCredential && !isLoopback(hostOf(options.endpoint))) {
    throw new Error(
      `ALLOW_INSECURE would send the API key in clear to ${options.endpoint}. Set insecure: true (--insecure in rctl) to accept that, or unset ALLOW_INSECURE for TLS (cacert, --cacert in rctl, for a private CA).`
    )
  }

  return grpc.credentials.createInsecure()
}
