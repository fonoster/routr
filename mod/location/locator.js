/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const CoreUtils = require('@routr/core/utils')
const LocatorUtils = require('@routr/location/utils')
const isEmpty = require('@routr/utils/obj_util')
const { Status } = require('@routr/core/status')

const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const SipFactory = Java.type('javax.sip.SipFactory')

const LOG = LogManager.getLogger()

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to LocatorUtils.aorAsString(addressOfRecord).
 * This is important to ensure the location of the devices regardless of any additional
 * parameters that they may have.
 */
class Locator {

    constructor(dataAPIs, checkExpiresTime = 1) {
        this.checkExpiresTime = checkExpiresTime
        this.db = Caffeine.newBuilder()
            .expireAfterWrite(checkExpiresTime, TimeUnit.MINUTES)
            .maximumSize(500000)  // TODO: This should be a parameter
            .build()

        this.didsAPI = dataAPIs.DIDsAPI
        this.domainsAPI = dataAPIs.DomainsAPI
        this.gatewaysAPI = dataAPIs.GatewaysAPI
        this.addressFactory = SipFactory.getInstance().createAddressFactory()

        postal.subscribe({
        		channel: "locator",
        		topic: "endpoint.remove",
        		callback: (data, envelope) => {
                this.removeEndpoint(data.addressOfRecord, data.contactURI, data.isWildcard)
        		}
      	})

        postal.subscribe({
        		channel: "locator",
        		topic: "endpoint.add",
        		callback: (data, envelope) => {
                this.addEndpoint(data.addressOfRecord, data.route)
        		}
      	})

        postal.subscribe({
        		channel: "locator",
        		topic: "endpoint.find",
        		callback: (data, envelope) => {
                const response = this.findEndpoint(data.addressOfRecord)
                postal.publish({
                    channel: "locator",
                    topic: "endpoint.find.reply",
                    data: {
                        response: response,
                        requestId: data.requestId
                    }
                })
        		}
      	})
    }

    getPort(uri) {
      const uriObj = LocatorUtils.aorAsObj(uri)
      return uriObj.getPort() === -1? 5060 : uriObj.getPort()
    }

    addEndpoint(addressOfRecord, route) {
        const response = this.findEndpoint(addressOfRecord)
        let routes

        if (response.status === Status.OK) {
            // Only use if is a "local" route
            routes = response.result.thruGw === false? response.result : []
        } else {
            // Did not found any round at all
            routes = []
        }

        routes.push(route)

        // See NOTE #1
        this.db.put(LocatorUtils.aorAsString(addressOfRecord), routes)
    }

    // See NOTE #1
    removeEndpoint(addressOfRecord, contactURI, isWildcard) {
        const aor = LocatorUtils.aorAsString(addressOfRecord)
        // Remove all bindings
        if (isWildcard !== true) {
            return this.db.invalidate(aor)
        }
        // Not using aorAsString because we need to consider the port, etc.
        this.db.getIfPresent(aor).invalidate(contactURI)

        // This is just a hashmap of hashmaps...
        if (this.db.getIfPresent(aor).isEmpty()) this.db.invalidate(aor)
    }

    findEndpoint(addressOfRecord) {
        const aor = LocatorUtils.aorAsString(addressOfRecord)
        if (aor.startsWith("tel:")) {
            return this.findEndpointByTelUrl(addressOfRecord)
        }
        return this.findEndpointBySipURI(aor)
    }

