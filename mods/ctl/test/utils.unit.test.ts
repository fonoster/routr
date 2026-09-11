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
import * as Utils from "../src/utils"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import SDK from "@routr/sdk"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/ctl/utils", () => {
  afterEach(() => sandbox.restore())

  it("capitalizes a string", () => {
    expect(Utils.capitalize("hELLO")).to.equal("Hello")
  })

  it("splits a comma-separated ACL rule into a trimmed array", () => {
    expect(
      Utils.stringToAcl("0.0.0.0/0, 10.0.0.1 , 192.168.1.1")
    ).to.deep.equal(["0.0.0.0/0", "10.0.0.1", "192.168.1.1"])
  })

  it("parses headers and drops empty entries", () => {
    expect(Utils.stringToHeaders("X-A:1,X-B:2,")).to.deep.equal([
      { name: "X-A", value: "1" },
      { name: "X-B", value: "2" }
    ])
  })

  it("converts a word to Pascal case", () => {
    expect(Utils.toPascalCase("hello")).to.equal("Hello")
  })

  it("maps the balancing algorithm to a friendly label", () => {
    expect(
      Utils.getTextForBalancingAlgorithm(CT.LoadBalancingAlgorithm.ROUND_ROBIN)
    ).to.equal("Round Robin")
    expect(
      Utils.getTextForBalancingAlgorithm(
        CT.LoadBalancingAlgorithm.LEAST_SESSIONS
      )
    ).to.equal("Least Connections")
  })

  describe("showPaginatedList", () => {
    it("renders a single item when a ref is provided", async () => {
      const item = { ref: "ref-1", name: "Local Network ACL" }
      const getAcl = sandbox
        .stub(SDK.Acls.prototype, "getAcl")
        .resolves(item as never)
      const showTable = sandbox.stub()

      await Utils.showPaginatedList({
        showTable,
        args: { ref: "ref-1" },
        flags: { endpoint: "localhost:51907", insecure: true, size: 50 },
        kind: CC.Kind.ACL,
        self: {} as never
      })

      expect(getAcl).to.have.been.calledOnceWith("ref-1")
      expect(showTable).to.have.been.calledOnce
      expect(showTable.firstCall.firstArg.data).to.deep.equal([item])
    })

    it("renders a page of items when no ref is provided", async () => {
      const items = [
        { ref: "ref-1", name: "A" },
        { ref: "ref-2", name: "B" }
      ]
      const listAcls = sandbox
        .stub(SDK.Acls.prototype, "listAcls")
        .resolves({ items, nextPageToken: "" } as never)
      const showTable = sandbox.stub()

      await Utils.showPaginatedList({
        showTable,
        args: {},
        flags: { endpoint: "localhost:51907", insecure: true, size: 50 },
        kind: CC.Kind.ACL,
        self: {} as never
      })

      expect(listAcls).to.have.been.calledOnce
      expect(showTable).to.have.been.calledOnce
      expect(showTable.firstCall.firstArg.data).to.deep.equal(items)
      expect(showTable.firstCall.firstArg.showHeader).to.equal(true)
    })
  })
})
