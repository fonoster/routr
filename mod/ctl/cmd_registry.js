
function cmdShowRegistry(id) {
    let out = Java.type("java.lang.System").out
    load('mod/ctl/ctl_utils.js')
    let registry = getWithAuth("registry")

    out.printf("SIP devices registered \n")
    out.printf("%-35s %-20s\n", "ENDPOINT", "CONTACT")

    registry.forEach(function(reg) {
        out.printf("%-35s %-20s\n", reg.endpoint, reg.contact)
    })
}