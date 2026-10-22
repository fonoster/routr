/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
import { printTable } from "../src/lib/table"
import chai from "chai"

const expect = chai.expect

// Capture everything printTable emits into a single string.
const capture = (fn: (printLine: (line: string) => void) => void): string => {
  const lines: string[] = []
  fn((line) => lines.push(line))
  return lines.join("\n")
}

describe("@routr/ctl/lib/table", () => {
  const data = [
    { ref: "ref-1", name: "Local Network ACL", deny: ["0.0.0.0/0"] }
  ]

  it("renders default and custom headers with cell values", () => {
    const out = capture((printLine) =>
      printTable(
        data,
        {
          ref: { minWidth: 7 },
          name: {},
          deny: {
            header: "Deny List",
            get: (row) => (row.deny as string[]).join(", ")
          }
        },
        { printLine }
      )
    )

    expect(out).to.contain("Ref")
    expect(out).to.contain("Name")
    expect(out).to.contain("Deny List")
    expect(out).to.contain("Local Network ACL")
    expect(out).to.contain("0.0.0.0/0")
  })

  it("omits the header row when no-header is set", () => {
    const out = capture((printLine) =>
      printTable(data, { name: {} }, { printLine, "no-header": true })
    )

    expect(out).to.not.contain("Name")
    expect(out).to.contain("Local Network ACL")
  })

  it("hides extended columns unless the extended flag is set", () => {
    const columns = {
      name: {},
      ref: { header: "Ref", extended: true }
    }

    const plain = capture((printLine) =>
      printTable(data, columns, { printLine })
    )
    expect(plain).to.not.contain("ref-1")

    const extended = capture((printLine) =>
      printTable(data, columns, { printLine, extended: true })
    )
    expect(extended).to.contain("ref-1")
  })
})
