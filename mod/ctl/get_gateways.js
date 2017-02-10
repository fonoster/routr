
function getGatewaysCmd(id) {
    let out = Java.type("java.lang.System").out
    load('mod/ctl/ctl_utils.js')
    let gateways = getWithAuth("gateways")

    out.printf("%-10s %-20s %-25s %-20s\n", "USER", "NAME", "HOST", "REGS")

    gateways.forEach(function(g) {
        if (id.equals("none") || g.username.equals(id))
            out.printf("%-10s %-20s %-25s %-20s\n", g.username, g.metadata.name, g.host, g.registries.join())
    })
}
