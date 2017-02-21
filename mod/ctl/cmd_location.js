/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdShowLocation(id) {
    const out = Packages.java.lang.System.out
    const registry = getWithAuth('location')

    out.printf('SIP devices registered\n')
    out.printf("%-35s %-20s\n", 'ENDPOINT', 'CONTACT ADDRESS')

    registry.forEach(reg => out.printf("%-35s %-20s\n", reg.endpoint, reg.contact))
}