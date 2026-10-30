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
import Ajv from "ajv"
import { schema } from "../src/config/schema"
import { getAliases } from "../src/aliases"

const expect = chai.expect

describe("@routr/edgeport/aliases", () => {
  it("uses spec.aliases when ALIASES is unset", () => {
    expect(getAliases([], ["routr"])).to.deep.equal(["routr"])
  })

  it("lets ALIASES override spec.aliases", () => {
    expect(getAliases(["routr"], ["other"])).to.deep.equal(["routr"])
  })

  it("has no aliases when neither sets any", () => {
    expect(getAliases([], undefined)).to.deep.equal([])
  })

  it("treats an empty ALIASES as unset", () => {
    expect(getAliases([""], ["other"])).to.deep.equal(["other"])
  })

  describe("config schema", () => {
    const validate = new Ajv().compile(schema)
    const configWith = (aliases: unknown) => ({
      kind: "EdgePort",
      apiVersion: "v2beta1",
      ref: "edgeport-01",
      spec: {
        methods: ["INVITE"],
        transport: [{ protocol: "udp", port: 5060 }],
        processor: { addr: "dispatcher:51901" },
        aliases
      }
    })

    it("accepts a list of hostnames", () => {
      expect(validate(configWith(["routr", "sip.example.com"]))).to.be.true
    })

    it("rejects a single hostname given as a string", () => {
      expect(validate(configWith("routr"))).to.be.false
    })

    it("rejects a repeated hostname", () => {
      expect(validate(configWith(["routr", "routr"]))).to.be.false
    })
  })
})
