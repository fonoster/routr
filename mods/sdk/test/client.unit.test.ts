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
import * as path from "path"
import SDK, { buildCredentials } from "../src"
import { buildMetadata } from "../src/client"

const expect = chai.expect
const REMOTE = "10.0.0.5:51907"
const CACERT = path.join(__dirname, "fixtures", "ca.crt")
const REFUSAL =
  "ALLOW_INSECURE would send the API key in clear to 10.0.0.5:51907. Set insecure: true (--insecure in rctl) to accept that, or unset ALLOW_INSECURE for TLS (cacert, --cacert in rctl, for a private CA)."

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

  describe("buildCredentials", () => {
    const allowInsecure = process.env.ALLOW_INSECURE

    afterEach(() => {
      if (allowInsecure === undefined) delete process.env.ALLOW_INSECURE
      else process.env.ALLOW_INSECURE = allowInsecure
    })

    const key = { apiKey: "the-key" }
    const basic = { username: "u", password: "p" }

    it("opens TLS without ALLOW_INSECURE and plaintext with insecure", () => {
      delete process.env.ALLOW_INSECURE
      expect(buildCredentials({ endpoint: REMOTE, ...key })._isSecure()).to.be
        .true
      expect(
        buildCredentials({
          endpoint: REMOTE,
          insecure: true,
          ...key
        })._isSecure()
      ).to.be.false
    })

    it("refuses ALLOW_INSECURE with an API key beyond loopback", () => {
      process.env.ALLOW_INSECURE = "true"
      expect(() => buildCredentials({ endpoint: REMOTE, ...key })).to.throw(
        Error,
        REFUSAL
      )
    })

    it("refuses ALLOW_INSECURE with a username and a password beyond loopback", () => {
      process.env.ALLOW_INSECURE = "true"
      expect(() => buildCredentials({ endpoint: REMOTE, ...basic })).to.throw(
        Error,
        REFUSAL
      )
    })

    it("sends a credential in clear beyond loopback with insecure: true", () => {
      process.env.ALLOW_INSECURE = "true"
      expect(
        buildCredentials({
          endpoint: REMOTE,
          insecure: true,
          ...key
        })._isSecure()
      ).to.be.false
      expect(
        buildCredentials({
          endpoint: REMOTE,
          insecure: true,
          ...basic
        })._isSecure()
      ).to.be.false
    })

    it("opens TLS with a cacert whatever ALLOW_INSECURE says", () => {
      process.env.ALLOW_INSECURE = "true"
      expect(
        buildCredentials({
          endpoint: REMOTE,
          cacert: CACERT,
          ...key
        })._isSecure()
      ).to.be.true
      expect(
        buildCredentials({
          endpoint: REMOTE,
          cacert: CACERT,
          ...basic
        })._isSecure()
      ).to.be.true
    })

    it("keeps ALLOW_INSECURE as plaintext with no credential", () => {
      process.env.ALLOW_INSECURE = "true"
      expect(buildCredentials({ endpoint: REMOTE })._isSecure()).to.be.false
      // A username alone is not sent, so it is no credential
      expect(buildCredentials({ endpoint: REMOTE, username: "u" })._isSecure())
        .to.be.false
    })

    it("keeps ALLOW_INSECURE as plaintext toward loopback with a key", () => {
      process.env.ALLOW_INSECURE = "true"
      const endpoints = ["127.0.0.1:51907", "localhost:51907", "[::1]:51907"]
      endpoints.forEach(
        (endpoint) =>
          expect(buildCredentials({ endpoint, ...key })._isSecure(), endpoint)
            .to.be.false
      )
    })

    it("does not take a host that only starts like loopback for loopback", () => {
      process.env.ALLOW_INSECURE = "true"
      const endpoints = ["127.example.com:51907", "localhost.example.com:51907"]
      endpoints.forEach((endpoint) =>
        expect(() => buildCredentials({ endpoint, ...key }), endpoint).to.throw(
          Error,
          `in clear to ${endpoint}.`
        )
      )
    })

    it("makes the client throw from its constructor", () => {
      process.env.ALLOW_INSECURE = "true"
      expect(() => new SDK.Agents({ endpoint: REMOTE, ...key })).to.throw(
        Error,
        REFUSAL
      )
    })
  })
})
