/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdStop() {
    const out = Packages.java.lang.System.out
    try {
        postWithAuth('stop')
    } catch(e) {
        if(e instanceof Packages.org.apache.http.NoHttpResponseException) {
            out.printf(e)
        }
    }
    out.printf("Done.")
}
