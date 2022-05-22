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
import { MessageRequest, Route } from '@routr/common'
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { request, route } from "../../processor/test/examples"
import { handleRegister, handleRequest } from "../src/utils"
import {
  Extensions as E,
  Helper as HE
} from "@routr/processor"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

describe('@routr/connect', () => {
  afterEach(() => sandbox.restore());

  it('updates a request for inter-domain routing', () => {
    // Test tailorInterDomainRoute
    const tailorInterDomainRoute = require('../src/tailor').tailorInterDomainRoute
    const tailoredRequest = tailorInterDomainRoute(route as Route, request as MessageRequest)
    expect(tailoredRequest.message.requestUri.user).to.equal(route.user)
    expect(tailoredRequest.message.via).to.be.lengthOf(3)
    expect(tailoredRequest.message.maxForwards.maxForwards).to.be.equal(69)
  })

  it('handles a register request', (done) => {
    const location = { addRoute: (aor: string, route: Route) => { } }
    const addRoute = sandbox.spy(location, "addRoute");
    const response = {
      sendOk: () => {
        expect(addRoute).to.have.been.calledOnce;
        done()
      }
    } as any
    handleRegister(location)(request, response)
  })

  it('handles an invite request', async () => {
    const getHeaderValue = sandbox.spy(E, "getHeaderValue")
    const location = { findRoutes: (aor: string) => [route] }
    const findRoutes = sandbox.spy(location, "findRoutes")
    const response = {
      send: () => {
        expect(getHeaderValue).to.have.been.calledOnce
        expect(findRoutes).to.have.been.calledOnce
      }
    } as any
    await handleRequest(location, null)(request, response)
  })

  it('handles an invite request from another edgeport', async () => {
    const req = E.addHeader({ ...request }, {
      name: 'x-edgeport-ref',
      value: 'xyz'
    })
    const getHeaderValue = sandbox.spy(E, "getHeaderValue")
    const createRouteFromLastMessage = sandbox.spy(HE, "createRouteFromLastMessage")
    const location = { findRoutes: (aor: string) => [route] }
    const findRoutes = sandbox.spy(location, "findRoutes")
    const response = { send: () => { } } as any
    await handleRequest(location, null)(req, response)
    expect(getHeaderValue).to.have.been.calledTwice
    expect(createRouteFromLastMessage).to.have.been.calledOnce
    expect(findRoutes).to.not.have.been.called
  })

  it('handles an invite request with no routes', async () => {
    const getHeaderValue = sandbox.spy(E, "getHeaderValue")
    const createRouteFromLastMessage = sandbox.spy(HE, "createRouteFromLastMessage")
    const location = { findRoutes: (aor: string) => [] as any }
    const findRoutes = sandbox.spy(location, "findRoutes")
    const response = {
      sendNotFound: () => { }
    } as any
    await handleRequest(location, null)(request, response)
    expect(getHeaderValue).to.have.been.calledOnce
    expect(createRouteFromLastMessage).to.not.have.been.called
    expect(findRoutes).to.have.been.calledOnce
  })
})
