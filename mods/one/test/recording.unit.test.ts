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
import { recordingFromEnv } from "../src/recording"

const expect = chai.expect

describe("@routr/one[recording]", () => {
  it("returns undefined when no RECORD_MESSAGES* var is set", () => {
    expect(recordingFromEnv({})).to.be.undefined
  })

  it("defaults the path when RECORD_MESSAGES=true", () => {
    expect(recordingFromEnv({ RECORD_MESSAGES: "true" })).to.deep.equal({
      enabled: true,
      path: "/var/routr/traces"
    })
  })

  it("throws on a bad RECORD_MESSAGES_MODE", () => {
    expect(() => recordingFromEnv({ RECORD_MESSAGES_MODE: "x" })).to.throw(
      "RECORD_MESSAGES_MODE must be one of"
    )
  })
})
