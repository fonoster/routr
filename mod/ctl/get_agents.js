/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getAgentsCmd(id) {
    const out = Packages.java.lang.System.out
    const agents = getWithAuth('agents')

    out.printf("%-20s %-20s %-15s\n", 'USER', 'NAME', 'DOMAINS')

    agents.forEach(a => {
        if (id.equals('none') || a.username.equals(id))
            out.printf("%-20s %-20s %-15s\n", a.username, a.metadata.name, a.domains.join())
    })
}