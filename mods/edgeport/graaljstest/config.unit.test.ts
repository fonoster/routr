/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
import { getConfig, readFile, validateConfig } from "../src/config/get_config"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/edgeport/config", () => {
  afterEach(() => sandbox.restore())

  it("fails because file does not meet schema criteria", () => {
    const result = readFile(__dirname + ".././../config/edgeport.yaml")
    expect(result).to.have.property("_tag").to.be.equal("Right")

    if (result._tag === "Right") {
      const json = JSON.parse(result.right)
      json.metadata = { region: "us-east1" }
      const res = validateConfig(json)
      expect(res).to.have.property("_tag").to.be.equal("Left")
    }
  })

  it("reads a file a returns a string", () => {
    const result = getConfig(
      "/Users/pedrosanders/Projects/routr/config/edgeport.yaml"
    )
    expect(result).to.have.property("right").to.have.property("kind")
  })
})
