/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Utils Module"
 */
const assert = require('assert')
const config = require('@routr/core/config_util')()
const {
  buildAddr,
  protocolTransport,
  nearestInterface
} = require('@routr/utils/misc_utils')

describe('Utils Module', () => {
  it('Get transport object for a protocol', function (done) {
    const transport = protocolTransport(config, 'tcp')
    assert.equal(transport.protocol, 'tcp')
    done()
  })

  it('Get transport object for a protocol(fail)', function (done) {
    try {
      protocolTransport(config, 'wss')
      done(new Error(`Force the test to fail since error wasn't thrown`))
    } catch (error) {
      // Constructor threw Error, so test succeeded.
      done()
    }
  })

  it("Target's nearest interface", function (done) {
    const inf = nearestInterface('0.0.0.0', 5060)
    const inf2 = nearestInterface('0.0.0.0', 5060, '10.0.0.1', 42323)
    assert.ok(inf.host === '0.0.0.0')
    assert.ok(inf.port === 5060)
    assert.ok(inf2.host === '10.0.0.1')
    assert.ok(inf2.port === 42323)
    done()
  })
})
