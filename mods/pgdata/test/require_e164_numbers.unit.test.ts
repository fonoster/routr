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
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://localhost:5432/routr"

import * as grpc from "@grpc/grpc-js"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import {
  CommonConnect as CC,
  CommonErrors as CE,
  parseBooleanEnv
} from "@routr/common"
import { NumberManager } from "../src/mappers/number"
import { create } from "../src/api/create"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

const numberWith = (fields: Partial<CC.INumber> = {}) =>
  ({
    apiVersion: CC.APIVersion.V2,
    name: "London",
    telUrl: "tel:+442079460018",
    city: "London",
    country: "United Kingdom",
    countryIsoCode: "GB",
    ...fields
  } as CC.INumber)

const validate = (fields: Partial<CC.INumber>, requireE164Numbers?: boolean) =>
  new NumberManager(numberWith(fields)).validOrThrowCreate({
    requireE164Numbers
  })

const notE164 = (telUrl: string) =>
  `telUrl "${telUrl}" is not E.164: use tel:+ followed by 2 to 15 digits, the first not 0; or set REQUIRE_E164_NUMBERS=false`

describe("@routr/pgdata REQUIRE_E164_NUMBERS", () => {
  afterEach(() => sandbox.restore())

  it("is read as true or false, unset and empty being false", () => {
    expect(parseBooleanEnv("REQUIRE_E164_NUMBERS", undefined)).to.be.false
    expect(parseBooleanEnv("REQUIRE_E164_NUMBERS", "")).to.be.false
    expect(parseBooleanEnv("REQUIRE_E164_NUMBERS", "false")).to.be.false
    expect(parseBooleanEnv("REQUIRE_E164_NUMBERS", "true")).to.be.true
  })

  it("stops the service on any other value", () => {
    expect(() => parseBooleanEnv("REQUIRE_E164_NUMBERS", "yes")).to.throw(
      `REQUIRE_E164_NUMBERS must be true or false, got "${"yes"}"`
    )
  })

  describe("unset", () => {
    it("creates Numbers that aren't E.164", () => {
      ;["tel:02079460018", "tel:5551234"].forEach((telUrl) =>
        expect(() => validate({ telUrl })).to.not.throw()
      )
    })

    it("still needs tel:", () => {
      expect(() => validate({ telUrl: "sip:x" })).to.throw(
        CE.BadRequestError,
        "the telUrl must start with `tel:`"
      )
    })
  })

  describe("true", () => {
    it("rejects a telUrl that isn't tel:+E.164", () => {
      ;["tel:02079460018", "tel:+0123", "tel:+1234567890123456"].forEach(
        (telUrl) =>
          expect(() => validate({ telUrl }, true))
            .to.throw(CE.BadRequestError, notE164(telUrl))
            .with.property("code", grpc.status.INVALID_ARGUMENT)
      )
    })

    it("creates tel:+442079460018", () => {
      expect(() =>
        validate({ telUrl: "tel:+442079460018" }, true)
      ).to.not.throw()
    })
  })

  describe("countryIsoCode on create", () => {
    const createNumber = async (countryIsoCode: string) => {
      const operation = sandbox.stub().rejects(new Error("not reached"))
      const callback = sandbox.stub()
      await create(operation as never, CC.Kind.NUMBER)(
        { request: numberWith({ countryIsoCode }) } as never,
        callback
      )
      return { operation, error: callback.firstCall.args[0] }
    }

    it("rejects XX, GBR and ZZ", async () => {
      await Promise.all(
        ["XX", "GBR", "ZZ"].map(async (countryIsoCode) => {
          const { operation, error } = await createNumber(countryIsoCode)
          expect(operation).to.not.have.been.called
          expect(error).to.include({
            code: grpc.status.INVALID_ARGUMENT,
            message: `countryIsoCode "${countryIsoCode}" is not a country with a numbering plan`
          })
        })
      )
    })

    it("accepts gb", () => {
      expect(() => validate({ countryIsoCode: "gb" })).to.not.throw()
    })
  })
})
