/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
import CoreUtils from 'core/utils'
import LocatorUtils from 'location/utils'
import DSUtils from 'data_api/utils'
import isEmpty from 'utils/obj_util'
import { Status } from 'core/status'

const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const SipFactory = Packages.javax.sip.SipFactory

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to LocatorUtils.aorAsString(addressOfRecord). This is important to ensure
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

    addEndpoint(addressOfRecord, route) {
        const response = this.findEndpoint(addressOfRecord)
        let routes = new HashMap()

        // ThruGw is not available in db. We obtain that from api
        if (response.status == Status.OK && !response.result.thruGw) {
            routes = response.result
        }

        // Not using aorAsString because we need to consider the port, etc.
        const routeKey = route.contactURI.toString()
        routes.put(routeKey, route)

        // See NOTE #1
        this.db.put(LocatorUtils.aorAsString(addressOfRecord), routes)
    }

    findEndpointByTelUrl(addressOfRecord) {
        const response = this.didsAPI.getDIDByTelUrl(addressOfRecord)
        if (response.status == Status.OK) {
            const did = response.result
            const route = this.db.get(LocatorUtils.aorAsString(did.spec.location.aorLink))

            if (route != null) {
                return CoreUtils.buildResponse(Status.OK, route)
            }
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    findEndpointForDID(addressOfRecord) {
        const telUrl = this.addressFactory.createTelURL(addressOfRecord.getUser())
        const response = this.didsAPI.getDIDByTelUrl(telUrl)

        if (response.status == Status.OK) {
            const did = response.result
            const route = this.db.get(LocatorUtils.aorAsString(did.spec.location.aorLink))

            if (route != null) {
                return CoreUtils.buildResponse(Status.OK, route)
            }
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    findEndpointBySipURI(addressOfRecord) {
        // First just check the db for such addressOfRecord
        let routes = this.db.get(LocatorUtils.aorAsString(addressOfRecord))

        if (routes != null) {
            return CoreUtils.buildResponse(Status.OK, routes)
        }

        // Check peer's route by host
        let response = this.getPeerRouteByHost(addressOfRecord)

        if (response.status == Status.OK) {
            return CoreUtils.buildResponse(Status.OK, response.result)
        }

        // Then search for a DID
        try {
            response = this.findEndpointForDID(addressOfRecord)
            if (response.status == Status.OK) {
                return CoreUtils.buildResponse(Status.OK, response.result)
            }
        } catch(e) {
            //noop
        }

        // Endpoint can only be reach thru a gateway
        response = this.getEgressRouteForAOR(addressOfRecord)

        if (response.status == Status.OK) {
            return CoreUtils.buildResponse(Status.OK, response.result)
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
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
        const aor = LocatorUtils.aorAsString(addressOfRecord)
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

    getEgressRouteForDomain(domain, addressOfRecord) {
        if (isEmpty(domain.spec.context.egressPolicy) == false) {
            // Get DID and Gateway info
            let response = this.didsAPI.getDID(domain.spec.context.egressPolicy.didRef)

            if (response.status == Status.OK) {
                const did = response.result
                response = this.gatewaysAPI.getGateway(did.metadata.gwRef)

                if (response.status == Status.OK) {
                    const gateway = response.result
                    const pattern = 'sip:' + domain.spec.context.egressPolicy.rule + '@' + domain.spec.context.domainUri

                    if (new RegExp(pattern).test(addressOfRecord.toString())) {
                        const contactURI = this.addressFactory
                            .createSipURI(addressOfRecord.getUser(), gateway.spec.regService.host)
                        contactURI.setSecure(addressOfRecord.isSecure())
                        const route = LocatorUtils.buildEgressRoute(contactURI, gateway, did, domain)
                        return CoreUtils.buildResponse(Status.OK, route)
                    }
                }
            }
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getEgressRouteForAOR(addressOfRecord) {
        if (!(addressOfRecord instanceof Packages.javax.sip.address.SipURI))
            throw 'AOR must be an instance of javax.sip.address.SipURI'

        let response = this.domainsAPI.getDomains()
        let route

        if (response.status == Status.OK) {
            response.result.forEach(domain => {
                const r = this.getEgressRouteForDomain(domain, addressOfRecord)
                if (r.status == Status.OK) {
                    route = r.result
                }
            })
        }

        if(route) {
            return CoreUtils.buildResponse(Status.OK, route)
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getEgressRouteForPeer(addressOfRecord, didRef) {
        let response = this.didsAPI.getDID(didRef)
        let route

        if (response.status == Status.OK) {
            const did = response.result
            response = this.gatewaysAPI.getGateway(did.metadata.gwRef)

            if (response.status == Status.OK) {
                const gateway = response.result
                const contactURI = this.addressFactory.createSipURI(addressOfRecord.getUser(), gateway.spec.regService.host)
                route = LocatorUtils.buildEgressRoute(contactURI, gateway, did)
           }
        }

        if(route) {
            return CoreUtils.buildResponse(Status.OK, route)
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
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
