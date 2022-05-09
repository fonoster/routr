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
import {
  Extensions as E
} from "@routr/processor"
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { request, route } from "./examples"
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
    expect(E.getHeaderValue(tailoredRequest, 'Max-Forwards')).to.be.equal('69')
  })
})
