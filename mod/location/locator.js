/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
import isEmpty from 'utils/obj_util'
import { Status } from 'location/status'
import { Status as RStatus } from 'resources/status'

const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const SipFactory = Packages.javax.sip.SipFactory

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
        this.gatewaysAPI = dataAPIs.GatewaysAPI
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
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

        // ThruGw is not available in db. We obtain that from api
        if (result.status == Status.OK && !result.obj.thruGw) {
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
            result = this.didsAPI.getDIDByTelUrl(addressOfRecord)

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

            // Then search for a DID
            try {
                const telUrl = this.addressFactory.createTelURL(addressOfRecord.getUser())
                result = this.didsAPI.getDIDByTelUrl(telUrl)

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
            } catch(e) {
                // Ignore error
            }

            // Endpoint can only be reach thru a gateway
            result = this.getEgressRouteForAOR(addressOfRecord)

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

    getEgressRouteForAOR(addressOfRecord) {
        if (!(addressOfRecord instanceof Packages.javax.sip.address.SipURI)) throw 'AOR must be instance of javax.sip.address.SipURI'

        const didsAPI = this.didsAPI
        const domainsAPI = this.domainsAPI
        const gatewaysAPI = this.gatewaysAPI
        const addressFactory = this.addressFactory

        let result = domainsAPI.getDomains()

        let route

        if (result.status == RStatus.OK) {
            const domains = result.obj

            domains.forEach(domain => {
                if (!isEmpty(domain.spec.context.egressPolicy)) {
                    // Get DID and Gateway info
                    result = didsAPI.getDID(domain.spec.context.egressPolicy.didRef)

                    if (result.status == RStatus.OK) {
                        const did = result.obj
                        result = gatewaysAPI.getGateway(did.metadata.gwRef)

                        if (result.status == RStatus.OK) {
                            const gw = result.obj
                            const gwHost = gw.spec.regService.host
                            const gwUsername = gw.spec.regService.credentials.username
                            const gwRef = gw.metadata.ref
                            const egressRule = domain.spec.context.egressPolicy.rule
                            const pattern = 'sip:' + egressRule + '@' + domain.spec.context.domainUri

                            if (new RegExp(pattern).test(addressOfRecord.toString())) {
                                const contactURI = addressFactory.createSipURI(addressOfRecord.getUser(), gwHost)
                                contactURI.setSecure(addressOfRecord.isSecure())

                                route = {
                                    isLinkAOR: false,
                                    thruGw: true,
                                    rule: egressRule,
                                    gwUsername: gwUsername,
                                    gwRef: gwRef,
                                    gwHost: gwHost,
                                    didRef: did.metadata.didRef,
                                    did: did.spec.location.telUrl.split(':')[1],
                                    contactURI: contactURI
                                }
                            }
                        }
                    }
                }
            })
        }

        if(route) {
            return {
                status: RStatus.OK,
                message: RStatus.message[RStatus.OK].value,
                obj: route
            }
        }

        return {
            status: RStatus.NOT_FOUND,
            message: RStatus.message[RStatus.NOT_FOUND].value
        }
    }

    getEgressRouteForPeer(addressOfRecord, didRef) {
        const addressFactory = this.addressFactory
        let result = this.didsAPI.getDID(didRef)
        let route

        if (result.status == Status.OK) {
            const did = result.obj
            result = this.gatewaysAPI.getGateway(did.metadata.gwRef)

            if (result.status == Status.OK) {
                const gw = result.obj
                const gwHost = gw.spec.regService.host
                const gwUsername = gw.spec.regService.credentials.username
                const gwRef = gw.metadata.ref

                const contactURI = addressFactory.createSipURI(addressOfRecord.getUser(), gwHost)

                route = {
                    isLinkAOR: false,
                    thruGw: true,
                    gwUsername: gwUsername,
                    gwRef: gwRef,
                    gwHost: gwHost,
                    didRef: didRef,
                    did: did.spec.location.telUrl.split(':')[1],
                    contactURI: contactURI
                }
           }
        }

        if(route) {
            return {
                status: RStatus.OK,
                message: RStatus.message[RStatus.OK].value,
                obj: route
            }
        }

        return {
            status: RStatus.NOT_FOUND,
            message: RStatus.message[RStatus.NOT_FOUND].value
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
        this.db.get(aor).remove(contactURI.toString())

        if (this.db.get(aor).isEmpty()) this.db.remove(aor)
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
