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
// @ts-ignore
import chai from 'chai'
// @ts-ignore
import sinon from 'sinon'
// @ts-ignore
import sinonChai from 'sinon-chai'
import createSipStack from '../src/create_sip_stack'
import createListeningPoints from '../src/create_listening_points'
import createSipProvider from '../src/create_sip_provider'
import getServerProperties from '../src/server_properties'
import { 
  duplicatedPortEdgePortConfig, 
  duplicatedProtoEdgePortConfig, 
  edgePortConfig, 
  noSecurityContextEdgePortConfig
} from './config'
import { 
  assertHasSecurityContext, 
  assertNoDuplicatedProto, 
  assertNoDuplicatedPort 
} from '../src/assertions'
import { ListeningPoint, SipProvider } from '../src/types'
const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

const sipProvider: SipProvider = {
  addListeningPoint: () => { },
  addSipListener: function (lp: unknown): void {
    throw new Error('Function not implemented.')
  }
}
const sipStack = {
  createListeningPoint:
    (bindAddr: string, port: number, proto: string) => {},
  createSipProvider: (lp: ListeningPoint) => sipProvider,
  getClass: () => {}
}

describe('@routr/edgeport', () => {
  afterEach(() => sandbox.restore());

  it('gets a Map with the properties of the sip stack', () => {
    const properties = getServerProperties(edgePortConfig)
    expect(properties.get('javax.sip.STACK_NAME')).to.be.equal('routr')
    expect(properties.get('javax.sip.AUTOMATIC_DIALOG_SUPPORT')).to.be.equal('OFF')
    expect(properties.get('gov.nist.javax.sip.MESSAGE_PROCESSOR_FACTORY'))
      .to.be.equal('gov.nist.javax.sip.stack.NioMessageProcessorFactory')
    expect(properties.get('gov.nist.javax.sip.PATCH_SIP_WEBSOCKETS_HEADERS')).to.be.equal('false')
    expect(properties.get('gov.nist.javax.sip.CACHE_CLIENT_CONNECTIONS')).to.be.equal('true')
    expect(properties.get('gov.nist.javax.sip.REENTRANT_LISTENER')).to.be.equal('false')
    expect(properties.get('gov.nist.javax.sip.THREAD_POOL_SIZE')).to.be.equal('16')
    expect(properties.get('gov.nist.javax.sip.NIO_BLOCKING_MODE')).to.be.equal('NONBLOCKING')
    expect(properties.get('gov.nist.javax.sip.MAX_MESSAGE_SIZE')).to.be.equal('1048576')
    expect(properties.get('gov.nist.javax.sip.LOG_MESSAGE_CONTENT')).to.be.equal('false')
    expect(properties.get('javax.sip.IP_ADDRESS')).to.be.equal(edgePortConfig.spec.bindAddr)
    expect(properties.get('gov.nist.javax.sip.TLS_CLIENT_PROTOCOLS'))
      .to.be.equal(edgePortConfig.spec.securityContext.client.protocols.join())
    expect(properties.get('gov.nist.javax.sip.TLS_CLIENT_AUTH_TYPE'))
      .to.be.equal(edgePortConfig.spec.securityContext.client.authType)
    expect(properties.get('javax.net.ssl.keyStore'))
      .to.be.equal(edgePortConfig.spec.securityContext.keyStore)
    expect(properties.get('javax.net.ssl.trustStore'))
      .to.be.equal(edgePortConfig.spec.securityContext.trustStore)
    expect(properties.get('javax.net.ssl.keyStorePassword'))
      .to.be.equal(edgePortConfig.spec.securityContext.keyStorePassword)
    expect(properties.get('javax.net.ssl.trustStorePassword'))
      .to.be.equal(edgePortConfig.spec.securityContext.trustStorePassword)
    expect(properties.get('javax.net.ssl.keyStoreType'))
      .to.be.equal(edgePortConfig.spec.securityContext.keyStoreType)
  })

  it('creates a sipStack object', () => {
    const properties = getServerProperties(edgePortConfig)
    const sipStack = createSipStack(properties)
    expect(sipStack.getClass().getName()).to.be.equal('gov.nist.javax.sip.SipStackImpl')
  })

  it('creates a sipProvider object', () => {
    const lps: Array<ListeningPoint> = [{},{}, {}]
    const createSipProviderSpy = sandbox.spy(sipStack, 'createSipProvider')
    const addListeningPointSpy = sandbox.spy(sipProvider, 'addListeningPoint')
  
    createSipProvider(sipStack, lps)
    expect(createSipProviderSpy).to.have.been.calledOnce
    expect(addListeningPointSpy).to.have.been.calledTwice
  })

  describe('assertions', () => {
    it('fails because of missing .spec.securityContext', () => {
      expect(() => assertHasSecurityContext(noSecurityContextEdgePortConfig)).to.throw('found at least one secure protocol which requires setting the .spec.securityContext')
    })

    it('fails because found duplicated protocol', () => {
      expect(() => assertNoDuplicatedProto(duplicatedProtoEdgePortConfig.spec.transport)).to.throw('found duplicated entries at .spec.transport')
    })

    it('fails because found duplicated port', () => {
      expect(() => assertNoDuplicatedPort(duplicatedPortEdgePortConfig.spec.transport)).to.throw('found the same port on more that one entry at .spec.transport')
    })
  })

  describe('createListeningPoint', () => {
    it('creates listening points for the given transports', () => {
      const createListeningPointStub = sandbox.stub(sipStack, 'createListeningPoint').returns(null)
      const lps = createListeningPoints(sipStack, edgePortConfig)

      expect(lps.length).to.be.equal(3)
      expect(createListeningPointStub).to.have.been.callCount(3)
    })

    // WARNING: Needs testing
    //it.skip('fails because of upstream function failed', () => {
    //})
  })
})
