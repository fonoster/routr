/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getPeersCmd(id) {
    const out = Packages.java.lang.System.out
    const peers = getWithAuth('peers')

    out.printf("%-10s %-20s %-15s %-10s\n", 'USER', 'NAME', 'TYPE', 'HOST/PORT')

    peers.forEach(p => {
        if (id.equals('none') || p.username.equals(id))
            out.printf("%-10s %-20s %-15s %-10s\n", p.username, p.metadata.name, p.metadata.type, p.host + '/' + p.port)
    })
}