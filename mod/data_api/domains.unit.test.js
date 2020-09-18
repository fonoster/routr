/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Domains API"
 */
const DomainsAPI = require('@routr/data_api/domains_api')
const TestUtils = require('@routr/data_api/test_utils')
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const expect = chai.expect
var sandbox = sinon.createSandbox()

describe('@routr/data_api/domains', () => {
  context('createFromJson', () => {
    let domains, jsonObj

    beforeEach(() => {
      domains = new DomainsAPI()
      jsonObj = TestUtils.buildDomain('SIP Local', 'sip.local', '001')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should be a valid resource', () => {
      delete jsonObj.kind
      const result = domains.createFromJSON(jsonObj)
      expect(result).to.be.deep.equal({
        status: 422,
        message:
          'Not a valid entity. `kind` must be: User, Agent, Peer, Domain, Gateway, Number'
      })
    })

    it('should have an existing number or no number at all', () => {
      const doesNumberExist = sinon
        .stub(domains, 'doesNumberExist')
        .returns(false)
      const result = domains.createFromJSON(jsonObj)
      expect(doesNumberExist).to.has.been.calledOnce
      expect(result).to.be.deep.equal({
        status: 409,
        message: 'Found one or more unfulfilled dependencies'
      })
    })

    it('should not allow duplicates', () => {
      const doesNumberExist = sinon
        .stub(domains, 'doesNumberExist')
        .returns(true)
      const domainExist = sinon.stub(domains, 'domainExist').returns(true)
      const result = domains.createFromJSON(jsonObj)

      expect(doesNumberExist).to.has.been.calledOnce
      expect(domainExist).to.has.been.calledOnce
      expect(result).to.be.deep.equal({
        status: 409,
        message: 'Entity already exist'
      })
    })
  })
})
