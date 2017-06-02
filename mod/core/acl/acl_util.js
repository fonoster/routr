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

    addRules(acl) {
        if (acl.deny === undefined && acl.allow === undefined)
            return

        if (acl.deny !== undefined) {
            acl.deny.forEach(r => { this.rules.add(new Rule('deny', r)) })
        }

        if (acl.allow !== undefined) {
            acl.allow.forEach(r => { this.rules.add(new Rule('allow', r)) })
        }
    }

    isIpAllowed(domainObj, calleeIp) {
        if (domainObj == null) return false

        // Is important to reset this every time
        this.rules = new java.util.ArrayList()

        if (this.generalAcl !== undefined)
            this.addRules(this.generalAcl)

        if (domainObj.spec.context.accessControlList !== undefined)
            this.addRules(domainObj.spec.context.accessControlList)

        return ACLHelper.mostSpecific(this.rules, calleeIp).action == 'allow'
    }
}