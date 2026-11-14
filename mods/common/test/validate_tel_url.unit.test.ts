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
import * as grpc from "@grpc/grpc-js"
import { CommonConnect as CC, CommonErrors as CE } from "../src"

const expect = chai.expect

const notE164 = (telUrl: string) =>
  `telUrl "${telUrl}" is not E.164: use tel:+ followed by 2 to 15 digits, the first not 0; or set REQUIRE_E164_NUMBERS=false`

describe("@routr/common/connect/validate_tel_url", () => {
  describe("without REQUIRE_E164_NUMBERS", () => {
    it("accepts any telUrl that starts with tel:", () => {
      ;["tel:02079460018", "tel:5551234", "tel:+442079460018"].forEach(
        (telUrl) =>
          expect(() =>
            CC.validateTelUrl({ telUrl, requireE164: false })
          ).to.not.throw()
      )
    })

    it("rejects a telUrl that doesn't start with tel:", () => {
      expect(() => CC.validateTelUrl({ telUrl: "sip:x", requireE164: false }))
        .to.throw(CE.BadRequestError, "the telUrl must start with `tel:`")
        .with.property("code", grpc.status.INVALID_ARGUMENT)
    })
  })

  describe("with REQUIRE_E164_NUMBERS", () => {
    it("accepts tel:+ and an E.164 number", () => {
      expect(() =>
        CC.validateTelUrl({ telUrl: "tel:+442079460018", requireE164: true })
      ).to.not.throw()
    })

    it("rejects a national form, a leading 0 and more than 15 digits", () => {
      ;[
        "tel:02079460018",
        "tel:+0123",
        "tel:+1234567890123456",
        "sip:x"
      ].forEach((telUrl) =>
        expect(() => CC.validateTelUrl({ telUrl, requireE164: true }))
          .to.throw(CE.BadRequestError, notE164(telUrl))
          .with.property("code", grpc.status.INVALID_ARGUMENT)
      )
    })
  })

  describe("with invalid input", () => {
    it("throws ValidationError when requireE164 is missing", () => {
      expect(() => CC.validateTelUrl({ telUrl: "tel:+1" })).to.throw(
        CE.ValidationError
      )
    })
  })
})
