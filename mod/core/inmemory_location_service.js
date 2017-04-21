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

    this.put = (addressOfRecord, contactAddress) => { db.put(addressOfRecord.toString(), contactAddress) }

    // It would be nice if we could enforce the use of 'tel' scheme for DIDs requests
    this.get = addressOfRecord => {
        if (addressOfRecord instanceof Packages.javax.sip.address.URI ||
            addressOfRecord instanceof Packages.javax.sip.address.SipURI) {

            const sipAddress = addressOfRecord.getScheme() + ":" + addressOfRecord.getUser() + '@' + addressOfRecord.getHost()

            return db.get(sipAddress) || db.get('tel:' + addressOfRecord.getUser())
        } if (k instanceof Packages.javax.sip.address.TelURL) {
            return db.get('tel:' + addressOfRecord.getPhoneNumber())
        }

        return db.get(addressOfRecord)
    }

    this.remove = k => { db.remove(k) }

    this.listAllAsJSON = () => {
        let s = []
        let aors = db.keySet().iterator()

        while(aors.hasNext()) {
            let key = aors.next()
            let tmp = {'addressOfRecord': key, 'contactAddress': db.get(key).toString()}
            s.push(tmp)
        }

        return JSON.stringify(s)
    }
}


