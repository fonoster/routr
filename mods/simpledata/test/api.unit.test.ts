/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import { BadRequest } from "../src/errors"
import { CommonConnect as CC } from "@routr/common"
import { createQuery } from "../src/utils"
import { resources } from "./examples"
import * as protobufUtil from "pb-util"
const jsonToStruct = protobufUtil.struct.encode

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
      get(null)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("gets a not found", (done) => {
      const call = { request: { ref: "credentials-01" } }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(null)(call, callback)
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
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("gets resource by reference (checks metadata)", (done) => {
      const call = { request: { ref: "credentials-01" } }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.null
        expect(res).to.have.property("metadata")
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("it returns an error since the reference doesn't exist", (done) => {
      const call = { request: { ref: "credentials-01xxxx" } }
      const callback = (err: Error) => {
        expect(err).to.be.not.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })
  })

  describe("find functionality", () => {
    it("gets a not found", (done) => {
      const call = { request: {} }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(null)(call, callback)
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
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it("creates query based on find criteria and parameters", () => {
      const searchParameters: CC.FindParameters = {
        kind: CC.Kind.AGENT,
        criteria: CC.FindCriteria.FIND_AGENT_BY_USERNAME,
        parameters: jsonToStruct({
          username: "myusername"
        }) as Record<string, string>
      }
      const result = createQuery(searchParameters)
      expect(result).to.have.property("request").to.have.property("kind")
      expect(result)
        .to.have.property("query")
        .to.equal("$..[?(@.spec.username=='myusername')]")
    })

    it("fails to create query due to bad criteria", () => {
      const searchParameters: CC.FindParameters = {
        kind: CC.Kind.AGENT,
        criteria: "bad_criteria" as never,
        parameters: jsonToStruct({
          username: "myusername"
        }) as Record<string, string>
      }
      expect(createQuery(searchParameters)).to.be.instanceOf(BadRequest)
    })

    it("fails to create query due to missing parameter", () => {
      const searchParameters: CC.FindParameters = {
        kind: CC.Kind.AGENT,
        parameters: jsonToStruct({
          username: "myusername"
        }) as Record<string, string>
      } as never
      expect(createQuery(searchParameters)).to.be.instanceOf(BadRequest)
    })

    // As per https://www.npmjs.com/package/jsonpath
    it("finds a resource using findBy method", (done) => {
      const call = {
        request: {
          kind: CC.Kind.CREDENTIAL,
          criteria: CC.FindCriteria.FIND_CREDENTIAL_BY_REFERENCE,
          parameters: jsonToStruct({
            ref: "credentials-01"
          })
        }
      }
      const callback = (err: Error, res: unknown) => {
        expect(err).to.be.null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((res as any).resources)
          .to.be.an("array")
          .to.be.lengthOf(1)
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      findBy(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })
  })
})
