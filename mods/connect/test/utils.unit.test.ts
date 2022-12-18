/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import { request } from "@routr/processor/test/examples"
import { dataAPI } from "./mock_apis"
import {
  createPAssertedIdentity,
  createRemotePartyId,
  createTrunkAuthentication
} from "../src/utils"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

/* eslint-disable prettier/prettier */

describe("@routr/connect/utils", () => {
  afterEach(() => sandbox.restore())

  it("creates a new p-asserted-identity header", async () => {
    // eslint-disable-next-line prettier/prettier
    const number = (
      await dataAPI.findBy({
        kind: CC.Kind.NUMBER,
        criteria: CC.FindCriteria.FIND_NUMBER_BY_TELURL,
        parameters: {
          telUrl: "tel:17066041487"
        }
      })
    )[0]
    const trunk = await dataAPI.get(number.spec.trunkRef)
    const headerModifier = createPAssertedIdentity(request, trunk, number)
    expect(headerModifier).to.have.property("action", CT.HeaderModifierAction.ADD)
    expect(headerModifier).to.have.property("name", "P-Asserted-Identity")
    expect(headerModifier).to.have.property(
      "value",
      "\"John Doe\" <sip:17066041487@sip.provider.net;user=phone>"
    )
  })

  it("creates a new remote-party-id header", async () => {
    // eslint-disable-next-line prettier/prettier
    const number = (
      await dataAPI.findBy({
        kind: CC.Kind.NUMBER,
        criteria: CC.FindCriteria.FIND_NUMBER_BY_TELURL,
        parameters: {
          telUrl: "tel:17066041487"
        }
      })
    )[0]
    const trunk = await dataAPI.get(number.spec.trunkRef)
    const headerModifier = createRemotePartyId(trunk, number)
    expect(headerModifier).to.have.property("action", CT.HeaderModifierAction.ADD)
    expect(headerModifier).to.have.property("name", "Remote-Party-ID")
    expect(headerModifier).to.have.property(
      "value",
      "<sip:17066041487@sip.provider.net>;screen=yes;party=calling"
    )
  })

  it("creates a new x-gateway-auth header", async () => {
    const trunk = await dataAPI.get("trunk-acme-com-01")
    const headerModifier = await createTrunkAuthentication(dataAPI, trunk)
    expect(headerModifier).to.have.property("action", CT.HeaderModifierAction.ADD)
    expect(headerModifier).to.have.property("name", CT.ExtraHeader.GATEWAY_AUTH)
    expect(headerModifier).to.have.property("value", "cGJ4LTE6MTIzNA==")
  })
})
