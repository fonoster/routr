/**
 * @author Pedro Sanders
 * @since v1
 */
import ACLHelper from 'core/acl/acl_helper'
import Rule from 'core/acl/acl_rule'

export default class AclUtil {

    constructor(generalAcl) {
        this.generalAcl = generalAcl
    }

    addRules(nets, action) {
        if(nets) {
            nets.forEach(r => { this.rules.add(new Rule(action, r))})
        }
    }

    isIpAllowed(domainObj, calleeIp) {
        if (domainObj == null) return false

        // Is important to reset this every time
        this.rules = new java.util.ArrayList()

        if (this.generalAcl) {
            this.addRules(this.generalAcl.allow, 'allow')
            this.addRules(this.generalAcl.deny, 'deny')
        }

        if (domainObj.spec.context.accessControlList) {
            this.addRules(domainObj.spec.context.accessControlList.allow, 'allow')
            this.addRules(domainObj.spec.context.accessControlList.deny, 'deny')
        }

        return ACLHelper.mostSpecific(this.rules, calleeIp).action == 'allow'
    }
}