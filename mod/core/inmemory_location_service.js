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

    function getKey(route) { return route.sentByAddress + route.sentByPort + route.received + route.rport}

    this.put = (addressOfRecord, route) => {
        const routes = db.get(addressOfRecord) || new HashMap()
        const routeKey = getKey(route)
        routes.put(routeKey, route)
        db.put(addressOfRecord, routes)
    }

    // It would be nice if we could enforce the use of 'tel' scheme for DIDs requests
    this.getAORContacts = addressOfRecord => {
        let routes

        if (addressOfRecord instanceof Packages.javax.sip.address.SipURI) {
            const recordKey = addressOfRecord.getScheme() + ":" + addressOfRecord.getUser() + '@' + addressOfRecord.getHost()
            routes =  db.get(recordKey) || db.get('tel:' + addressOfRecord.getUser()) || new HashMap()
        } else if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            routes = db.get('tel:' + addressOfRecord.getUser()) || new HashMap()
        } else {
            routes = db.get(addressOfRecord)
        }

        const iterator = routes.values().iterator()

        return iterator
    }

    this.remove = addressOfRecord => { db.remove(addressOfRecord) }

    this.listAllAsJSON = () => {
        let s = []
        let aors = db.keySet().iterator()

        while(aors.hasNext()) {
            let key = aors.next()

            let i = db.get(key).values().iterator()
            let contactInfo = ''

            while(i.hasNext()) {
                const rObj = i.next()
                const r = '<' + rObj.contactURI + '>;nat=' + rObj.nat + ';timestamp=' + rObj.registeredOn
                if (i.hasNext()) r = r + ','
                contactInfo = contactInfo + r
            }

            let tmp = {
                'addressOfRecord': key,
                'contactInfo': contactInfo
            }
            s.push(tmp)
        }

        return JSON.stringify(s)
    }
}


