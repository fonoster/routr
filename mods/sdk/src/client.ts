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
import * as grpc from "@grpc/grpc-js"
import { Metadata } from "@grpc/grpc-js"
import { CommonConnect as CC } from "@routr/common"
import { APIClient as ConnectClient } from "@routr/common/src/connect"
import { ClientOptions } from "./types"

export abstract class APIClient {
  client: ConnectClient
  constructor(options: ClientOptions) {
    const metadata = new Metadata()

    if (options.username && options.password) {
      metadata.set(
        "authorization",
        `Basic ${Buffer.from(
          `${options.username}:${options.password}`
        ).toString("base64")}`
      )
    }

    const credentials =
      process.env.ALLOW_INSECURE === "true"
        ? grpc.credentials.createInsecure()
        : grpc.credentials.createSsl()

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
