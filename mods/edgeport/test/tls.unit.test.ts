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
import {
  DEFAULT_TLS_CIPHER_SUITES,
  DEFAULT_TLS_PROTOCOLS,
  resolveTlsSetting
} from "../src/tls"

const expect = chai.expect

describe("@routr/edgeport/tls", () => {
  it("defaults to TLS 1.3 only", () => {
    expect(DEFAULT_TLS_PROTOCOLS).to.deep.equal(["TLSv1.3"])
  })

  it("defaults to forward-secret AEAD cipher suites only", () => {
    DEFAULT_TLS_CIPHER_SUITES.forEach((suite) => {
      expect(suite).to.match(/^TLS_(AES|CHACHA20|ECDHE_(ECDSA|RSA)_WITH)_/)
      expect(suite).to.match(/_(GCM|POLY1305)_SHA(256|384)$/)
    })
  })

  it("uses the environment over the config", () => {
    expect(
      resolveTlsSetting(["TLSv1.2"], ["TLSv1.3"], DEFAULT_TLS_PROTOCOLS)
    ).to.deep.equal(["TLSv1.2"])
  })

  it("uses the config when the environment is empty", () => {
    expect(
      resolveTlsSetting([], ["TLSv1.3", "TLSv1.2"], DEFAULT_TLS_PROTOCOLS)
    ).to.deep.equal(["TLSv1.3", "TLSv1.2"])
  })

  it("uses the default when neither is set", () => {
    expect(
      resolveTlsSetting([], undefined, DEFAULT_TLS_PROTOCOLS)
    ).to.deep.equal(DEFAULT_TLS_PROTOCOLS)
    expect(resolveTlsSetting([], [], DEFAULT_TLS_PROTOCOLS)).to.deep.equal(
      DEFAULT_TLS_PROTOCOLS
    )
  })
})
