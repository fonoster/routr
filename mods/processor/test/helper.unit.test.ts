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
import { request } from "./examples"
import { Helper as E } from '../src'

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

describe('@routr/processor/helper', () => {
  afterEach(() => sandbox.restore());

  it('obtains route from request', () => {
    const route = E.createRouteFromLastMessage(request)
    const message = request.message as any
    const uri = request.message.requestUri as any
    expect(route.host).to.equal(uri.host)
    expect(route.sessionCount).to.equal(-1)
    expect(route.expires).to.equal(message.expires.expires)
    expect(route.edgePortRef).to.equal(request.edgePortRef)
    expect(route.user).to.equal(uri.user)
    expect(route.host).to.equal(uri.host)
    expect(route.port).to.equal(uri.port)
    expect(route.transport).to.equal(uri.transport)
    expect(route.registeredOn).to.not.be.undefined
    expect(route.listeningPoint)
      .to.have.property("host")
      .to.equal(request.listeningPoint.host)
    expect(route.listeningPoint)
      .to.have.property("port")
      .to.equal(request.listeningPoint.port)
    expect(route.listeningPoint)
      .to.have.property("transport")
      .to.equal(request.listeningPoint.transport)
  })
})