    /**
     * DIDs required an "aorLink" to enter the network
     */
    findEndpointByTelUrl(addressOfRecord) {
        const response = this.didsAPI.getDIDByTelUrl(LocatorUtils.aorAsString(addressOfRecord))
        if (response.status === Status.OK) {
            const did = response.result
            const route = this.db.getIfPresent(LocatorUtils.aorAsString(did.spec.location.aorLink))
            if (route !== null) {
                return CoreUtils.buildResponse(Status.OK, route)
            }

            return CoreUtils.buildResponse(Status.NOT_FOUND, 'No route for aorLink: ' + did.spec.location.aorLink)
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    findEndpointBySipURI(addressOfRecord) {
        // First just look into the 'db'
        const routes = this.db.getIfPresent(LocatorUtils.aorAsString(addressOfRecord))

        if (routes !== null) {
            return CoreUtils.buildResponse(Status.OK, routes)
        }

        // Check peer's route by host
        let response = this.getPeerRouteByHost(addressOfRecord)

        if (response.status === Status.OK) {
            return response
        }

        // Then search for a DID
        try {
            response = this.findEndpointForDID(addressOfRecord)
            if (response.status === Status.OK) {
                return response
            }
        } catch(e) {
            //noop
        }

        // Endpoint can only be reach thru a gateway
        response = this.getEgressRouteForAOR(addressOfRecord)
        return response.status === Status.OK? response : CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    findEndpointForDID(addressOfRecord) {
        const response = this.didsAPI.getDIDByTelUrl(LocatorUtils.aorAsString(addressOfRecord))
        if (response.status === Status.OK) {
            const did = response.result
            const route = this.db.getIfPresent(LocatorUtils.aorAsString(did.spec.location.aorLink))
            if (route !== null) {
                return CoreUtils.buildResponse(Status.OK, route)
            }
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getPeerRouteByHost(addressOfRecord) {
        const aors = this.db.asMap().keySet().iterator()
        const aor = LocatorUtils.aorAsObj(addressOfRecord)
        const peerHost = aor.getHost().toString()
        const peerPort = this.getPort(aor)

        while(aors.hasNext()) {
            let routes = this.db.getIfPresent(aors.next())
            for (const x in routes) {
                const contactURI = LocatorUtils.aorAsObj(routes[x].contactURI)
                const h1 = contactURI.getHost().toString()
                const p1 = this.getPort(routes[x].contactURI)
                if (h1.equals(peerHost) && p1 === peerPort) {
                    return CoreUtils.buildResponse(Status.OK, routes)
                }
            }
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getEgressRouteForAOR(addressOfRecord) {
        // WARN: This is very inefficient
        const response = this.domainsAPI.getDomains()

        let route

        if (response.status === Status.OK) {
            response.result.forEach(domain => {
                const r = this.getEgressRouteForDomain(addressOfRecord, domain)
                if (r.status === Status.OK) {
                    route = r.result
                }
            })
        }

        return route? CoreUtils.buildResponse(Status.OK, route) :
            CoreUtils.buildResponse(Status.OK, LocatorUtils.buildForwardRoute(addressOfRecord))
    }

    getEgressRouteForDomain(addressOfRecord, domain) {
        if (!isEmpty(domain.spec.context.egressPolicy)) {
            // Get DID and Gateway info
            let response = this.didsAPI.getDID(domain.spec.context.egressPolicy.didRef)
            const did = response.result

            if (response.status === Status.OK) {
                response = this.gatewaysAPI.getGateway(did.metadata.gwRef)

                if (response.status === Status.OK) {
                    const gateway = response.result
                    const pattern = 'sip:' + domain.spec.context.egressPolicy.rule + '@' + domain.spec.context.domainUri
                    const aor = LocatorUtils.aorAsString(addressOfRecord)

                    if (new RegExp(pattern).test(aor)) {
                        //const contactURI = this.addressFactory
                        //    .createSipURI(addressOfRecord.getUser(), gateway.spec.host)
                        //contactURI.setSecure(addressOfRecord.isSecure())
                        const route = LocatorUtils.buildEgressRoute(aor, gateway, did, domain)
                        return CoreUtils.buildResponse(Status.OK, [route])
                    }
                }
            }
            return CoreUtils.buildResponse(Status.NOT_FOUND)
        }
        return CoreUtils.buildResponse(Status.BAD_REQUEST, 'No egressPolicy found')
    }

    getEgressRouteForPeer(addressOfRecord, didRef) {
        let response = this.didsAPI.getDID(didRef)
        let route

        if (response.status === Status.OK) {
            const did = response.result
            response = this.gatewaysAPI.getGateway(did.metadata.gwRef)

            if (response.status === Status.OK) {
                const gateway = response.result
                const contactURI = this.addressFactory.createSipURI(addressOfRecord.getUser(), gateway.spec.host)
                route = LocatorUtils.buildEgressRoute(contactURI, gateway, did)
           }
        }

        return route? CoreUtils.buildResponse(Status.OK, route) : CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    listAsJSON (domainUri) {
        let s = []
        const aors = this.db.asMap().keySet().iterator()

        while(aors.hasNext()) {
            let key = aors.next()
            let routes = this.db.getIfPresent(key)
            let contactInfo = ''

            if (routes.length > 0) {
                const rObj = routes[0]
                let r = rObj.contactURI + ';nat=' + rObj.nat + ';expires=' + rObj.expires

                if (routes.length > 1) r = r + ' [...]'
                contactInfo = contactInfo + r
            }

            let tmp = { 'addressOfRecord': key, 'contactInfo': contactInfo }
            s.push(tmp)
        }

        return s
    }

    // Deprecated
    start() {
        LOG.info('Starting Location service')
        const self = this

        global.timer.schedule(
          () => {
            const e = self.db.asMap().values().iterator()

            while(e.hasNext()) {
                let routes = e.next()

                for (const x in routes) {
                    const route = routes[x]
                    const elapsed = (Date.now() - route.registeredOn) / 1000
                    if ((route.expires - elapsed) <= 0) {
                        routes.splice(x, 1)
                    }

                    if (routes.length === 0) {
                        e.remove()
                    }
                }
            }
          },
          5000,
          this.checkExpiresTime * 60 * 1000
        )
    }

    stop() {
        // ??
    }
}

module.exports = Locator
