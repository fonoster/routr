/**
 * @author Pedro Sanders
 * @since v1
 */
import ACLHelper from 'utils/acl_helper'

export default function DomainUtils (defaultDomainAcl) {
    const rules = new java.util.ArrayList()

    function addRules(accessControlList) {
        if (accessControlList === undefined || accessControlList == null) return
        if (accessControlList.deny === undefined && accessControlList.allow === undefined) return
        if (accessControlList.deny !== undefined) { accessControlList.deny.forEach(r => { rules.add(new Rule("deny", r)) }) }
        if (accessControlList.allow !== undefined) { accessControlList.allow.forEach(r => { rules.add(new Rule("allow", r)) }) }
    }

    this.isDomainAllow = (domain, calleeIp) => {
        if (domain == null) return false
        if (defaultDomainAcl !== undefined) addRules(defaultDomainAcl)
        if (domain.spec.context.accessControlList !== undefined) addRules(domain.spec.context.accessControlList )
        return new ACLHelper().mostSpecific(rules, calleeIp).getAction() == "allow"
    }
}