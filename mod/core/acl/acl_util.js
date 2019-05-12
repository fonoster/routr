/**
 * @author Pedro Sanders
 * @since v1
 */
const ACLHelper = require('@routr/core/acl/acl_helper')
const Rule = require('@routr/core/acl/acl_rule')

class AclUtil {

    constructor(accessControlList) {
        this.rules = new java.util.ArrayList()

        if (accessControlList) {
            this.addRules(accessControlList.allow, 'allow')
            this.addRules(accessControlList.deny, 'deny')
        }
    }

    addRules(nets, action) {
        if(nets) {
            nets.forEach(net => this.rules.add(new Rule(net, action)))
        }
    }

    isIpAllowed(ip) {
        return ACLHelper.mostSpecific(ip, this.rules).action == 'allow'
    }
}

module.exports = AclUtil
