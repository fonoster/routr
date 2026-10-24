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
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://localhost:5432/routr"

import fs from "fs"
import os from "os"
import net from "net"
import path from "path"
import { ChildProcess, execFileSync, spawn } from "child_process"
import chai from "chai"
import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { protoPath as healthProtoPath } from "grpc-health-check"

const expect = chai.expect

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo
      server.close(() => resolve(port))
    })
  })

const healthDefinition = protoLoader.loadSync(healthProtoPath, {
  keepCase: true,
  enums: String
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Health } = (grpc.loadPackageDefinition(healthDefinition) as any).grpc
  .health.v1

// Asks the gRPC health service for the overall status, retrying every 100ms
// while the service process starts and binds
const checkHealth = async (
  addr: string,
  attemptsLeft = 200
): Promise<string> => {
  const client = new Health(addr, grpc.credentials.createInsecure())
  const status = await new Promise<string>((resolve) =>
    client.check(
      { service: "" },
      (err: grpc.ServiceError | null, res: { status: string }) =>
        resolve(err ? "UNAVAILABLE" : res.status)
    )
  )
  client.close()
  if (status === "SERVING" || attemptsLeft <= 1) return status
  await new Promise((resolve) => setTimeout(resolve, 100))
  return checkHealth(addr, attemptsLeft - 1)
}

describe("@routr/pgdata/service", () => {
  let certsDir: string
  let service: ChildProcess | undefined

  before(() => {
    certsDir = fs.mkdtempSync(path.join(os.tmpdir(), "pgdata-test-"))
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-keyout",
        path.join(certsDir, "server.key"),
        "-out",
        path.join(certsDir, "server.crt")
      ],
      { stdio: "ignore" }
    )
  })

  afterEach(() => service?.kill())

  after(() => fs.rmSync(certsDir, { recursive: true, force: true }))

  it("reports SERVING when the external server uses TLS", async () => {
    const bindAddr = `127.0.0.1:${await freePort()}`
    const externalServerBindAddr = `127.0.0.1:${await freePort()}`

    // The envs are read when the module loads, so the service runs in its own
    // process with TLS on. Paths resolve from the repo root, where npm test runs.
    const servicePath = path.resolve("mods/pgdata/src/service")
    service = spawn(
      process.execPath,
      [
        "-r",
        "ts-node/register",
        "-e",
        `require(${JSON.stringify(servicePath)}).default(${JSON.stringify({
          bindAddr,
          externalServerBindAddr
        })})`
      ],
      {
        env: {
          ...process.env,
          TS_NODE_TRANSPILE_ONLY: "true",
          TLS_ON: "true",
          SERVER_CERT: path.join(certsDir, "server.crt"),
          SERVER_KEY: path.join(certsDir, "server.key")
        },
        stdio: "ignore"
      }
    )

    expect(await checkHealth(bindAddr)).to.equal("SERVING")
    // Leaves room for ts-node to start the service process
  }).timeout(30000)
})
