/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'location/status'

const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to this.aorAsString(addressOfRecord). This is important to ensure
 * the location of the devices regardless of any additional parameters that they may have.
 */
export default class Locator {

    constructor(dataAPIs, checkExpiresTime = 1) {
        this.checkExpiresTime = checkExpiresTime
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

        // ThruGW is not available in db. We obtain that from api
        if (result.status == Status.OK && !result.obj.thruGW) {
            routes = result.obj
        } else {
            routes = new HashMap()
        }

        // Not using aorAsString because we need to consider the port, etc.
        const routeKey = route.contactURI.toString()
        routes.put(routeKey, route)

        // See NOTE #1
        this.db.put(this.aorAsString(addressOfRecord), routes)
    }

    findEndpoint(addressOfRecord) {
        let result

        if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            result = this.didsAPI.getDIDByTelUrl(this.aorAsString(addressOfRecord))

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
            result = this.didsAPI.getDIDByTelUrl('tel:' + addressOfRecord.getUser())

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
    removeEndpoint(addressOfRecord, contactURI) {
        const aor = this.aorAsString(addressOfRecord)
        // Remove all bindings
        if (contactURI == null) {
            return this.db.remove(aor)
        }
        // Not using aorAsString because we need to consider the port, etc.
        return this.db.get(aor).remove(contactURI.toString())
    }

    listAsJSON (domainUri) {
        let s = []
        const aors = this.db.keySet().iterator()

        while(aors.hasNext()) {
            let key = aors.next()
            let routes = this.db.get(key)
            let contactInfo = ''
            let i = routes.values().iterator()

            if (i.hasNext()) {
                const rObj = i.next()
                let r = rObj.contactURI + ';nat=' + rObj.nat + ';expires=' + rObj.expires

                if (i.hasNext()) r = r + ' [...]'
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

    start() {
        LOG.info('Starting Location service')
        var locDB = this.db

        let unbindExpiredTask = new java.util.TimerTask({
            run: function() {
                const e = locDB.values().iterator()

                while(e.hasNext()) {
                    let routes = e.next()
                    let i = routes.values().iterator()

                    while (i.hasNext()) {
                        const route = i.next()
                        const elapsed = (Date.now() - route.registeredOn) / 1000
                        if ((route.expires - elapsed) <= 0) {
                            i.remove()
                        }

                        if (routes.size() == 0) e.remove()
                    }
                }
            }
        })

        new java.util.Timer().schedule(unbindExpiredTask, 5000, this.checkExpiresTime * 60 * 1000)
    }

    stop() {
        // ??
    }
}
