/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getGatewaysCmd(id) {
    const out = Packages.java.lang.System.out
    const gateways = getWithAuth('gateways')

    out.printf("%-10s %-20s %-25s %-20s\n", 'USER', 'NAME', 'HOST', 'REGS')

    gateways.forEach(g => {
        if (id.equals('none') || g.username.equals(id))
            out.printf("%-10s %-20s %-25s %-20s\n", g.username, g.metadata.name, g.host, g.registries.join())
    })
}
