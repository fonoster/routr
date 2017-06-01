/**
 * @author Pedro Sanders
 * @since v1
 */
import ACLHelper from 'utils/acl_helper'
import Rule from 'core/acl_rule'

export default class AclUtil () {

    constructor(generalAcl) {
        this.generalAcl = generalAcl
        this.rules = new java.util.ArrayList()
    }

    addRules(acl) {
        if (acl.deny === undefined && acl.allow === undefined)
            return

        if (acl.deny !== undefined) {
            acl.deny.forEach(r => { rules.add(new Rule('deny', r)) })
        }

        if (acl.allow !== undefined) {
            acl.allow.forEach(r => { rules.add(new Rule('allow', r)) })
        }
    }

    isNetworkAllow(domainObj, calleeIp) {
        if (domain == null) return false

        if (this.generalAcl !== undefined)
            addRules(generalAcl)

        if (domainObj.spec.context.accessControlList !== undefined)
            addRules(domainObj.spec.context.accessControlList)

        return new ACLHelper().mostSpecific(rules, calleeIp).action() == 'allow'
    }
}