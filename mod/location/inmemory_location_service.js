/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
load('mod/location/status.js')

function LocationService(dataAPIs) {
    const HashMap = Packages.java.util.HashMap
    const db = new HashMap()
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const didsAPI = dataAPIs.getDIDsAPI()
    const domainsAPI = dataAPIs.getDomainsAPI()

    this.addEndpoint = (addressOfRecord, route) => {
        const result = this.findEndpoint(addressOfRecord)
        let routes

        if (result.status != Status.OK) {
            routes = new HashMap()
        }

        const routeKey = route.sentByAddress + route.sentByPort + route.received + route.rport
        routes.put(routeKey, route)
        db.put(addressOfRecord.toString(), routes)
    }

    this.findEndpoint = addressOfRecord => {
        let result = null

        if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            const result = didsAPI.getDIDByTelUrl(addressOfRecord)

            if (result.status == Status.OK) {
                const route = db.get(did.spec.location.aorLink)

                if (route != null) {
                    return {
                        status: Status.OK,
                        message: Status.message[Status.OK].value,
                        obj: route
                    }
                }
            }
        } else if (addressOfRecord instanceof Packages.javax.sip.address.SipURI) {
            // First just check the db for such addressOfRecord
            let routes = db.get(addressOfRecord.toString())

            if (routes != null) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    obj: routes
                }
            }

            // Then try to find for a DID with such user
            let result = didsAPI.getDIDByTelUrl('tel:' + addressOfRecord.getUser())

            if (result.status == Status.OK) {
                const did = result.obj
                const route = db.get(did.spec.location.aorLink)

                if (route != null) {
                    return {
                        status: Status.OK,
                        message: Status.message[Status.OK].value,
                        obj: route
                    }
                }
            }

            print ('XXXXXXXXXX DB001')

            // Finally try search for a Domain egress route
            result = domainsAPI.getRouteForAOR(addressOfRecord)

            if (result.status == Status.OK) {
                return {
                    status: Status.OK,
                     message: Status.message[Status.OK].value,
                    obj: result.obj
                }
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    this.removeEndpoint = addressOfRecord => { db.remove(addressOfRecord.toString()) }

    this.listAsJSON = (domainUri) => {
        let s = []
        const aors = db.keySet().iterator()

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

