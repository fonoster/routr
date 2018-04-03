/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
import isEmpty from 'utils/obj_util'
import { Status } from 'location/status'
import { Status as RStatus } from 'data_api/status'

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
        } else {
            if (/sips?:.*@.*/.test(addressOfRecord) ||
                /tel:\d+/.test(addressOfRecord)) {
                return addressOfRecord
            }
           LOG.error('Invalid AOR: ' + addressOfRecord)
        }

        throw 'Invalid AOR: ' + addressOfRecord
    }

    addEndpoint(addressOfRecord, route) {
        const response = this.findEndpoint(addressOfRecord)
        let routes

        // ThruGw is not available in db. We obtain that from api
        if (response.status == Status.OK && !response.result.thruGw) {
            routes = response.result
        } else {
            routes = new HashMap()
        }

        // Not using aorAsString because we need to consider the port, etc.
        const routeKey = route.contactURI.toString()
        routes.put(routeKey, route)

        // See NOTE #1
        this.db.put(this.aorAsString(addressOfRecord), routes)
    }

    findEndpointByTelUrl(addressOfRecord) {
        const response = this.didsAPI.getDIDByTelUrl(addressOfRecord)
        if (response.status == Status.OK) {
            const did = response.result
            const route = this.db.get(this.aorAsString(did.spec.location.aorLink))

            if (route != null) {
                return Locator.buildResponse(Status.OK, route)
            }
        }
        return Locator.buildResponse(Status.NOT_FOUND)
    }

    findEndpointForDID(addressOfRecord) {
        const telUrl = this.addressFactory.createTelURL(addressOfRecord.getUser())
        const response = this.didsAPI.getDIDByTelUrl(telUrl)

        if (response.status == Status.OK) {
            const did = response.result
            const route = this.db.get(this.aorAsString(did.spec.location.aorLink))

            if (route != null) {
                return Locator.buildResponse(Status.OK, route)
            }
        }
    }

    findEndpointBySipURI(addressOfRecord) {
        // First just check the db for such addressOfRecord
        let routes = this.db.get(this.aorAsString(addressOfRecord))

        if (routes != null) {
            return Locator.buildResponse(Status.OK, routes)
        }

        // Check peer's route by host
        let response = this.getPeerRouteByHost(addressOfRecord)

        if (response.status == Status.OK) {
            return Locator.buildResponse(Status.OK, response.result)
        }

        // Then search for a DID
        try {
            response = this.findEndpointForDID(addressOfRecord)
            if (response.status == Status.OK) {
                return Locator.buildResponse(Status.OK, response.result)
            }
        } catch(e) {
            //noop
        }

        // Endpoint can only be reach thru a gateway
        response = this.getEgressRouteForAOR(addressOfRecord)

        if (response.status == Status.OK) {
            return Locator.buildResponse(Status.OK, response.result)
        }

        return Locator.buildResponse(Status.NOT_FOUND)
    }

    findEndpoint(addressOfRecord) {
        if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            return this.findEndpointByTelUrl(addressOfRecord)
        }

        return this.findEndpointBySipURI(addressOfRecord)
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

            let tmp = { 'addressOfRecord': key, 'contactInfo': contactInfo }
            s.push(tmp)
        }

        return s
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

    getPeerRouteByHost(addressOfRecord) {
        const aors = this.db.keySet().iterator()

        while(aors.hasNext()) {
            let key = aors.next()
            let routes = this.db.get(key)
            let i = routes.values().iterator()

            if (i.hasNext()) {
                const rObj = i.next()
                rObj.contactURI
                const h1 = rObj.contactURI.getHost().toString()
                const h2 = addressOfRecord.getHost().toString()
                const p1 = rObj.contactURI.getPort() == -1? 5060 : rObj.contactURI.getPort()
                const p2 = addressOfRecord.getPort() == -1? 5060 : addressOfRecord.getPort()
                if (h1.equals(h2) && p1 == p2) {
                    return {
                        status: Status.OK,
                        message: Status.message[Status.OK].value,
                        result: rObj
                    }
                }
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getEgressRouteForAOR(addressOfRecord) {
        if (!(addressOfRecord instanceof Packages.javax.sip.address.SipURI)) throw 'AOR must be an instance of javax.sip.address.SipURI'

        const didsAPI = this.didsAPI
        const domainsAPI = this.domainsAPI
        const gatewaysAPI = this.gatewaysAPI
        const addressFactory = this.addressFactory

        let response = domainsAPI.getDomains()
        let route

        if (response.status == RStatus.OK) {
            const domains = response.result

            domains.forEach(domain => {
                if (!isEmpty(domain.spec.context.egressPolicy)) {
                    // Get DID and Gateway info
                    response = didsAPI.getDID(domain.spec.context.egressPolicy.didRef)

                    if (response.status == RStatus.OK) {
                        const did = response.result
                        response = gatewaysAPI.getGateway(did.metadata.gwRef)

                        if (response.status == RStatus.OK) {
                            const gw = response.result
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
                                    didRef: did.metadata.ref,
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
                result: route
            }
        }

        return {
            status: RStatus.NOT_FOUND,
            message: RStatus.message[RStatus.NOT_FOUND].value
        }
    }

    getEgressRouteForPeer(addressOfRecord, didRef) {
        const addressFactory = this.addressFactory
        let response = this.didsAPI.getDID(didRef)
        let route

        if (response.status == Status.OK) {
            const did = response.result
            response = this.gatewaysAPI.getGateway(did.metadata.gwRef)

            if (response.status == Status.OK) {
                const gw = response.result
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
                result: route
            }
        }

        return {
            status: RStatus.NOT_FOUND,
            message: RStatus.message[RStatus.NOT_FOUND].value
        }
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

    static buildResponse(status, result) {
        const response = {
            status: status,
            message: Status.message[status].value
        }

        if (result) {
            response.result = result
        }

        return response
    }

    stop() {
        // ??
    }
}
