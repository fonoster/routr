/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Utils Module"
 */
import ACLUtil from 'core/acl/acl_util'
import Rule from 'core/acl/acl_rule'

export let testGroup = { name: "Access Control List Submodule" }

// Tests
testGroup.rules = function () {
    let rule = new Rule('allow', '10.0.0.1/28')
    assertEquals(16, rule.getAddressCount())
    assertTrue(rule.hasIp('10.0.0.4'))
    assertEquals('allow', rule.action)
    assertTrue(rule.isCidr('10.0.0.1/28'))

    rule = new Rule('allow', '0.0.0.0/0')
    assertTrue(rule.hasIp('10.0.0.4'))
    assertTrue(rule.hasIp('192.168.0.16'))
}

// Tests
testGroup.is_network_allowed = function () {
    const generalAcl = {
        deny: ["0.0.0.0/0"]
    }

    const domainObj = {
        spec: {
            context: {
                accessControlList: {
                    allow: ['192.168.0.1/28'],
                    deny: ['192.168.0.4']
                }
            }
        }
    }

    let aclUtil = new ACLUtil(generalAcl)

    assertTrue(aclUtil.isIpAllowed(domainObj, '192.168.0.1'))
    assertTrue(aclUtil.isIpAllowed(domainObj, '192.168.0.14'))
    assertFalse(aclUtil.isIpAllowed(domainObj, '192.168.0.4'))
    assertFalse(aclUtil.isIpAllowed(domainObj, '192.168.0.16')) // Simply out of range
}
