
function getDomainsCmd(id) {
    let out = Java.type("java.lang.System").out
    load('mod/ctl/ctl_utils.js')
    let domains = getWithAuth("domains")

    out.printf("%-20s %-20s %-15s\n", "NAME", "URI", "ACL")

    domains.forEach(function(d) {
        if (id.equals("none") || d.uri.equals(id))
            out.printf("%-20s %-20s %-15s\n", d.metadata.name, d.uri, "allow: " + JSON.stringify(d.acl.allow) + " deny: " + JSON.stringify(d.acl.allow))
    })
}