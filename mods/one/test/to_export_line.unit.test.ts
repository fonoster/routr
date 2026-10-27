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
import { execFileSync } from "child_process"
import { CommonErrors } from "@routr/common"
import { toExportLine } from "../src/config/to_export_line"

const expect = chai.expect

const errorOf = (fn: () => unknown): Error => {
  try {
    fn()
  } catch (e) {
    return e as Error
  }
  throw new Error("expected an error")
}

describe("@routr/one[config/to_export_line]", () => {
  it("single-quotes the value", () => {
    // Act
    const line = toExportLine({ name: "TLS_ON", value: "false" })

    // Assert
    expect(line).to.equal("export TLS_ON='false'")
  })

  it("round-trips quotes, substitutions and newlines through sh", () => {
    // Arrange
    const value = "a'b $(echo pwned) `id` $HOME\nc\\d"
    const line = toExportLine({ name: "NAME", value })

    // Act
    const script = String.raw`eval "$OUT"; printf %s "$NAME"`
    const out = execFileSync("sh", ["-c", script], {
      env: { PATH: process.env.PATH, OUT: line }
    }).toString()

    // Assert
    expect(out).to.equal(value)
  })

  it("throws ValidationError on a name that isn't an env var name", () => {
    // Act
    const err = errorOf(() => toExportLine({ name: "A; rm -rf /", value: "x" }))

    // Assert
    expect(err).to.be.instanceOf(CommonErrors.ValidationError)
  })

  it("throws ValidationError on a value that isn't a string", () => {
    // Act
    const err = errorOf(() =>
      toExportLine({ name: "A", value: 1 } as unknown as Parameters<
        typeof toExportLine
      >[0])
    )

    // Assert
    expect(err).to.be.instanceOf(CommonErrors.ValidationError)
  })
})
