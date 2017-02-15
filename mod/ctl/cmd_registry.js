/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdShowRegistry(id) {
    const out = Java.type("java.lang.System").out
    const registry = getWithAuth("registry")

    out.printf("SIP devices registered\n")
    out.printf("%-35s %-20s\n", "ENDPOINT", "CONTACT")

    registry.forEach(reg => out.printf("%-35s %-20s\n", reg.endpoint, reg.contact))
}