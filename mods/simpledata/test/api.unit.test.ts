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
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import {find, get} from '../src/api'
import {resources} from './examples'

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

describe('@routr/simpledata/api', () => {
  afterEach(() => sandbox.restore());

  describe('@routr/simpledata/api/get', () => {
    it('gets a not found', done => {
      const call = {request: {ref: "crd2c76ft"}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(null)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it('gets a not found', done => {
      const call = {request: {ref: "crd2c76ft"}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(null)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it('gets resource by reference', done => {
      const call = {request: {ref: "crd2c76ftxxxx"}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.not.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it('gets bad request', done => {
      const call = {request: {}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it('gets resource by reference', done => {
      const call = {request: {ref: "crd2c76ft"}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.null
        expect(res).to.have.property('metadata')
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })
  })

  describe('@routr/simpledata/api/find', () => {
    it('gets a not found', done => {
      const call = {request: {}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(null)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it('gets bad request', done => {
      const call = {request: {}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.not.null
        expect(res).to.be.null
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      get(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    // As per https://www.npmjs.com/package/jsonpath
    it('finds a resource using json-path', done => {
      const call = {request: {query: "$..[?(@.spec.credentials.username=='username')]"}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.null
        expect(res.resources).to.be.an('array').to.be.lengthOf(1)
        done()
      }
      const callbackSpy = sandbox.spy(callback)
      find(resources)(call, callback)
      expect(callbackSpy).to.have.been.calledOnce
    })

    it('is bad json-path', done => {
      const call = {request: {query: "*.%@3sdsd"}}
      const callback = (err: any, res: any) => {
        expect(err).to.be.not.null
        done()
      }
      find(resources)(call, callback)
    })
  })
})
