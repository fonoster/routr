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
import { mkdtempSync, readFileSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { CommonErrors } from "@routr/common"
import { loadOneConfig } from "../src/config"

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

const writeConfig = (content: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "routr-one-")), "one.yaml")
  writeFileSync(path, content)
  return path
}

const withSpec = (spec: string): string =>
  writeConfig(`${HEADER}spec:\n${spec}`)

const errorOf = (fn: () => unknown): Error => {
  try {
    fn()
  } catch (e) {
    return e as Error
  }
  throw new Error("expected an error")
}

describe("@routr/one[config/load_one_config]", () => {
  it("returns an empty env and no warnings when there is no file", () => {
    // Act
    const out = loadOneConfig({ path: undefined, env: {} })

    // Assert
    expect(out.env).to.deep.equal({})
    expect(out.warnings).to.deep.equal([])
    expect(out.config).to.deep.equal({
      kind: "RoutrOne",
      apiVersion: "v2beta1",
      ref: "routr-one",
      spec: {}
    })
  })

  it("does not warn about env vars equal to the image defaults", () => {
    const out = loadOneConfig({ env: { ...IMAGE_DEFAULTS } })

    expect(out.warnings).to.deep.equal([])
    expect(out.env).to.deep.equal({})
  })

  it("throws naming a missing ROUTR_ONE_CONFIG", () => {
    const err = errorOf(() =>
      loadOneConfig({ env: { ROUTR_ONE_CONFIG: "/nope.yaml" } })
    )

    expect(err.message).to.contain("/nope.yaml")
  })

  it("throws naming a missing explicit path", () => {
    const err = errorOf(() => loadOneConfig({ path: "/nope.yaml", env: {} }))

    expect(err.message).to.contain("/nope.yaml")
  })

  it("reads the file named by ROUTR_ONE_CONFIG", () => {
    const path = withSpec("  database:\n    startInternal: false\n")

    const out = loadOneConfig({ env: { ROUTR_ONE_CONFIG: path } })

    expect(out.env).to.deep.equal({ START_INTERNAL_DB: "false" })
  })

  it("throws naming each unknown key by its full path", () => {
    const path = withSpec(
      "  bogus: 1\n  recording:\n    enabled: true\n    path: /x\n    extra: 2\n"
    )

    const err = errorOf(() => loadOneConfig({ path, env: {} }))

    expect(err.message).to.contain("spec.bogus")
    expect(err.message).to.contain("spec.recording.extra")
  })

  it("throws naming an invalid recording mode", () => {
    const path = withSpec(
      "  recording:\n    enabled: true\n    path: /x\n    mode: sometimes\n"
    )

    const err = errorOf(() => loadOneConfig({ path, env: {} }))

    expect(err.message).to.contain("spec.recording.mode")
    expect(err.message).not.to.contain("sometimes")
  })

  it("rejects a wrong kind or apiVersion", () => {
    const path = writeConfig(
      "kind: Other\napiVersion: v1\nref: routr-one\nspec: {}\n"
    )

    const err = errorOf(() => loadOneConfig({ path, env: {} }))

    expect(err.message).to.contain("kind")
    expect(err.message).to.contain("apiVersion")
  })

  it("coerces a scalar from ${VAR} to its schema type", () => {
    const path = withSpec("  rtprelay:\n    port: ${P}\n")

    const out = loadOneConfig({ path, env: { P: "22223" } })

    expect(out.config.spec.rtprelay.port).to.equal(22223)
    expect(out.env.RTPENGINE_PORT).to.equal("22223")
  })

  it("does not coerce a list from a ${VAR} string", () => {
    const path = withSpec("  signaling:\n    localnets: ${L}\n")

    const err = errorOf(() => loadOneConfig({ path, env: { L: "10.0.0.0/8" } }))

    expect(err.message).to.contain("spec.signaling.localnets")
    expect(err.message).not.to.contain("10.0.0.0/8")
  })

  it("rejects empty localnets and externalAddrs", () => {
    const localnets = withSpec("  signaling:\n    localnets: []\n")
    const externalAddrs = withSpec("  signaling:\n    externalAddrs: []\n")

    expect(
      errorOf(() => loadOneConfig({ path: localnets, env: {} })).message
    ).to.contain("spec.signaling.localnets")
    expect(
      errorOf(() => loadOneConfig({ path: externalAddrs, env: {} })).message
    ).to.contain("spec.signaling.externalAddrs")
  })

  it("never validates or rewrites env var values", () => {
    const out = loadOneConfig({
      env: {
        IGNORE_LOOPBACK_FROM_LOCALNETS: "True",
        ENABLE_HEALTHCHECKS: "1",
        JAIN_SIP_TRACE_LEVEL: "DEBUG"
      }
    })

    expect(out.env).to.deep.equal({})
  })

  it("refuses a GENERATE-YOUR-OWN placeholder in a secret key", () => {
    const path = withSpec(
      "  signaling:\n    keyStorePassword: GENERATE-YOUR-OWN-pw\n"
    )

    const err = errorOf(() => loadOneConfig({ path, env: {} }))

    expect(err.message).to.contain("spec.signaling.keyStorePassword")
  })

  it("never refuses a placeholder that comes from the environment", () => {
    const path = withSpec("  signaling:\n    keyStorePassword: ${KSP}\n")

    expect(() =>
      loadOneConfig({ env: { PKCS12_PASSWORD: "changeme" } })
    ).not.to.throw()
    expect(() =>
      loadOneConfig({ path, env: { KSP: "GENERATE-YOUR-OWN-x" } })
    ).not.to.throw()
  })

  it("lets the file win over an env var and warns without values", () => {
    const path = withSpec("  database:\n    url: bbbb\n")

    const out = loadOneConfig({ path, env: { DATABASE_URL: "aaaa" } })

    expect(out.env.DATABASE_URL).to.equal("bbbb")
    expect(out.warnings).to.deep.equal([
      `DATABASE_URL is ignored; spec.database.url in ${path} wins`
    ])
  })

  it("warns about a deprecated env var the file doesn't set", () => {
    const out = loadOneConfig({
      env: { EXTERNAL_ADDRS: "1.2.3.4" }
    })

    expect(out.env).to.not.have.property("EXTERNAL_ADDRS")
    expect(out.warnings).to.deep.equal([
      "EXTERNAL_ADDRS is deprecated; set spec.signaling.externalAddrs in /etc/routr/one.yaml"
    ])
  })

  it("leaves out absent keys and maps an empty list to an empty string", () => {
    const absent = withSpec("  connect:\n    trustedEdgeports: [a, b]\n")
    const empty = withSpec("  connect:\n    untrustedHeadersToStrip: []\n")

    const absentOut = loadOneConfig({ path: absent, env: {} })
    const emptyOut = loadOneConfig({ path: empty, env: {} })

    expect(absentOut.env).to.deep.equal({ TRUSTED_EDGEPORTS: "a,b" })
    expect(emptyOut.env).to.deep.equal({ UNTRUSTED_HEADERS_TO_STRIP: "" })
  })

  it("maps telemetry.enabled to OTEL_SDK_DISABLED, inverted", () => {
    const off = withSpec("  telemetry:\n    enabled: false\n")
    const on = withSpec("  telemetry:\n    enabled: true\n")

    expect(loadOneConfig({ path: off, env: {} }).env).to.deep.equal({
      OTEL_SDK_DISABLED: "true"
    })
    expect(loadOneConfig({ path: on, env: {} }).env).to.deep.equal({
      OTEL_SDK_DISABLED: "false"
    })
  })

  it("maps objects to JSON", () => {
    const path = withSpec(
      "  connect:\n    verifier:\n      options:\n        audience: x\n"
    )

    const out = loadOneConfig({ path, env: {} })

    expect(out.env).to.deep.equal({
      CONNECT_VERIFIER_OPTIONS: JSON.stringify({ audience: "x" })
    })
  })

  it("keeps the file-only recording keys unchanged", () => {
    const path = withSpec(
      [
        "  recording:",
        "    enabled: true",
        "    path: /var/routr/traces",
        "    redact: false",
        "    lint:",
        "      profiles: [sip, sip-connect]",
        "      window: 5",
        "    maxRecordsPerCall: 100",
        "    maxCalls: 10",
        "    idleTimeoutSeconds: 30",
        ""
      ].join("\n")
    )

    const out = loadOneConfig({ path, env: {} })

    expect(out.config.spec.recording).to.deep.equal({
      enabled: true,
      path: "/var/routr/traces",
      redact: false,
      lint: { profiles: ["sip", "sip-connect"], window: 5 },
      maxRecordsPerCall: 100,
      maxCalls: 10,
      idleTimeoutSeconds: 30
    })
    expect(out.env).to.deep.equal({
      RECORD_MESSAGES: "true",
      RECORD_MESSAGES_PATH: "/var/routr/traces"
    })
  })

  it("loads etc/one.example.yaml once its placeholders are replaced", () => {
    const example = readFileSync(
      join(__dirname, "..", "..", "..", "etc", "one.example.yaml"),
      "utf8"
    )
    const path = writeConfig(example.replace(/GENERATE-YOUR-OWN/g, "generated"))

    expect(() => loadOneConfig({ path, env: {} })).not.to.throw()
    expect(
      errorOf(() => loadOneConfig({ path: writeConfig(example), env: {} }))
        .message
    ).to.contain("GENERATE-YOUR-OWN")
  })

  it("throws ValidationError on invalid input", () => {
    const err = errorOf(() =>
      loadOneConfig({ env: "nope" } as unknown as Parameters<
        typeof loadOneConfig
      >[0])
    )

    expect(err).to.be.instanceOf(CommonErrors.ValidationError)
  })
})
