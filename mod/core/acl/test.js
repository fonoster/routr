/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Utils Module"
 */
const assert = require('assert')
const ACLUtil = require('@routr/core/acl/acl_util')
const Rule = require('@routr/core/acl/acl_rule')

describe('Access Control List Submodule', () => {

    it('Rules', function(done) {
        let rule = new Rule('10.0.0.1/28', 'allow')
        assert.equal(rule.getAddressCount(), 16)
        assert.ok(rule.hasIp('10.0.0.4'))
        assert.equal(rule.action, 'allow')

        rule = new Rule('0.0.0.0/0', 'allow')
        assert.ok(rule.hasIp('10.0.0.4'))
        assert.ok(rule.hasIp('192.168.0.16'))
        done()
    })

    it('Check network allowed', function(done) {
        const accessControlList = {
            allow: ['192.168.0.1/28'],
            deny: ['192.168.0.4']
        }

        const aclUtil = new ACLUtil(accessControlList)

        assert.ok(aclUtil.isIpAllowed('192.168.0.1'))
        assert.ok(aclUtil.isIpAllowed('192.168.0.14'))
        assert.ok(!aclUtil.isIpAllowed('192.168.0.4'))
        assert.ok(aclUtil.isIpAllowed('192.168.0.16'))
        done()
    })

    it('Check network allowed with empty deny', function(done) {
        const accessControlList = {
            allow: [],
            deny: []
        }

        const aclUtil = new ACLUtil(accessControlList)

        assert.ok(aclUtil.isIpAllowed('172.21.0.5'))
        done()
    })
})
