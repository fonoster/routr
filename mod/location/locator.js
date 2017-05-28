/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

import { Status } from 'location/status'

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to this.aorAsString(addressOfRecord). This is important to ensure
 * the location of the devices regardless of any additional parameters that they may have.
 */
export default class Locator {

    constructor(dataAPIs) {
       this.db = new HashMap()
       this.didsAPI = dataAPIs.DIDsAPI
       this.domainsAPI = dataAPIs.DomainsAPI
    }

    aorAsString(addressOfRecord) {
        if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            return 'tel:' + addressOfRecord.getPhoneNumber()
        } else if (addressOfRecord instanceof Packages.javax.sip.address.SipURI) {
            if (addressOfRecord.isSecure()) {
                return 'sips:' + addressOfRecord.getUser() + '@' + addressOfRecord.getHost()
            } else {
                return 'sip:' + addressOfRecord.getUser() + '@' + addressOfRecord.getHost()
            }
        }

        return addressOfRecord.toString()
    }

    addEndpoint(addressOfRecord, route) {
        const result = this.findEndpoint(addressOfRecord)
        let routes

        if (result.status != Status.OK) {
            routes = new HashMap()
        }

        const routeKey = route.sentByAddress + route.sentByPort + route.received + route.rport
        routes.put(routeKey, route)
        // See NOTE #1
        this.db.put(this.aorAsString(addressOfRecord), routes)
    }

    findEndpoint(addressOfRecord) {
        let result = null

        if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            const result = this.didsAPI.getDIDByTelUrl(this.aorAsString(addressOfRecord))

            if (result.status == Status.OK) {
                const route = this.db.get(did.spec.location.aorLink)

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
            let routes = this.db.get(this.aorAsString(addressOfRecord))

            if (routes != null) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    obj: routes
                }
            }

            // Then try to find for a DID with such user
            let result = this.didsAPI.getDIDByTelUrl('tel:' + addressOfRecord.getUser())

            if (result.status == Status.OK) {
                const did = result.obj
                const route = this.db.get(did.spec.location.aorLink)

                if (route != null) {
                    return {
                        status: Status.OK,
                        message: Status.message[Status.OK].value,
                        obj: route
                    }
                }
            }

            // Finally try search for a Domain egress route
            result = this.domainsAPI.getRouteForAOR(addressOfRecord)

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

    // See NOTE #1
    removeEndpoint(addressOfRecord) {
        return this.db.remove(this.aorAsString(addressOfRecord))
    }

    listAsJSON (domainUri) {
        let s = []
        const aors = this.db.keySet().iterator()

        while(aors.hasNext()) {
            let key = aors.next()
            let value = this.db.get(key)
            let contactInfo = ''

            if (value instanceof HashMap) {
                let i = value.values().iterator()

                while(i.hasNext()) {
                    const rObj = i.next()
                    let r = rObj.contactURI + ';nat=' + rObj.nat + ';timestamp=' + rObj.registeredOn

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
