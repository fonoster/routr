/**
 * @author Pedro Sanders
 * @since v1
 */
import CtlUtils from 'ctl/ctl_utils'

export default class CommandStop {

    constructor(subparsers) {
        subparsers.addParser('stop').help('stops server')
    }

    run() {
        const ctlUtils = new CtlUtils()
        try {
            ctlUtils.postWithAuth('stop')
        } catch(e) {
            if(e instanceof Packages.org.apache.http.NoHttpResponseException) {
                print(e)
            }
        }
        print("Done.")
    }
}
