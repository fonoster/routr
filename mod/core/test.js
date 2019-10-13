/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Core Module"
 */
const assert = require('assert')
const IPUtil = require('@routr/core/ip_util')
const {
    findMatch
} = require('@routr/core/route_manager')
const request = {
    getMethod: () => 'ACK'
}
const rules = [{
        name: 'ack-routing',
        match: 'return request.getMethod() === \'ACK\''
    },
    {
        name: 'other-routing',
        match: 'return request.getMethod() === \'MESSAGE\''
    },
]

describe('Core tests', () => {

    it('Checks configuration', function(done) {
        const config = require('@routr/core/config_util')()
        assert.ok(config !== undefined)
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

    it('Route manager #findMatch', done => {
        const rule = findMatch(rules, request)
        assert.equal(rule.name, 'ack-routing')
        done()
    })

})
