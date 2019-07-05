/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Utils Module"
 */
const ACLUtil = require('@routr/core/acl/acl_util')
const Rule = require('@routr/core/acl/acl_rule')

const testGroup = {
    name: "Access Control List Submodule"
}

// Tests
testGroup.rules = function() {
    let rule = new Rule('10.0.0.1/28', 'allow')
    assertEquals(16, rule.getAddressCount())
    assertTrue(rule.hasIp('10.0.0.4'))
    assertEquals('allow', rule.action)

    rule = new Rule('0.0.0.0/0', 'allow')
    assertTrue(rule.hasIp('10.0.0.4'))
    assertTrue(rule.hasIp('192.168.0.16'))
}

// Tests
testGroup.is_network_allowed = function() {
    const accessControlList = {
        allow: ['192.168.0.1/28'],
        deny: ['192.168.0.4']
    }

    const aclUtil = new ACLUtil(accessControlList)

    assertTrue(aclUtil.isIpAllowed('192.168.0.1'))
    assertTrue(aclUtil.isIpAllowed('192.168.0.14'))
    assertFalse(aclUtil.isIpAllowed('192.168.0.4'))
    assertFalse(aclUtil.isIpAllowed('192.168.0.16'))
}

module.exports.testGroup = testGroup
