
function getDIDsCmd(id) {
    let out = Java.type("java.lang.System").out
    load('mod/ctl/ctl_utils.js')
    let dids = getWithAuth("dids")

    out.printf("%-20s %-30s %-15s\n", "E164NUM", "COUNTRY/CITY", "CONTACT")

    dids.forEach(function(d) {
        if (id.equals("none") || d.e164num.equals(id))
            out.printf("%-20s %-30s %-25s\n", d.e164num, d.metadata.country + "/" + d.metadata.city, d.contact)
    })
}
