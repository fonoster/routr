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
import { CommonConnect as CC } from "@routr/common"
import { mkdtempSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { numbersLoader } from "../src/loaders/numbers"
import loadResources from "../src/utils"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/simpledata/number_aliases", () => {
  afterEach(() => sandbox.restore())

  const numberYaml = (ref: string, telUrl: string, alias: string) => `
- apiVersion: v2
  kind: Number
  ref: ${ref}
  metadata:
    name: Carrier UK
    geoInfo: { city: London, country: United Kingdom, countryIsoCode: GB }
  spec:
    trunkRef: trunk-01
    location:
      telUrl: ${telUrl}
      aliases: ["${alias}"]
      aorLink: sip:1001@sip.local
`
  const trunkYaml = `
- apiVersion: v2
  kind: Trunk
  ref: trunk-01
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

  it("reads aliases from YAML and defaults to none", () => {
    const config = (aliases?: string[]) =>
      ({
        apiVersion: CC.APIVersion.V2,
        kind: CC.Kind.NUMBER,
        ref: "number-01",
        metadata: {
          name: "Carrier UK main line",
          geoInfo: {
            city: "London",
            country: "United Kingdom",
            countryIsoCode: "GB"
          }
        },
        spec: {
          location: {
            telUrl: "tel:+442079460018",
            aorLink: "sip:1001@sip.local",
            ...(aliases ? { aliases } : {})
          }
        }
      } as CC.UserConfig)

    expect(numbersLoader(config(["01234"]), []).aliases).to.deep.equal([
      "01234"
    ])
    expect(numbersLoader(config(), []).aliases).to.deep.equal([])
  })

  it("loads Numbers whose aliases differ within a Trunk", () => {
    const exit = sandbox.stub(process, "exit")
    const dir = resourcesWith(
      numberYaml("number-01", "tel:+442079460018", "01234") +
        numberYaml("number-02", "tel:+442079460019", "5678")
    )

    const numbers = loadResources(dir, CC.Kind.NUMBER) as CC.INumber[]

    expect(exit).to.not.have.been.called
    expect(numbers.map((number) => number.aliases)).to.deep.equal([
      ["01234"],
      ["5678"]
    ])
  })

  it("exits when two Numbers of a Trunk share an alias", () => {
    const exit = sandbox.stub(process, "exit")
    const dir = resourcesWith(
      numberYaml("number-01", "tel:+442079460018", "01234") +
        numberYaml("number-02", "tel:+442079460019", "01234")
    )

    loadResources(dir, CC.Kind.NUMBER)

    expect(exit).to.have.been.calledOnceWithExactly(1)
  })
})
