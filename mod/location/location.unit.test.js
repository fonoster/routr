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
const LocatorUtils = require('./utils')

describe('@routr/location', () => {
  context('aor as string', () => {
    it('converts aor string to an object', () => {
      const aor = 'sip:abc@10.97.1.16:56618'
      const aorObj = LocatorUtils.aorAsObj(aor)
      expect(aorObj).to.not.be.undefined

      const aor2 = 'sip:10.97.1.16:56618'
      const aorObj2 = LocatorUtils.aorAsObj(aor2)
      expect(aorObj2).to.not.be.undefined
    })
  })
})
