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
import * as grpc from "@grpc/grpc-js"
import { Metadata } from "@grpc/grpc-js"
import { CommonConnect as CC, Assertions as A } from "@routr/common"
import { ClientOptions } from "./types"
import fs from "fs"

export abstract class APIClient {
  client: CC.APIClient
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

    if (options.cacert) {
      A.assertFileExist(options.cacert)
    }

    const cacert = fs.existsSync(options.cacert)
      ? fs.readFileSync(options.cacert)
      : null

    const credentials =
      process.env.ALLOW_INSECURE === "true" || options.insecure === true
        ? grpc.credentials.createInsecure()
        : grpc.credentials.createSsl(cacert)

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
