/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getDomainsCmd(id) {
    const out = Packages.java.lang.System.out
    let domains = getWithAuth('domains')

    out.printf("%-20s %-20s %-15s\n", 'NAME', 'URI', 'ACL')

    domains.forEach(d => {
        if (id.equals('none') || d.uri.equals(id))
            out.printf("%-20s %-20s %-15s\n", d.metadata.name, d.uri, 'allow: ' + JSON.stringify(d.acl.allow) + ' deny: ' + JSON.stringify(d.acl.allow))
    })
}