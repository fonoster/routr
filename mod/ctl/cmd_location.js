/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdShowLocation(id) {
    const out = Packages.java.lang.System.out
    const registry = getWithAuth('location')

    out.printf('Registered devices\n')
    out.printf("%-35s %-20s\n", 'ADDRESS OF RECORD', 'CONTACT ADDRESS')

    registry.forEach(reg => out.printf("%-35s %-20s\n", reg.addressOfRecord, reg.contactAddress))
}