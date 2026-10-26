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
import { mkdirSync, mkdtempSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Config } from "../src"
import { resolveSecretRefs } from "../src/config"
import { ValidationError } from "../src/errors"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/common[config/resolve_secret_refs]", () => {
  const dir = mkdtempSync(join(tmpdir(), "routr-secret-refs-"))
  mkdirSync(join(dir, "db"))
  writeFileSync(join(dir, "db", "url"), "postgres://u:p@db/x\n")
  writeFileSync(join(dir, "plain"), "s3cr3t\n")

  afterEach(() => sandbox.restore())

  it("is exported from @routr/common as Config.resolveSecretRefs", () => {
    expect(Config.resolveSecretRefs).to.equal(resolveSecretRefs)
  })

  it("resolves secret://env/NAME", () => {
    const out = resolveSecretRefs({
      input: { key: "secret://env/DG_KEY" },
      env: { DG_KEY: "dg" }
    })

    expect(out).to.deep.equal({ key: "dg" })
  })

  it("throws naming the key path and reference when the env var is unset", () => {
    expect(() =>
      resolveSecretRefs({
        input: { providers: { dg: { key: "secret://env/MISSING" } } },
        env: {}
      })
    ).to.throw(
      "providers.dg.key: secret://env/MISSING: environment variable MISSING is not set"
    )
  })

  it("resolves secret://file/<path> and drops one trailing newline", () => {
    const out = resolveSecretRefs({
      input: { a: `secret://file${join(dir, "plain")}` }
    })

    expect(out).to.deep.equal({ a: "s3cr3t" })
  })

  it("names the path and reference of a missing file, never its content", () => {
    const ref = `secret://file${join(dir, "nope")}`

    expect(() => resolveSecretRefs({ input: { a: ref } })).to.throw(
      `a: ${ref}: cannot read ${join(dir, "nope")} (ENOENT)`
    )
  })

  it("never puts file content in an error", () => {
    // Arrange
    const readFile = sandbox.stub().throws(new Error("s3cr3t"))

    // Act + Assert
    expect(() =>
      resolveSecretRefs({ input: { a: "secret://file/x" }, readFile })
    )
      .to.throw(/^a: secret:\/\/file\/x: cannot read \/x$/)
      .and.not.to.match(/s3cr3t/)
  })

  it("reads secret://k8s/<secret>#<key> from <secretsDir>/<secret>/<key>", () => {
    const out = resolveSecretRefs({
      input: { db: "secret://k8s/db#url" },
      secretsDir: dir
    })

    expect(out).to.deep.equal({ db: "postgres://u:p@db/x" })
  })

  it("defaults secretsDir to ROUTR_SECRETS_DIR, then /var/run/routr/secrets", () => {
    // Arrange
    const readFile = sandbox.stub().returns("v")

    // Act
    resolveSecretRefs({
      input: "secret://k8s/db#url",
      env: { ROUTR_SECRETS_DIR: "/s" },
      readFile
    })
    resolveSecretRefs({ input: "secret://k8s/db#url", env: {}, readFile })

    // Assert
    expect(readFile.firstCall).to.have.been.calledWith("/s/db/url")
    expect(readFile.secondCall).to.have.been.calledWith(
      "/var/run/routr/secrets/db/url"
    )
  })

  it("accepts the pod's namespace and refuses another one", () => {
    const env = { POD_NAMESPACE: "routr" }

    expect(
      resolveSecretRefs({
        input: "secret://k8s/routr/db#url",
        env,
        secretsDir: dir
      })
    ).to.equal("postgres://u:p@db/x")
    expect(() =>
      resolveSecretRefs({
        input: "secret://k8s/other/db#url",
        env,
        secretsDir: dir
      })
    ).to.throw(/namespace other/)
  })

  it("walks objects and arrays and leaves non-exact references alone", () => {
    const out = resolveSecretRefs({
      input: {
        a: { b: ["secret://env/ONE", "literal", { c: "x secret://env/ONE" }] }
      },
      env: { ONE: "1" }
    })

    expect(out).to.deep.equal({
      a: { b: ["1", "literal", { c: "x secret://env/ONE" }] }
    })
  })

  it("rejects malformed and unknown references", () => {
    const resolve = (input: string) => () =>
      resolveSecretRefs({ input, env: {} })

    expect(resolve("secret://vault/x")).to.throw(/unsupported reference/)
    expect(resolve("secret://k8s/db")).to.throw(/missing #<key>/)
    expect(resolve("secret://env/1BAD")).to.throw(/invalid variable name/)
  })

  describe("with invalid params", () => {
    it("throws ValidationError when env is not an object", () => {
      expect(() =>
        resolveSecretRefs({ input: { a: "x" }, env: "A=1" } as never)
      ).to.throw(ValidationError)
    })

    it("throws ValidationError when readFile is not a function", () => {
      expect(() =>
        resolveSecretRefs({ input: { a: "x" }, readFile: "fs" } as never)
      ).to.throw(ValidationError)
    })
  })
})
