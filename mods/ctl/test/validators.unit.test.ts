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
import * as validators from "../src/validators"
import chai from "chai"

const expect = chai.expect

// A validator returns `true` when valid, or a `string` message when invalid.
describe("@routr/ctl/validators", () => {
  it("nameValidator accepts a friendly name and rejects an empty one", () => {
    expect(validators.nameValidator("Local Domain")).to.equal(true)
    expect(validators.nameValidator("")).to.be.a("string")
    expect(validators.nameValidator("x".repeat(61))).to.be.a("string")
  })

  it("usernameValidator rejects empty and spaced usernames", () => {
    expect(validators.usernameValidator("jdoe")).to.equal(true)
    expect(validators.usernameValidator("")).to.be.a("string")
    expect(validators.usernameValidator("john doe")).to.be.a("string")
  })

  it("optionalUsernameValidator allows empty but rejects spaces", () => {
    expect(validators.optionalUsernameValidator("")).to.equal(true)
    expect(validators.optionalUsernameValidator("john doe")).to.be.a("string")
  })

  it("aclRuleValidator accepts a CIDR and rejects garbage", () => {
    expect(validators.aclRuleValidator("0.0.0.0/0")).to.equal(true)
    expect(validators.aclRuleValidator("not-a-cidr")).to.be.a("string")
  })

  it("telUrlValidator requires a tel: prefix", () => {
    expect(validators.telUrlValidator("tel:+17853178070")).to.equal(true)
    expect(validators.telUrlValidator("+17853178070")).to.be.a("string")
  })

  it("domainUriValidator accepts an FQDN and rejects empty", () => {
    expect(validators.domainUriValidator("sip.local")).to.equal(true)
    expect(validators.domainUriValidator("")).to.be.a("string")
  })

  it("aorValidator accepts a sip: AOR and rejects empty", () => {
    expect(validators.aorValidator("sip:1001@sip.local")).to.equal(true)
    expect(validators.aorValidator("")).to.be.a("string")
  })

  it("hostValidator accepts a host and rejects empty", () => {
    expect(validators.hostValidator("sip.provider.net")).to.equal(true)
    expect(validators.hostValidator("")).to.be.a("string")
  })

  it("portValidator accepts a valid port and rejects a non-numeric one", () => {
    expect(validators.portValidator("5060")).to.equal(true)
    expect(validators.portValidator("not-a-port")).to.be.a("string")
  })

  it("priorityValidator and weightValidator accept valid numbers", () => {
    expect(validators.priorityValidator("10")).to.equal(true)
    expect(validators.weightValidator("10")).to.equal(true)
  })

  it("maxContactsValidator handles empty, non-numeric and negative values", () => {
    expect(validators.maxContactsValidator("")).to.equal(true)
    expect(validators.maxContactsValidator("5")).to.equal(true)
    expect(validators.maxContactsValidator("abc")).to.be.a("string")
    expect(validators.maxContactsValidator("-1")).to.be.a("string")
  })

  it("headersValidator accepts well-formed headers", () => {
    expect(validators.headersValidator("X-Custom:value")).to.equal(true)
  })
})
