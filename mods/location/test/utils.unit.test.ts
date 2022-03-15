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
import { 
  duplicateFilter, 
  expiredFilter, 
  configFromString, 
  getUrlString
} from '../src/utils'
import * as Routes from './route_examples'

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

describe('@routr/location', () => {
  afterEach(() => sandbox.restore());

  it ('verifies that a route is not expired', () => {
    const route1 = {...Routes.simpleRoute01}
    route1.registeredOn = 1647038272294

    const route2 = {...route1}
    route2.registeredOn = Date.now()

    expect(expiredFilter(route1)).to.be.false
    expect(expiredFilter(route2)).to.be.true
  })

  it('verifies that a route is not duplicate', () => {
    const route1 = {...Routes.simpleRoute01}
    route1.host = 'sip.local'
    route1.port = 5060

    const route2 = {...Routes.simpleRoute01}
    route2.host = 'sip.local'
    route2.port = 5060

    const route3 = {...Routes.simpleRoute01}
    route3.host = 'sip.local'
    route3.port = 5061

    expect(duplicateFilter(route1, route2)).to.be.false
    expect(duplicateFilter(route1, route3)).to.be.true
  })

  it('converts string to a flat record object', () => {
    const config = configFromString("host=sip.local,port=5060", ["host", "port"])
    expect(config).to.have.property("host").to.be.equal("sip.local")
    expect(config).to.have.property("port").to.be.equal("5060")
    expect(() => configFromString("host2=sip.local,port=5060", ["host", "port"]))
    .to.throw()
  })

  it('converts parameter string to redis url', () => {
    const c1 = { host: "test.local", port: 6380 }
    const c2 = { password: "1234", host: "test.local", port: 6380 }
    const c3 = { username: "admin", password: '1234', host: "test.local", port: 6380 }
    const c4 = { secure: true, username: "admin", password: '1234', host: "test.local", port: 6380 }
    expect(getUrlString(c1)).to.be.equal("redis://test.local:6380")
    expect(getUrlString(c2)).to.be.equal("redis://:1234@test.local:6380")
    expect(getUrlString(c3)).to.be.equal("redis://admin:1234@test.local:6380")
    expect(getUrlString(c4)).to.be.equal("rediss://admin:1234@test.local:6380")
  })
})
