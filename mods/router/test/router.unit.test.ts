/*
 * Copyright (C) 2021 by Fonoster Inc (https://fonoster.com)
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
import { MessageRequest, ProcessorConfig } from "../src/types" 
import { findMatch, hasMethod } from "../src/find_match" 

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

const config1: ProcessorConfig = {
  ref: "processor-ref1",
  isFallback: false,
  addr: "string",
  methods: ['REGISTER'],
  matchFunc: (request: MessageRequest) => request.method === 'REGISTER'
}

const config2: ProcessorConfig = {
  ref: "processor-ref2",
  isFallback: false,
  addr: "string",
  methods: ['REGISTER', 'INVITE'],
  matchFunc: (request: MessageRequest) => request.method === 'REGISTER' || request.method === 'INVITE'
}

const config3: ProcessorConfig = {
  ref: "processor-ref3",
  isFallback: true,
  addr: "string",
  methods: ['REGISTER', 'INVITE', 'MESSAGE']
}

const messageRequest: MessageRequest = {
  ref: "call-id",
  direction: "IN",
  method: "REGISTER",
  originInterface: {
    port: 5060,
    host: "localhost",
    transport: 'TCP'
  },
  targetInterface: {
    port: 5061,
    host: "localhost",
    transport: 'TCP'
  },
  sipMessage: {}
}

describe('@routr/router', () => {
  afterEach(() => sandbox.restore());

  it('checks if method of the request is enabled', () => {
    const messageRequest2 = {...messageRequest}
    messageRequest2.method = 'MESSAGE'
    expect(hasMethod(config1, messageRequest)).to.be.equal(true)
    expect(hasMethod(config1, messageRequest2)).to.be.equal(false)
  })

  it('matches incomming request as a REGISTER', () => {
    expect(findMatch([config1, config2])(messageRequest))
      .to.be.have.property("ref")
        .to.be.equal("processor-ref1")
  })

  it('matches incomming request as an INVITE', () => {
    const messageRequest2 = {...messageRequest}
    messageRequest2.method = "INVITE"
    expect(findMatch([config1, config2])(messageRequest2))
      .to.be.have.property("ref")
        .to.be.equal("processor-ref2")
  })

  it('matches incomming request as an MESSAGE', () => {
    const messageRequest2 = {...messageRequest}
    messageRequest2.method = "MESSAGE"
    expect(findMatch([config1, config2, config3])(messageRequest2))
      .to.be.have.property("ref")
        .to.be.equal("processor-ref3")
  })

  it('fails because there is not matching processor', () => {
    const messageRequest2 = {...messageRequest}
    messageRequest2.method = "PUBLISH"
    const error = findMatch([config1, config2, config3])(messageRequest2)
    expect(error.toString()).to.include("Not matching process found")
  }) 

})


