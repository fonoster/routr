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
import { generateNonce, isNonceFresh } from "../src/auth"

const expect = chai.expect

describe("@routr/common/auth", () => {
  const now = () => 1700000000000
  const secondsLater = (seconds: number) => () => now() + seconds * 1000

  it("issues a nonce that carries the second it was made", () => {
    const nonce = generateNonce("MD5", now)
    expect(nonce).to.match(/^[0-9a-f]+\.[0-9a-f]{32}$/)
    expect(parseInt(nonce.split(".")[0], 16)).to.equal(1700000000)
  })

  it("accepts a nonce within its max age and rejects an older one", () => {
    const nonce = generateNonce("MD5", now)
    expect(isNonceFresh(nonce, 300, secondsLater(299))).to.be.true
    expect(isNonceFresh(nonce, 300, secondsLater(301))).to.be.false
  })

  it("rejects a nonce in another format", () => {
    expect(isNonceFresh("b5a3226fa1899b33872e953643e0bca9", 300, now)).to.be
      .false
    expect(isNonceFresh("", 300, now)).to.be.false
    expect(isNonceFresh(undefined, 300, now)).to.be.false
    expect(isNonceFresh("zz.abc", 300, now)).to.be.false
  })

  it("accepts any nonce when the max age is zero", () => {
    expect(isNonceFresh("b5a3226fa1899b33872e953643e0bca9", 0, now)).to.be.true
  })
})
