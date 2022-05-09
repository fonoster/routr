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
import { request, route } from "./examples"
import { Alterations as A } from '../src'
import { MessageRequest } from '@routr/common/src'
import { pipe } from 'fp-ts/function'

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

describe('@routr/processor/alterations', () => {
  afterEach(() => sandbox.restore());

  it('updates the request uri', () => {
    const r = A.updateRequestURI(route)(request as any as MessageRequest)
    expect(r).to.have.property('message')
      .to.have.property('requestUri')
      .to.have.property('user')
      .to.be.equal(route.user)
    expect(r).to.have.property('message')
      .to.have.property('requestUri')
      .to.have.property('host')
      .to.be.equal(route.host)
    expect(r).to.have.property('message')
      .to.have.property('requestUri')
      .to.have.property('port')
      .to.be.equal(route.port)
    expect(r).to.have.property('message')
      .to.have.property('requestUri')
      .to.have.property('transport')
      .to.be.equal(route.transport)
  })

  it('updates the request uri but removes user', () => {
    const ro = { ...route }
    delete ro.user

    const r = A.updateRequestURI(ro)(request as any as MessageRequest)
    expect(r).to.have.property('message')
      .to.have.property('requestUri')
      .to.have.property('user')
      .to.be.null
  })

  it('updates the value of the max forwards header', () => {
    const r = A.decreaseMaxForwards(request as any as MessageRequest)
    expect(r)
      .to.have.property('message')
      .to.have.property('maxForwards')
      .to.have.property('maxForwards')
      .to.be.equal(69)
  })

  it('adds via header', () => {
    expect((A.removeTopVia(request).message.via as [{ host: string }])[0])
      .to.have.property("host")
      .to.be.equal("127.0.0.1")
  })

  it('removes the top via header', () => {
    expect((A.removeTopVia(request).message.via as [{ host: string }])[0])
      .to.have.property("host")
      .to.be.equal("127.0.0.1")
  })

  it('pipes alterations and checks the result', () => {
    const result = pipe(
      request,
      A.updateRequestURI(route),
      A.addSelfVia(route),
      A.decreaseMaxForwards,
    )
    expect(result).to.have.property("message")
  })
})
