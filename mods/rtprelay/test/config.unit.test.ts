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
import fs from "fs"
import os from "os"
import path from "path"
import { getConfig } from "../src/config/get_config"
import { DEFAULT_PROFILES, mergeProfiles } from "../src/profiles"

const header = "kind: RTPRelay\napiVersion: v2beta1\n"

describe("@routr/rtprelay/config", () => {
  let dir: string

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rtprelay-config-"))
  })

  after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const write = (name: string, content: string) => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, content)
    return file
  }

  describe("merging over the defaults", () => {
    it("keeps the other keys of a profile when one key is set", () => {
      const profiles = mergeProfiles({
        "phone-to-secure-phone": { SDES: ["only-AES_CM_128_HMAC_SHA1_80"] }
      })
      const profile = profiles["phone-to-secure-phone"]
      chai.expect(profile.SDES).to.deep.equal(["only-AES_CM_128_HMAC_SHA1_80"])
      chai.expect(profile).to.have.property("transport-protocol", "RTP/SAVP")
      chai
        .expect(profile.flags)
        .to.deep.equal(DEFAULT_PROFILES["phone-to-secure-phone"].flags)
    })

    it("replaces a list instead of appending to it", () => {
      const profiles = mergeProfiles({
        "web-to-phone": { flags: ["trust-address"] }
      })
      chai
        .expect(profiles["web-to-phone"].flags)
        .to.deep.equal(["trust-address"])
    })

    it("leaves the profiles it does not mention untouched", () => {
      const profiles = mergeProfiles({ "web-to-web": { ICE: "remove" } })
      chai
        .expect(profiles["phone-to-web"])
        .to.deep.equal(DEFAULT_PROFILES["phone-to-web"])
      chai.expect(DEFAULT_PROFILES["web-to-web"].ICE).to.equal("force")
    })
  })

  describe("reading the file", () => {
    it("runs with the defaults when no path is set or the file is missing", () => {
      const unset = getConfig(undefined)
      chai.expect(unset._tag).to.equal("Right")
      if (unset._tag === "Right") {
        chai.expect(unset.right.profiles).to.deep.equal(DEFAULT_PROFILES)
        chai.expect(unset.right.source).to.be.undefined
      }

      const missing = getConfig(path.join(dir, "nope.yaml"))
      chai.expect(missing._tag).to.equal("Right")
      if (missing._tag === "Right") {
        chai.expect(missing.right.profiles).to.deep.equal(DEFAULT_PROFILES)
      }
    })

    it("loads, validates and merges a file", () => {
      const file = write(
        "ok.yaml",
        header +
          "spec:\n" +
          "  rtpengine:\n" +
          "    host: rtpengine.local\n" +
          "  profiles:\n" +
          "    phone-to-secure-phone:\n" +
          "      SDES: [only-AES_CM_128_HMAC_SHA1_80]\n"
      )
      const result = getConfig(file)
      chai.expect(result._tag).to.equal("Right")
      if (result._tag === "Right") {
        chai.expect(result.right.source).to.equal(file)
        chai.expect(result.right.rtpengine?.host).to.equal("rtpengine.local")
        chai
          .expect(result.right.profiles["phone-to-secure-phone"])
          .to.have.property("transport-protocol", "RTP/SAVP")
        chai
          .expect(result.right.profiles["phone-to-secure-phone"].SDES)
          .to.deep.equal(["only-AES_CM_128_HMAC_SHA1_80"])
        chai
          .expect(result.right.profiles["web-to-web"])
          .to.deep.equal(DEFAULT_PROFILES["web-to-web"])
      }
    })

    it("rejects a profile name it does not know", () => {
      const file = write(
        "unknown.yaml",
        header + "spec:\n  profiles:\n    web-to-fax:\n      ICE: remove\n"
      )
      const result = getConfig(file)
      chai.expect(result._tag).to.equal("Left")
      if (result._tag === "Left") {
        chai.expect(result.left.message).to.include("web-to-fax")
      }
    })

    it("rejects a value that is neither a string nor a list of strings", () => {
      const file = write(
        "badvalue.yaml",
        header + "spec:\n  profiles:\n    web-to-web:\n      SDES: 1\n"
      )
      const result = getConfig(file)
      chai.expect(result._tag).to.equal("Left")
      if (result._tag === "Left") {
        chai.expect(result.left.message).to.include("SDES")
      }
    })

    it("rejects a file of another kind", () => {
      const file = write(
        "kind.yaml",
        "kind: EdgePort\napiVersion: v2beta1\nspec: {}\n"
      )
      chai.expect(getConfig(file)._tag).to.equal("Left")
    })
  })
})
