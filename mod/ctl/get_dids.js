/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function getDIDsCmd(id) {
    const out = Packages.java.lang.System.out
    const dids = getWithAuth('dids')

    out.printf("%-20s %-30s %-15s\n", 'TEL URI', 'COUNTRY/CITY', 'ADDRESS OF RECORD LINK')

    dids.forEach(d => {
        if (id.equals('none') || d.spec.connection.telUri.equals(id))
            out.printf("%-20s %-30s %-25s\n", d.spec.connection.telUri,
                d.metadata.geoInfo.country + '/' + d.metadata.geoInfo.city, d.spec.connection.aorLink)
    })
}
