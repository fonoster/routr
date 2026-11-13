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
import { trunksLoader } from "../src/loaders/trunks"

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

  it("exits on a prefix with a # or more than 20 characters", () => {
    exitsOn({ calledNumberFormat: "national", calledNumberPrefix: "9#" })
    sandbox.restore()
    exitsOn({ callerNumberPrefix: "0".repeat(21) })
  })

  it("reads a prefix without its format, which does nothing", () => {
    const trunk = trunksLoader(trunkConfig({ callerNumberPrefix: "9" }), [])

    expect(trunk).to.include({ callerNumberPrefix: "9" })
    expect(trunk.callerNumberFormat).to.be.undefined
  })
})
