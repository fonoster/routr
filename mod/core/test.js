/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Core Module"
 */
const assert = require('assert')
const getConfig = require('@routr/core/config_util')
const IPUtil = require('@routr/core/ip_util')

describe('Core tests', () => {

    it('Checks configuration', function(done) {
        const result = getConfig()
        assert.ok(result !== undefined)
        done()
    })

    it('IP util', function(done) {
        const partialConfig = {
            spec: {
                localnets: ['192.168.1.2', '10.88.1.0/255.255.255.0', '192.168.0.1/28']
            }
        }

        const ipUtil = new IPUtil(partialConfig)
        assert.ok(ipUtil.isLocalnet('192.168.1.2'))
        assert.ok(ipUtil.isLocalnet('10.88.1.34'))
        assert.ok(ipUtil.isLocalnet('192.168.0.14'))
        assert.ok(!ipUtil.isLocalnet('35.196.78.166'))
        assert.ok(IPUtil.isCidr('10.0.0.1/28'))
        done()
    })

})
