/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')

function cmdStop() {
    try {
        postWithAuth('stop')
    } catch(e) {
        if(e instanceof Packages.org.apache.http.NoHttpResponseException) {
            print(e)
        }
    }
    print("Done.")
}
