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
import { 
  PROCESSOR_OBJECT_PROTO,
  MessageRequest, 
  ProcessorConfig 
} from '@routr/common'
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { findProcessor, hasMethod } from "../src/find_processor"
import  {getConfig } from '../src/config/get_config'
import connectToBackendProcessors from "../src/connections"
import processor from '../src/processor'

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

const config1: ProcessorConfig = {
  ref: "processor-ref1",
  isFallback: false,
  addr: "localhost:51903",
  methods: ['REGISTER'],
  matchFunc: (request: MessageRequest) => request.method === 'REGISTER'
}

const config2: ProcessorConfig = {
  ref: "processor-ref2",
  isFallback: false,
  addr: "remotehost:50055",
  methods: ['REGISTER', 'INVITE'],
  matchFunc: (request: MessageRequest) => request.method === 'REGISTER' || request.method === 'INVITE'
}

const config3: ProcessorConfig = {
  ref: "processor-ref3",
  isFallback: true,
  addr: "remotehost:50055",
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

describe('@routr/dispatcher', () => {
  afterEach(() => sandbox.restore());

  describe('@routr/dispatcher/find_processor', () => {
    it('checks if method of the request is enabled', () => {
      const messageRequest2 = { ...messageRequest }
      messageRequest2.method = 'MESSAGE'
      expect(hasMethod(config1, messageRequest)).to.be.equal(true)
      expect(hasMethod(config1, messageRequest2)).to.be.equal(false)
    })

    it('matches incomming request as a REGISTER', () => {
      expect(findProcessor([config1, config2])(messageRequest))
        .to.be.have.property("ref")
        .to.be.equal("processor-ref1")
    })

    it('matches incomming request as an INVITE', () => {
      const messageRequest2 = { ...messageRequest }
      messageRequest2.method = "INVITE"
      expect(findProcessor([config1, config2])(messageRequest2))
        .to.be.have.property("ref")
        .to.be.equal("processor-ref2")
    })

    it('matches incomming request as an MESSAGE', () => {
      const messageRequest2 = { ...messageRequest }
      messageRequest2.method = "MESSAGE"
      expect(findProcessor([config1, config2, config3])(messageRequest2))
        .to.be.have.property("ref")
        .to.be.equal("processor-ref3")
    })

    it('fails because there is not matching processor', () => {
      const messageRequest2 = { ...messageRequest }
      messageRequest2.method = "PUBLISH"
      const error = findProcessor([config1, config2, config3])(messageRequest2)
      expect(error.toString()).to.include("not matching processor found for request")
    })
  })

  describe('@routr/dispatcher/processor', () => {
    it('callback gets invoke with an error', (done) => {
      sandbox.stub(PROCESSOR_OBJECT_PROTO, 'Processor').returns(
        {
          processMessage: (request: any, callback: Function) => {
            callback(new Error())
          }
        }
      )

      processor([config1])({ request: messageRequest }, (err: Error, response: any)=> {
        if (err) {
          done()
        } else {
          done("if it gets here there is a problem :(")
        }
      })
    })

    it('it invokes callback with correct response', (done) => {
      sandbox.stub(PROCESSOR_OBJECT_PROTO, 'Processor').returns(
        {
          processMessage: (request: any, callback: Function) => {
            callback(null, request)
          }
        }
      )

      processor([config1])({ request: messageRequest }, (err: Error, response: any)=> {
        if (err) {
          done(err)
        } else {
          expect(response).to.be.deep.equal(messageRequest)
          done()
        }
      })
    })

    it('callback gets invoke with error 14(service unavailable)', (done) => {
      sandbox.stub(PROCESSOR_OBJECT_PROTO, 'Processor').returns(
        {
          processMessage: (request: any, callback: Function) => {
            callback({
              code: 14
            })
          }
        }
      )

      processor([config1])({ request: messageRequest }, (err, response: any)=> {
        expect(err.toString()).to.be.include("processor ref = processor-ref1 is unavailable")
        done()
      })
    })
  }) 

  it('creates a connection for every processor config', () => {
    const processorObjectProtoStub = sandbox.stub(PROCESSOR_OBJECT_PROTO, 'Processor')
    connectToBackendProcessors([config1, config2])
    expect(processorObjectProtoStub).to.have.been.calledTwice
  })

  it('gets configuration from file', (done) => {
    const result = getConfig(__dirname + "/../../../config/dispatcher.json")
    if (result._tag === 'Right') {
      const config = result.right
      expect(config).to.have.property("bindAddr")
      expect(config.processors[0])
        .to.have.property("ref").to.be.equal("scaip-essense")
      done()
    } else {
      done(result.left)
    }
  })
})


