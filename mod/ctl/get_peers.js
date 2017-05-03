/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getPeersCmd(id) {
    const out = Packages.java.lang.System.out
    const peers = getWithAuth('peers')

    out.printf("%-10s %-20s %-15s\n", 'USER', 'NAME', 'HOST')

    peers.forEach(p => {
        if (id.equals('none') || p.username.equals(id))
            out.printf("%-10s %-20s %-10s\n", p.spec.access.username, p.metadata.name, p.spec.host)
    })
}