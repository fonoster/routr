/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
function LocationService() {
    const HashMap = Packages.java.util.HashMap
    const db = new HashMap()

    this.put = (k, v) => { db.put(k.toString(), v) }

    // It would be nice if we could enforce the use of 'tel' scheme for DIDs requests
    this.get = k => {
        if (k instanceof Packages.javax.sip.address.URI || k instanceof Packages.javax.sip.address.SipURI) {

            const sipAddress = k.getScheme() + ":" + k.getUser() + '@' + k.getHost()

            return db.get(sipAddress) || db.get('tel:' + k.getUser())
        } if (k instanceof Packages.javax.sip.address.TelURL) {
            return db.get('tel:' + k.getPhoneNumber())
        }

        return db.get(k)
    }

    this.remove = k => { db.remove(k) }

    this.listAllAsJSON = () => {
        let s = []
        let k = db.keySet().iterator()

        while(k.hasNext()) {
            let key = k.next()
            let tmp = {'addressOfRecord': key, 'contactAddress': db.get(key).toString()}
            s.push(tmp)
        }

        return JSON.stringify(s)
    }
}
