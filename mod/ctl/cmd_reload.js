/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdStop() {
    const out = Packages.java.lang.System.out
    try {
        postWithAuth('reload')
    } catch(e) {
        if(e instanceof Packages.org.apache.http.NoHttpResponseException) {
            print(e)
        }
    }
    out.printf("Reloaded.")
}
