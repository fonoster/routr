
function getAgentsCmd(id) {
    let out = Java.type("java.lang.System").out
    load('mod/ctl/ctl_utils.js')
    let agents = getWithAuth("agents")

    out.printf("%-20s %-20s %-15s\n", "USER", "NAME", "DOMAINS")

    agents.forEach(function(a) {
        if (id.equals("none") || a.username.equals(id))
            out.printf("%-20s %-20s %-15s\n", a.username, a.metadata.name, a.domains.join())
    })
}