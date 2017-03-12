/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdOriginate(from, to, contact) {
    const out = Packages.java.lang.System.out
    try {
        postWithAuth('originate?from=' + from + '&to=' + to + '&contact=' + contact)
    } catch(e) {
        if(e instanceof Packages.org.apache.http.NoHttpResponseException) {
            out.printf(e)
        }
    }
    out.printf("Done.")
}
