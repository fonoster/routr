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
import { resolveRecording } from "../src/config/resolve_recording"
import { recordingFromEnv } from "../src/recording"

chai.use(sinonChai)
const expect = chai.expect

const HEADER = "kind: RoutrOne\napiVersion: v2beta1\nref: routr-one\n"

const withSpec = (spec: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "routr-one-")), "one.yaml")
  writeFileSync(path, `${HEADER}spec:\n${spec}`)
  return path
}

const RECORDING = [
  "  recording:",
  "    enabled: true",
  "    path: /tmp/r",
  "    redact: false",
  "    maxCalls: 5",
  ""
].join("\n")

const MINIMAL = "  recording:\n    enabled: true\n    path: /tmp/r\n"

const errorOf = (fn: () => unknown): Error => {
  try {
    fn()
  } catch (e) {
    return e as Error
  }
  throw new Error("expected an error")
}

describe("@routr/one[config/resolve_recording]", () => {
  afterEach(() => sinon.restore())

  it("returns the file's recording block unchanged", () => {
    // Arrange
    const logger = { warn: sinon.spy() }
    const env = { ROUTR_ONE_CONFIG: withSpec(RECORDING) }

    // Act
    const result = resolveRecording({ env, loadConfig: loadOneConfig, logger })

    // Assert
    expect(result).to.deep.equal({
      enabled: true,
      path: "/tmp/r",
      redact: false,
      maxCalls: 5
    })
    expect(logger.warn).to.not.have.been.called
  })

  it("falls back to RECORD_MESSAGES* with a deprecation warning", () => {
    // Arrange
    const logger = { warn: sinon.spy() }
    const env = { RECORD_MESSAGES: "true" }

    // Act
    const result = resolveRecording({ env, loadConfig: loadOneConfig, logger })

    // Assert
    expect(result).to.deep.equal(recordingFromEnv(env))
    expect(logger.warn).to.have.been.calledOnceWithExactly(
      "RECORD_MESSAGES is deprecated; set spec.recording.enabled in /etc/routr/one.yaml"
    )
  })

  it("lets the file win over RECORD_MESSAGES", () => {
    // Arrange
    const logger = { warn: sinon.spy() }
    const path = withSpec(RECORDING)
    const env = { ROUTR_ONE_CONFIG: path, RECORD_MESSAGES: "false" }

    // Act
    const result = resolveRecording({ env, loadConfig: loadOneConfig, logger })

    // Assert
    expect(result).to.include({ enabled: true, path: "/tmp/r", maxCalls: 5 })
    expect(logger.warn).to.have.been.calledOnceWithExactly(
      `RECORD_MESSAGES is ignored; spec.recording.enabled in ${path} wins`
    )
  })

  it("logs nothing when ROUTR_ONE_CONFIG_LOADED=1", () => {
    // Arrange
    const logger = { warn: sinon.spy() }
    const env = {
      ROUTR_ONE_CONFIG: withSpec(RECORDING),
      ROUTR_ONE_CONFIG_LOADED: "1",
      RECORD_MESSAGES: "false"
    }

    // Act
    const result = resolveRecording({ env, loadConfig: loadOneConfig, logger })

    // Assert
    expect(result).to.include({ enabled: true, path: "/tmp/r", maxCalls: 5 })
    expect(logger.warn).to.not.have.been.called
  })

  it("takes the mode from RECORD_MESSAGES_MODE when the file has none", () => {
    // Arrange
    const logger = { warn: sinon.spy() }
    const path = withSpec(MINIMAL)
    const env = { ROUTR_ONE_CONFIG: path, RECORD_MESSAGES_MODE: "all" }

    // Act
    const result = resolveRecording({ env, loadConfig: loadOneConfig, logger })

    // Assert
    expect(result).to.deep.equal({ enabled: true, path: "/tmp/r", mode: "all" })
    expect(logger.warn).to.have.been.calledOnceWithExactly(
      `RECORD_MESSAGES_MODE is deprecated; set spec.recording.mode in ${path}`
    )
  })

  it("throws on a bad RECORD_MESSAGES_MODE when the file has no mode", () => {
    // Arrange
    const env = {
      ROUTR_ONE_CONFIG: withSpec(MINIMAL),
      RECORD_MESSAGES_MODE: "x"
    }

    // Act
    const err = errorOf(() =>
      resolveRecording({
        env,
        loadConfig: loadOneConfig,
        logger: { warn: sinon.spy() }
      })
    )

    // Assert
    expect(err.message).to.match(/^RECORD_MESSAGES_MODE must be one of /)
  })

  it("throws the loader's message on a bad recording.mode in the file", () => {
    // Arrange
    const env = { ROUTR_ONE_CONFIG: withSpec(`${MINIMAL}    mode: xyzzy\n`) }

    // Act
    const err = errorOf(() =>
      resolveRecording({
        env,
        loadConfig: loadOneConfig,
        logger: { warn: sinon.spy() }
      })
    )

    // Assert
    expect(err.message).to.contain("spec.recording.mode")
    expect(err.message).to.not.contain("xyzzy")
  })

  it("does not log warnings about non-recording env vars", () => {
    // Arrange
    const logger = { warn: sinon.spy() }
    const env = {
      ROUTR_ONE_CONFIG: withSpec(
        "  signaling:\n    externalAddrs: [1.2.3.4]\n"
      ),
      EXTERNAL_ADDRS: "5.6.7.8"
    }

    // Act
    resolveRecording({ env, loadConfig: loadOneConfig, logger })

    // Assert
    expect(logger.warn).to.not.have.been.calledWithMatch(/EXTERNAL_ADDRS/)
  })

  it("throws ValidationError on invalid input", () => {
    // Arrange
    const loadConfig = sinon.spy(loadOneConfig)
    const logger = { warn: sinon.spy() }

    // Act
    const err = errorOf(() =>
      resolveRecording({
        env: "nope",
        loadConfig,
        logger
      } as unknown as Parameters<typeof resolveRecording>[0])
    )

    // Assert
    expect(err).to.be.instanceOf(CommonErrors.ValidationError)
    expect(loadConfig).to.not.have.been.called
  })
})
