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
import { buildMetadata } from "../src/client"

const expect = chai.expect

describe("@routr/sdk/client", () => {
  describe("buildMetadata", () => {
    it("sends the API key as a bearer token", () => {
      const metadata = buildMetadata({ endpoint: "e", apiKey: "the-key" })
      expect(metadata.get("authorization")).to.deep.equal(["Bearer the-key"])
    })

    it("prefers the API key over a username and a password", () => {
      const metadata = buildMetadata({
        endpoint: "e",
        apiKey: "the-key",
        username: "u",
        password: "p"
      })
      expect(metadata.get("authorization")).to.deep.equal(["Bearer the-key"])
    })

    it("keeps sending a username and a password", () => {
      const metadata = buildMetadata({
        endpoint: "e",
        username: "u",
        password: "p"
      })
      expect(metadata.get("authorization")).to.deep.equal(["Basic dTpw"])
    })

    it("sends nothing with neither", () => {
      expect(buildMetadata({ endpoint: "e" }).get("authorization")).to.be.empty
    })
  })
})
