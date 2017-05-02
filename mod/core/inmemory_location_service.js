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
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()

    function aorAsString(addressOfRecord) {
        if (addressOfRecord instanceof Packages.javax.sip.address.SipURI) {
            return addressOfRecord.getScheme() + ":" + addressOfRecord.getUser() + '@' + addressOfRecord.getHost()
        } else if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            return  addressOfRecord.getScheme() + ":" + addressOfRecord.getUser()
        } else {
            return addressOfRecord
        }
        return null
    }

    this.addLocation = (addressOfRecord, route) => {
        const routes = this.findLocation(addressOfRecord) || new HashMap()
        let routeKey

        if (route.isLinkAOR == true) {
            // Store only the link
            db.put(aorAsString(addressOfRecord), route)
            return
        }

        if (route.thruGW == true) {
            // Store only the link
            db.put(aorAsString(addressOfRecord), route)
            return
        }

        routeKey = route.sentByAddress + route.sentByPort + route.received + route.rport

        // For aorLink there will be only one entry
        routes.put(routeKey, route)
        db.put(aorAsString(addressOfRecord), routes)
    }

    this.findLocation = addressOfRecord => {
        let result = null

        try {
            // In case they are not sending the didInfo I check the ToHeader
            result = db.get(aorAsString(addressOfRecord)) || db.get('tel:' + addressOfRecord.getUser())
        } catch(e) {}

        if (result instanceof HashMap) {
            return result
        } else if (!!result && result.isLinkAOR) {
            return db.get(result.aorLink)
        } else if (addressOfRecord instanceof Packages.javax.sip.address.SipURI){
            // Lets see if there is a matching rule for this number
            let pattern = db.keySet()
                 .stream()
                 .filter(s => new RegExp(s).test(addressOfRecord))
                 .findFirst()

            if (pattern.isPresent()) {
                const route = db.get(pattern.get())
                // Replace pattern with actual number
                route.contactURI.setUser(addressOfRecord.getUser())

                return route
            }
        }

        return null
    }

    this.removeLocation = addressOfRecord => { db.remove(addressOfRecord) }

    this.listAllAsJSON = () => {
        let s = []
        let aors = db.keySet().iterator()

        while(aors.hasNext()) {
            let key = aors.next()
            let value = db.get(key)
            let contactInfo = ''

            if (value instanceof HashMap) {
                let i = value.values().iterator()

                while(i.hasNext()) {
                    const rObj = i.next()
                    const r = rObj.contactURI + ';nat=' + rObj.nat + ';timestamp=' + rObj.registeredOn

                    if (i.hasNext()) r = r + ','
                    contactInfo = contactInfo + r
                }
            } else if(value.aorLink) {
                contactInfo = 'link to => ' + value.aorLink + ''
            } else {
                contactInfo = 'route via => sip:' + value.rule + '@' + value.gwHost
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


