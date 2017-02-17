/**
 * @author Pedro Sanders
 * @since v1
 */

function DomainUtil(domain, defaultDomainAcl) {
    const rules = new java.util.ArrayList()

    function addRules(acl) {
        if (acl === undefined || acl == null) return
        if (acl.deny === undefined && acl.allow === undefined) return
        if (acl.deny !== undefined) { acl.deny.forEach(r => { rules.add(new Rule("deny", r)) }) }
        if (acl.allow !== undefined) { acl.allow.forEach(r => { rules.add(new Rule("allow", r)) }) }
    }

    this.isDomainAllow = (domain, calleeIp) => {
        if (domain == null) return false
        if (defaultDomainAcl !== undefined) addRules(defaultDomainAcl)
        if (domain.acl !== undefined) addRules(domain.acl)
        return new ACLHelper().mostSpecific(rules, calleeIp).getAction() == "allow"
    }
}