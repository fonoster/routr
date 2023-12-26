/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { findBy, get } from "../src/api"
import { configs } from "./examples"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/simpledata/api", () => {
  afterEach(() => sandbox.restore())

  describe("get functionality", () => {
    it("gets a not found", (done) => {
      const call = { request: { ref: "credentials-01" } }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get(null as any)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("gets bad request", (done) => {
      const call = { request: {} }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(configs)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("gets resource by reference (checks name)", (done) => {
      const call = { request: { ref: "credentials-01" } }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.null
        expect(res).to.have.property("name")
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(configs)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("it returns an error since the reference doesn't exist", (done) => {
      const call = { request: { ref: "credentials-01xxxx" } }
      const callback = (err: Error) => {
        expect(err).to.be.not.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(configs)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })
  })

  describe("find functionality", () => {
    // As per https://www.npmjs.com/package/jsonpath
    it("finds a resource using findBy method", (done) => {
      const call = {
        request: {
          fieldName: "ref",
          fieldValue: "credentials-01"
        }
      }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((res as any).items)
          .to.be.an("array")
          .to.be.lengthOf(1)
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      findBy(configs)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("returns an empty array since the resource doesn't exist", (done) => {
      const call = {
        request: {
          fieldName: "ref",
          fieldValue: "credentials-01xxxx"
        }
      }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((res as any).items)
          .to.be.an("array")
          .to.be.lengthOf(0)
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      findBy([])(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })
  })
})
