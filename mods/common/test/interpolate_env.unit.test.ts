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
import { Config } from "../src"
import { interpolateEnv } from "../src/config"
import { ValidationError } from "../src/errors"

const expect = chai.expect

describe("@routr/common[config/interpolate_env]", () => {
  it("is exported from @routr/common as Config.interpolateEnv", () => {
    expect(Config.interpolateEnv).to.equal(interpolateEnv)
  })

  it("replaces a ${VAR} reference inside a string", () => {
    // Act
    const out = interpolateEnv({ input: { a: "x-${FOO}" }, env: { FOO: "1" } })

    // Assert
    expect(out).to.deep.equal({ a: "x-1" })
  })

  it("walks nested objects and arrays", () => {
    const out = interpolateEnv({
      input: { a: { b: ["${ONE}", "literal", { c: "${TWO}" }] } },
      env: { ONE: "1", TWO: "2" }
    })

    expect(out).to.deep.equal({ a: { b: ["1", "literal", { c: "2" }] } })
  })

  it("resolves multiple references inside one string", () => {
    const out = interpolateEnv({
      input: "${HOST}:${PORT}",
      env: { HOST: "db", PORT: "5432" }
    })

    expect(out).to.equal("db:5432")
  })

  it("leaves plain literals untouched, including a bare $", () => {
    const input = { price: "$5.00", url: "http://asterisk:8088" }

    expect(interpolateEnv({ input, env: {} })).to.deep.equal(input)
  })

  it("does not mutate the input", () => {
    const input = { a: "${FOO}" }

    interpolateEnv({ input, env: { FOO: "1" } })

    expect(input).to.deep.equal({ a: "${FOO}" })
  })

  it("uses the default in ${VAR:-default} when the var is unset or empty", () => {
    expect(
      interpolateEnv({ input: { a: "${FOO:-d}" }, env: {} })
    ).to.deep.equal({ a: "d" })
    expect(interpolateEnv({ input: "${FOO:-d}", env: { FOO: "" } })).to.equal(
      "d"
    )
    expect(interpolateEnv({ input: "${FOO:-}", env: {} })).to.equal("")
  })

  it("prefers the env value over the default", () => {
    expect(
      interpolateEnv({ input: "${LEVEL:-info}", env: { LEVEL: "debug" } })
    ).to.equal("debug")
  })

  it("throws naming the key path and ${VAR} when VAR is unset or empty", () => {
    expect(() => interpolateEnv({ input: { a: "${FOO}" }, env: {} })).to.throw(
      /^a: .*\$\{FOO\}/
    )
    expect(() =>
      interpolateEnv({ input: { a: "${FOO}" }, env: { FOO: "" } })
    ).to.throw(/^a: .*\$\{FOO\}/)
  })

  it("throws naming the path of a ${...} outside allowedPaths", () => {
    const input = { db: { url: "${DB}" }, logs: { level: "${X}" } }

    expect(() =>
      interpolateEnv({
        input,
        env: { DB: "pg", X: "info" },
        allowedPaths: ["db.*"]
      })
    ).to.throw(/^logs\.level: /)
  })

  it("interpolates the paths allowedPaths names", () => {
    const out = interpolateEnv({
      input: { db: "${DB}", nats: { url: "${NATS}" }, name: "${NAME}" },
      env: { DB: "pg", NATS: "n", NAME: "x" },
      allowedPaths: ["db", "nats.*", "name"]
    })

    expect(out).to.deep.equal({ db: "pg", nats: { url: "n" }, name: "x" })
  })

  it("returns non-string primitives unchanged", () => {
    const input = { enabled: false, count: 3, nothing: null as string | null }

    expect(interpolateEnv({ input, env: {} })).to.deep.equal(input)
  })

  describe("with invalid params", () => {
    it("throws ValidationError when env is not an object", () => {
      expect(() =>
        interpolateEnv({ input: { a: "${FOO}" }, env: "FOO=1" } as never)
      ).to.throw(ValidationError)
    })

    it("throws ValidationError when env is missing", () => {
      expect(() => interpolateEnv({ input: { a: "x" } } as never)).to.throw(
        ValidationError
      )
    })
  })
})
