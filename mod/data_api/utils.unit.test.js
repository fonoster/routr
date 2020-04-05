/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Domains API"
 */
const DSUtils = require('@routr/data_api/utils')
const TestUtils = require('@routr/data_api/test_utils')
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const expect = chai.expect
var sandbox = sinon.createSandbox()

describe('@routr/data_api/utils', () => {
  context('validateEntity', () => {
    let domains, jsonObj

    beforeEach(() => {
      jsonObj = TestUtils.buildGateway('SIP Local', 'sip.local', '001')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should be a valid kind', () => {
      delete jsonObj.kind
      const result = DSUtils.validateEntity(jsonObj)
      expect(result).to.be.a('array')
      expect(result[0]).to.be.equal(
        'Not a valid entity. `kind` must be: User, Agent, Peer, Domain, Gateway, Number'
      )
    })

    it('should be a valid resource', () => {
      const validateObj = sinon
        .stub(DSUtils, 'validateObj')
        .returns(['some error'])
      const result = DSUtils.validateEntity(jsonObj)

      expect(validateObj).to.has.been.calledOnce
      expect(result).to.be.a('array')
      validateObj.restore()
    })

    it('should not allow re-write of read-only fields', () => {
      const jObjUpdated = TestUtils.buildGateway(
        'SIP Local',
        'sip.local',
        '001'
      )
      jObjUpdated.kind = 'v1'
      const result = DSUtils.validateEntity(jsonObj, jObjUpdated, 'write')
      expect(result).to.be.a('array')
      expect(result[0]).to.be.equal(
        '$[0].kind: is a readonly field, it cannot be changed'
      )
    })

    it('should have a valid transport', () => {
      jsonObj.spec.transport = 'tcpx'
      const result = DSUtils.validateEntity(jsonObj)
      expect(result)
        .to.be.a('array')
        .lengthOf(1)
      expect(result[0]).to.be.equal(
        '$[0].spec.transport: does not have a value in the enumeration [tcp, udp]'
      )
    })

    it('should have a name with three or more characters', () => {
      jsonObj.metadata.name = 'ab'
      const result = DSUtils.validateEntity(jsonObj)
      expect(result)
        .to.be.a('array')
        .lengthOf(1)
      expect(result[0]).to.be.equal(
        '$[0].metadata.name: must be at least 3 characters long'
      )
    })

    it('should have a reference with three but no more than 25', () => {
      jsonObj.metadata.ref = 'sdsdkskskdksksdksksdkdksdksdkskdksdk'
      const result = DSUtils.validateEntity(jsonObj)
      expect(result)
        .to.be.a('array')
        .lengthOf(1)
      expect(result[0]).to.be.equal(
        '$[0].metadata.ref: may only be 24 characters long'
      )
    })
  })

  context('getParameters', () => {
    it('merge default parameter with new parameters', () => {
      const config = {
        spec: {
          dataSource: {
            parameters: 'host=localhost,port=6378,max_retry=20'
          }
        }
      }
      const defParams = 'host=localhost,port=6379,max_retry=30,retry_interval=2'
      const allowedKeys = [
        'host',
        'port',
        'secret',
        'max_retry',
        'retry_interval'
      ]
      const parameters = DSUtils.getParameters(config, defParams, allowedKeys)

      expect(parameters)
        .to.be.a('object')
        .to.have.property('max_retry')
        .to.be.equal('20')

      expect(parameters)
        .to.be.a('object')
        .to.have.property('port')
        .to.be.equal('6378')
    })
  })
})
