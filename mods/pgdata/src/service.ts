/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { DBDelegate, PostgresDataConfig } from "./types"
import { CommonConnect as CC } from "@routr/common"
import { getLogger } from "@fonoster/logger"
import { PrismaClient } from "@prisma/client"
import { create } from "./api/create"
import { update } from "./api/update"
import { get } from "./api/get"
import { del } from "./api/delete"
import { findBy } from "./api/find"
import { list } from "./api/list"
import {
  TLS_ON,
  SERVER_CERT,
  SERVER_KEY,
  CACERT,
  VERIFY_CLIENT_CERT
} from "./envs"
import fs from "fs"
import { HealthImplementation } from "grpc-health-check"
import { GRPC_SERVING_STATUS, statusMap } from "@fonoster/common"

const prisma = new PrismaClient()
const logger = getLogger({ service: "pgdata", filePath: __filename })

/**
 * Starts a new posgres data service.
 *
 * @param {PostgresDataConfig} config - the configuration of the service
 */
export default function pgDataService(config: PostgresDataConfig): void {
  const { bindAddr } = config
  const healthImpl = new HealthImplementation(statusMap)
  const internalServer = new grpc.Server()
  const externalServer = new grpc.Server()

  logger.info("starting routr service", { bindAddr, name: "pgdata" })

  const kinds = [
    CC.Kind.AGENT,
    CC.Kind.CREDENTIALS,
    CC.Kind.NUMBER,
    CC.Kind.TRUNK,
    CC.Kind.PEER,
    CC.Kind.DOMAIN,
    "accessControlList"
  ]

  kinds.forEach((kind) => {
    const k = kind.toLowerCase() as CC.KindWithoutUnknown
    const delegate = prisma[kind as DBDelegate]
    const funcs = {
      create: create(delegate.create, k),
      get: get(delegate.findUnique, k),
      findBy: findBy(delegate.findMany, k),
      delete: del(delegate.delete),
      update: update(delegate.update, k),
      list: list(delegate.findMany, k)
    }

    internalServer.addService(CC.createConnectService(k), funcs)
    externalServer.addService(CC.createConnectService(k), funcs)
  })

  const credentials = grpc.ServerCredentials.createInsecure()

  // Add the health check service to the server
  healthImpl.addToServer(internalServer)

  internalServer.bindAsync(config.bindAddr, credentials, () => {
    logger.info("internal server started", { bindAddr: config.bindAddr })
  })

  if (TLS_ON) {
    const cacert = VERIFY_CLIENT_CERT ? fs.readFileSync(CACERT) : null
    const cert = fs.readFileSync(SERVER_CERT)
    const key = fs.readFileSync(SERVER_KEY)

    const externalCredentials = grpc.ServerCredentials.createSsl(
      // Root CA certificates for validating client certificates
      cacert,
      [
        {
          cert_chain: cert,
          private_key: key
        }
      ],
      VERIFY_CLIENT_CERT
    )
    externalServer.bindAsync(
      config.externalServerBindAddr,
      externalCredentials,
      () => {
        logger.info("external server started", {
          externalServerBindAddr: config.externalServerBindAddr
        })
      }
    )
  } else {
    externalServer.bindAsync(config.externalServerBindAddr, credentials, () => {
      healthImpl.setStatus("", GRPC_SERVING_STATUS)
      logger.info("secure connection disabled")
      logger.info("external server started", {
        externalServerBindAddr: config.externalServerBindAddr
      })
    })
  }
}
