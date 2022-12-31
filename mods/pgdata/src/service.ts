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
import * as grpc from "@grpc/grpc-js"
import { PostgresDataConfig } from "./types"
import { CommonConnect as CC } from "@routr/common"
import { nyi } from "./utils"
import { getLogger } from "@fonoster/logger"
import { get } from "./api"
import { create } from "./api/create"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const logger = getLogger({ service: "pgdata", filePath: __filename })

/**
 * Starts a new posgres data service.
 *
 * @param {PostgresDataConfig} config - the configuration of the service
 */
export default function pgDataService(config: PostgresDataConfig): void {
  const { bindAddr } = config
  logger.info("starting routr service", { bindAddr, name: "pgdata" })
  const server = new grpc.Server()

  server.addService(CC.createService(CC.Kind.AGENT), {
    get: get,
    findBy: nyi,
    delete: nyi,
    update: nyi,
    create: create(prisma),
    list: nyi
  })

  server.bindAsync(
    config.bindAddr,
    grpc.ServerCredentials.createInsecure(),
    () => {
      server.start()
    }
  )
}
