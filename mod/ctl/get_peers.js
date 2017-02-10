
function getPeersCmd(id) {
    let out = Java.type("java.lang.System").out
    load('mod/ctl/ctl_utils.js')
    let peers = getWithAuth("peers")

    out.printf("%-10s %-20s %-15s %-10s\n", "USER", "NAME", "TYPE", "HOST/PORT")

    peers.forEach(function(p) {
        if (id.equals("none") || p.username.equals(id))
            out.printf("%-10s %-20s %-15s %-10s\n", p.username, p.metadata.name, p.metadata.type, p.host + "/" + p.port)
    })
}