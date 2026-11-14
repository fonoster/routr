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
import { CommonConnect as CC, parseBooleanEnv } from "@routr/common"
import { mkdtempSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { assertE164Numbers } from "../src/assert_e164_numbers"
import loadResources from "../src/utils"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const numberYaml = (telUrl: string, countryIsoCode = "GB") => `
- apiVersion: v2
  kind: Number
  ref: number-uk
  metadata:
    name: London
    geoInfo: { city: London, country: United Kingdom, countryIsoCode: ${countryIsoCode} }
  spec:
    trunkRef: trunk-uk
    location:
      telUrl: "${telUrl}"
      aorLink: sip:1001@sip.local
`
const trunkYaml = `
- apiVersion: v2
  kind: Trunk
  ref: trunk-uk
  metadata: { name: Carrier UK }
  spec:
    inbound: { uri: carrier-uk.pstn.example }
`
const resourcesWith = (numbers: string) => {
  const dir = mkdtempSync(join(tmpdir(), "routr-simpledata-"))
  writeFileSync(join(dir, "numbers.yaml"), numbers)
  writeFileSync(join(dir, "trunks.yaml"), trunkYaml)
  return dir
}

const notE164 = (telUrl: string) =>
  `telUrl "${telUrl}" is not E.164: use tel:+ followed by 2 to 15 digits, the first not 0; or set REQUIRE_E164_NUMBERS=false`

describe("@routr/simpledata REQUIRE_E164_NUMBERS", () => {
  afterEach(() => sandbox.restore())

  it("stops simpledata on a value other than true or false", () => {
    expect(() => parseBooleanEnv("REQUIRE_E164_NUMBERS", "yes")).to.throw(
      `REQUIRE_E164_NUMBERS must be true or false, got "${"yes"}"`
    )
    expect(parseBooleanEnv("REQUIRE_E164_NUMBERS", undefined)).to.be.false
  })

  it("names the Number whose telUrl isn't E.164", () => {
    const resources = [
      {
        apiVersion: CC.APIVersion.V2,
        kind: CC.Kind.NUMBER,
        ref: "number-uk",
        metadata: { name: "London" },
        spec: { location: { telUrl: "tel:2079460018" } }
      } as CC.UserConfig
    ]

    expect(() => assertE164Numbers(resources, true)).to.throw(
      `Number number-uk: ${notE164("tel:2079460018")}`
    )
    expect(() => assertE164Numbers(resources, false)).to.not.throw()
  })

  it("exits 1 on tel:2079460018 when true", () => {
    const exit = sandbox.stub(process, "exit")

    loadResources(resourcesWith(numberYaml("tel:2079460018")), CC.Kind.NUMBER, {
      requireE164Numbers: true
    })

    expect(exit).to.have.been.calledOnceWithExactly(1)
  })

  it("loads the same file when unset", () => {
    const exit = sandbox.stub(process, "exit")

    const numbers = loadResources(
      resourcesWith(numberYaml("tel:2079460018")),
      CC.Kind.NUMBER
    )

    expect(exit).to.not.have.been.called
    expect(numbers).to.have.lengthOf(1)
  })

  it("loads a Number whose countryIsoCode has no numbering plan", () => {
    const exit = sandbox.stub(process, "exit")

    const numbers = loadResources(
      resourcesWith(numberYaml("tel:+442079460018", "ZZ")),
      CC.Kind.NUMBER,
      { requireE164Numbers: true }
    ) as CC.INumber[]

    expect(exit).to.not.have.been.called
    expect(numbers[0]).to.have.property("countryIsoCode", "ZZ")
  })
})
