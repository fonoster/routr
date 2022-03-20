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
import { getObjectProto } from '../src/service'
import { addressCount, isLocalnet} from "../src/ip_utils"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

const objectProto = {
  name: "processor",
  version: "v2draft1",
  path: __dirname + '/../src/protos/processor.proto'
}

describe('@routr/common', () => {
  afterEach(() => sandbox.restore());

  it('gets Processor object proto', () => {
    expect(getObjectProto(objectProto))
      .to.have.property("Processor").to.have.property("service")
  })

  it('fails to gets object proto due to a typo', () => {
    const objectProto2 = { ...objectProto }
    // Introduce a typo
    objectProto2.name = "processo"
    expect(getObjectProto(objectProto2).toString())
      .to.include("Service definition for processo/v2draft1 not found")
  })

  describe('@routr/common/ip_utils', () => {

    it('ip util for #addressCount', () => {
      expect(addressCount('192.168.1.1/255.255.255.0')).to.be.equal(256)
      expect(addressCount('10.0.0.1')).to.be.equal(1)
      expect(addressCount('10.0.0.1/28')).to.be.equal(16)
      expect(addressCount('0.0.0.0/0')).to.be.equal(4294967296)
      // expect(addressCount('2620::2d0:2df::6/127')).to.be.equal(2)
    })

    // Note: Is not working properly for ipv4
    it('ip util for #isLocalnet', () => {
      const localnets = [
        //'2620::2d0:2df::6/127',
        '192.168.1.2',
        '10.88.1.0/255.255.255.0',
        '192.168.0.1/28'
      ]
      expect(isLocalnet(localnets, '2620::2d0:2df::6'))
      expect(isLocalnet(localnets, '192.168.1.2')).to.be.true
      expect(isLocalnet(localnets, '10.88.1.34')).to.be.true
      expect(isLocalnet(localnets, '192.168.0.14')).to.be.true
      expect(isLocalnet(localnets, '35.196.78.166')).to.be.false
    })
  })
})

