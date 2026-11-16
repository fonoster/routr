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
/* eslint-disable require-jsdoc */
import { Metadata } from "@grpc/grpc-js"
import { CommonConnect as CC } from "@routr/common"
import { buildCredentials } from "./build_credentials"
import { ClientOptions } from "./types"

/**
 * Builds the metadata every call carries: the API key or, without one, the
 * username and password.
 *
 * @param {ClientOptions} options - The client's options
 * @return {Metadata} The metadata
 */
export function buildMetadata(options: ClientOptions): Metadata {
  const metadata = new Metadata()

  if (options.apiKey) {
    metadata.set("authorization", `Bearer ${options.apiKey}`)
  } else if (options.username && options.password) {
    metadata.set(
      "authorization",
      `Basic ${Buffer.from(`${options.username}:${options.password}`).toString(
        "base64"
      )}`
    )
  }

  return metadata
}

export abstract class APIClient {
  client: CC.APIClient
  constructor(options: ClientOptions) {
    const metadata = buildMetadata(options)

    const credentials = buildCredentials(options)

    this.client = CC.apiClient({
      apiAddr: options.endpoint,
      metadata,
      credentials
    })
  }

  getService() {
    return this.client
  }
}
