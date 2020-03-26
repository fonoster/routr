/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Core Module"
 */
const assert = require('assert')
const { isValidIp, isLocalnet, addressCount } = require('@routr/core/ip_util')
const { cidrInfo } = require('ip-utils')

describe('Core tests', () => {
  it('Checks configuration', function (done) {
    const config = require('@routr/core/config_util')()
    assert.ok(config !== undefined)
    done()
  })

  it.skip('IP util #addressCount', function (done) {
    assert.equal(addressCount('192.168.1.1/255.255.255.0'), 256)
    assert.equal(addressCount('10.0.0.1'), 1)
    assert.equal(addressCount('10.0.0.1/28'), 16)
    assert.equal(addressCount('0.0.0.0/0'), 4294967296)
    assert.equal(addressCount('2620::2d0:2df::6/127'), 2)
    done()
  })

  it('IP util #isValidIp', function (done) {
    assert.ok(isValidIp('192.168.1.2'))
    assert.ok(isValidIp('::1'))
    assert.ok(!isValidIp('hello'))
    done()
  })

  // The ip-utils lib is not behaving as spected. I might have to replace
  // with another one
  it.skip('IP util #isLocalnet', function (done) {
    const localnets = [
      '2620::2d0:2df::6/127',
      '192.168.1.2',
      '10.88.1.0/255.255.255.0',
      '192.168.0.1/28'
    ]
    //assert.ok(isLocalnet(localnets, '2620::2d0:2df::6'))
    assert.ok(isLocalnet(localnets, '192.168.1.2'))
    assert.ok(isLocalnet(localnets, '10.88.1.34'))
    assert.ok(isLocalnet(localnets, '192.168.0.14'))
    assert.ok(!isLocalnet(localnets, '35.196.78.166'))
    done()
  })
})
