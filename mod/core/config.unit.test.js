/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the configuration utility
 */
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const expect = chai.expect
var sandbox = sinon.createSandbox()
const defaults = require('@routr/core/config/config_defaults')(new Date())

describe('@routr/core/config', () => {
  context('config util', () => {
    sinon
      .stub(require('@routr/core/config/salt'), 'getSalt')
      .returns('SALTYSALT')
    sinon
      .stub(require('@routr/core/config/config_from_redis'), 'getConfig')
      .returns({
        apiVersion: 'v1beta1',
        spec: {
          recordRoute: true,
          dataSource: {
            provider: 'redis_data_provider',
            parameters: 'host=localhost,port=6379'
          },
          transport: [
            { protocol: 'udp', port: 5060 },
            { protocol: 'tcp', port: 5060 }
          ]
        }
      })
    sinon
      .stub(require('@routr/core/config/config_from_file'), 'getConfig')
      .returns({
        apiVersion: 'v1beta1',
        spec: {
          recordRoute: false,
          externAddr: '192.168.1.2',
          dataSource: {
            provider: 'redis_data_provider',
            parameters: 'host=localhost,port=6379'
          },
          transport: [
            { protocol: 'udp', port: 5060 },
            { protocol: 'tcp', port: 5060 },
            { protocol: 'wss', port: 5062 }
          ]
        }
      })
    const config = require('@routr/core/config_util')()

    it('check config merging', () => {
      expect(config)
        .to.have.property('spec')
        .to.have.property('recordRoute').to.be.false

      expect(config)
        .to.have.property('spec')
        .to.have.property('externAddr').to.be.not.null

      expect(config)
        .to.have.property('spec')
        .to.have.property('localnets')
        .to.be.a('array')
        .lengthOf(0)

      expect(config)
        .to.have.property('spec')
        .to.have.property('transport')
        .to.be.a('array')
        .lengthOf(3)
    })
  })

  context('config defaults', () => {
    it('check defaults', () => {
      expect(defaults)
        .to.have.property('system')
        .to.have.property('apiVersion')
        .to.be.equal('v1beta1')
      expect(defaults)
        .to.have.property('spec')
        .to.not.have.property('externAddr')
      expect(defaults)
        .to.have.property('spec')
        .to.have.property('grpcService')
        .to.have.property('bind')
        .to.be.equal('127.0.0.1')
      expect(defaults)
        .to.have.property('spec')
        .to.have.property('registrarIntf')
        .to.be.equal('External')
      expect(defaults)
        .to.have.property('spec')
        .to.have.property('localnets')
        .to.be.a('array')
        .lengthOf(0)
      expect(defaults)
        .to.have.property('spec')
        .to.have.property('dataSource')
        .to.have.property('provider')
        .to.be.equal('files_data_provider')
    })
  })
})
