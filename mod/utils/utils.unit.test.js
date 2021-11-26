/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Utils Module"
 */
const chai = require('chai')
const expect = chai.expect
const config = require('@routr/core/config_util')()
const {
  protocolTransport,
  nearestInterface
} = require('@routr/utils/misc_utils')

describe('@routr/utils', () => {
  it('Get transport object for a protocol', () => {
    const transport = protocolTransport(config, 'tcp')
    expect(transport.protocol).to.equal('tcp')
  })

  it('Get transport object for a protocol(fail)', () => {
    expect(protocolTransport(config, 'wss')).to.throw
  })

  it("Target's nearest interface", () => {
    const inf = nearestInterface('0.0.0.0', 5060)
    const inf2 = nearestInterface('0.0.0.0', 5060, '10.0.0.1', 42323)
    expect(inf.host === '0.0.0.0').to.equal(true)
    expect(inf.port === 5060).to.equal(true)
    expect(inf2.host === '10.0.0.1').to.equal(true)
    expect(inf2.port === 42323).to.equal(true)
  })
})
