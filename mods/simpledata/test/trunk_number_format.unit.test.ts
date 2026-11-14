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
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import { mkdtempSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { trunksLoader } from "../src/loaders/trunks"
import { assertTrunkNumberFormats } from "../src/assert_trunk_number_formats"
import loadResources from "../src/utils"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const trunkConfig = (spec: Record<string, unknown> = {}) =>
  ({
    apiVersion: CC.APIVersion.V2,
    kind: CC.Kind.TRUNK,
    ref: "trunk-01",
    metadata: { name: "Carrier UK" },
    spec: {
      inbound: { uri: "carrier-uk.pstn.example" },
      ...spec
    }
  } as CC.UserConfig)

describe("@routr/simpledata number formats of a Trunk", () => {
  afterEach(() => sandbox.restore())

  it("reads the formats, written in kebab-case, and the prefixes", () => {
    const trunk = trunksLoader(
      trunkConfig({
        calledNumberFormat: "national",
        calledNumberPrefix: "9",
        callerNumberFormat: "e164-without-plus"
      }),
      []
    )

    expect(trunk).to.include({
      calledNumberFormat: CT.NumberFormat.NATIONAL,
      calledNumberPrefix: "9",
      callerNumberFormat: CT.NumberFormat.E164_WITHOUT_PLUS
    })
    expect(trunk.callerNumberPrefix).to.be.undefined
  })

  it("leaves the formats out of a Trunk that sets none", () => {
    const trunk = trunksLoader(trunkConfig(), [])

    expect(trunk.calledNumberFormat).to.be.undefined
    expect(trunk.callerNumberFormat).to.be.undefined
  })

  // A bad resource stops simpledata, as for every other field
  const exitsOn = (spec: Record<string, unknown>) => {
    const exit = sandbox.stub(process, "exit")

    try {
      trunksLoader(trunkConfig(spec), [])
    } catch (e) {
      // Past the stubbed exit, the mapper has nothing valid to map
    }

    expect(exit).to.have.been.calledWith(1)
  }

  it("exits on a format the schema doesn't know", () => {
    exitsOn({ calledNumberFormat: "local" })
  })

  it("exits on a prefix over 20 characters or with other characters", () => {
    exitsOn({ calledNumberFormat: "national", calledNumberPrefix: "9a" })
    sandbox.restore()
    exitsOn({
      callerNumberFormat: "national",
      callerNumberPrefix: "0".repeat(21)
    })
  })

  it("reads international and a prefix with #", () => {
    const trunk = trunksLoader(
      trunkConfig({
        calledNumberFormat: "international",
        calledNumberPrefix: "9#"
      }),
      []
    )

    expect(trunk).to.include({
      calledNumberFormat: CT.NumberFormat.INTERNATIONAL,
      calledNumberPrefix: "9#"
    })
  })

  describe("the rules the API Server applies", () => {
    const trunkWith = (spec: Record<string, unknown>) => [trunkConfig(spec)]
    const needs = (name: string) =>
      `Trunk trunk-01: ${name}NumberPrefix needs ${name}NumberFormat e164-without-plus, national or international`
    const characters = (name: string) =>
      `Trunk trunk-01: ${name}NumberPrefix may contain only digits, * and # (up to 20)`

    ;["called", "caller"].forEach((name) => {
      it(`rejects a ${name} prefix with no format or with e164`, () => {
        expect(() =>
          assertTrunkNumberFormats(trunkWith({ [`${name}NumberPrefix`]: "9" }))
        ).to.throw(needs(name))
        expect(() =>
          assertTrunkNumberFormats(
            trunkWith({
              [`${name}NumberFormat`]: "e164",
              [`${name}NumberPrefix`]: "9"
            })
          )
        ).to.throw(needs(name))
      })

      it(`rejects a ${name} prefix with other characters`, () => {
        expect(() =>
          assertTrunkNumberFormats(
            trunkWith({
              [`${name}NumberFormat`]: "national",
              [`${name}NumberPrefix`]: "9a"
            })
          )
        ).to.throw(characters(name))
      })

      it(`accepts a ${name} prefix 9# with national`, () => {
        expect(() =>
          assertTrunkNumberFormats(
            trunkWith({
              [`${name}NumberFormat`]: "national",
              [`${name}NumberPrefix`]: "9#"
            })
          )
        ).to.not.throw()
      })
    })

    it("exits 1 when a Trunk file breaks a rule", () => {
      const exit = sandbox.stub(process, "exit")
      const dir = mkdtempSync(join(tmpdir(), "routr-simpledata-"))
      writeFileSync(
        join(dir, "trunks.yaml"),
        `
- apiVersion: v2
  kind: Trunk
  ref: trunk-01
  metadata: { name: Carrier UK }
  spec:
    inbound: { uri: carrier-uk.pstn.example }
    callerNumberPrefix: "9"
`
      )

      loadResources(dir, CC.Kind.TRUNK)

      expect(exit).to.have.been.calledWith(1)
    })
  })
})
