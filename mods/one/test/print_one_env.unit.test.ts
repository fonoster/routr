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
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { mkdtempSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { CommonErrors } from "@routr/common"
import { loadOneConfig } from "../src/config"
import { printOneEnv } from "../src/config/print_one_env"

chai.use(sinonChai)
const expect = chai.expect

const HEADER = "kind: RoutrOne\napiVersion: v2beta1\nref: routr-one\n"

const IMAGE_DEFAULTS = {
  PKCS12_PASSWORD: "changeme",
  PATH_TO_CERTS: "/etc/routr/certs",
  TLS_ON: "false",
  VERIFY_CLIENT_CERT: "false",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/routr",
  IGNORE_LOOPBACK_FROM_LOCALNETS: "true",
  START_INTERNAL_DB: "true",
  LOG4J2: "/etc/routr/log4j2.yaml"
}

const withSpec = (spec: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "routr-one-")), "one.yaml")
  writeFileSync(path, `${HEADER}spec:\n${spec}`)
  return path
}

const written = (spy: sinon.SinonSpy): string =>
  spy
    .getCalls()
    .map((call) => call.args[0])
    .join("")

const errorOf = (fn: () => unknown): Error => {
  try {
    fn()
  } catch (e) {
    return e as Error
  }
  throw new Error("expected an error")
}

describe("@routr/one[config/print_one_env]", () => {
  afterEach(() => sinon.restore())

  it("prints only the marker with no file and the image defaults", () => {
    // Arrange
    const stdout = sinon.spy()
    const stderr = sinon.spy()

    // Act
    const code = printOneEnv({
      env: { ...IMAGE_DEFAULTS },
      loadConfig: loadOneConfig,
      stdout,
      stderr
    })

    // Assert
    expect(code).to.equal(0)
    expect(written(stdout)).to.equal("export ROUTR_ONE_CONFIG_LOADED='1'\n")
    expect(stderr).to.not.have.been.called
  })

  it("prints the file's env vars on stdout and the warnings on stderr", () => {
    // Arrange
    const path = withSpec(
      "  signaling:\n    externalAddrs: [2.2.2.2]\n    keyStorePassword: s3cr'et\n"
    )
    const stdout = sinon.spy()
    const stderr = sinon.spy()

    // Act
    const code = printOneEnv({
      env: {
        ...IMAGE_DEFAULTS,
        ROUTR_ONE_CONFIG: path,
        EXTERNAL_ADDRS: "1.1.1.1",
        LOCALNETS: "10.0.0.0/8"
      },
      loadConfig: loadOneConfig,
      stdout,
      stderr
    })

    // Assert
    expect(code).to.equal(0)
    expect(written(stdout)).to.equal(
      [
        "export EXTERNAL_ADDRS='2.2.2.2'",
        "export PKCS12_PASSWORD='s3cr'\\''et'",
        "export ROUTR_ONE_CONFIG_LOADED='1'",
        ""
      ].join("\n")
    )
    expect(written(stderr)).to.equal(
      [
        `EXTERNAL_ADDRS is ignored; spec.signaling.externalAddrs in ${path} wins`,
        `LOCALNETS is deprecated; set spec.signaling.localnets in ${path}`,
        ""
      ].join("\n")
    )
  })

  it("exits 1 with an empty stdout on a loader error", () => {
    // Arrange
    const path = withSpec(
      "  signaling:\n    keyStorePassword: GENERATE-YOUR-OWN-keystore-password\n"
    )
    const stdout = sinon.spy()
    const stderr = sinon.spy()

    // Act
    const code = printOneEnv({
      env: { ROUTR_ONE_CONFIG: path },
      loadConfig: loadOneConfig,
      stdout,
      stderr
    })

    // Assert
    expect(code).to.equal(1)
    expect(stdout).to.not.have.been.called
    expect(written(stderr)).to.match(/^spec\.signaling\.keyStorePassword: /)
    expect(written(stderr)).to.not.include("keystore-password")
  })

  it("exits 0 when called the way print_env.ts calls it", () => {
    // Arrange
    const stdout = sinon.spy()
    const stderr = sinon.spy()

    // Act
    const code = printOneEnv({
      env: { ...process.env },
      loadConfig: loadOneConfig,
      stdout,
      stderr
    })

    // Assert
    expect(code).to.equal(0)
    expect(written(stdout)).to.match(/export ROUTR_ONE_CONFIG_LOADED='1'\n$/)
  })

  it("throws ValidationError on invalid input", () => {
    // Arrange
    const loadConfig = sinon.spy(loadOneConfig)
    const stdout = sinon.spy()

    // Act
    const err = errorOf(() =>
      printOneEnv({
        env: {},
        loadConfig,
        stdout,
        stderr: "nope"
      } as unknown as Parameters<typeof printOneEnv>[0])
    )

    // Assert
    expect(err).to.be.instanceOf(CommonErrors.ValidationError)
    expect(loadConfig).to.not.have.been.called
    expect(stdout).to.not.have.been.called
  })
})
