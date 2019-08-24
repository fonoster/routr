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
const {
    Status
} = require('@routr/core/status')

const Expiry = Java.type('com.github.benmanes.caffeine.cache.Expiry')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to LocatorUtils.aorAsString(addressOfRecord).
 * This is important to ensure the location of the devices regardless of any additional
 * parameters that they may have.
 */
class Locator {

    constructor(dataAPIs, checkExpiresTime = 3600) {
        this.checkExpiresTime = checkExpiresTime
        const db = Caffeine.newBuilder()
            .expireAfter(new Expiry({
                expireAfterCreate: function(key, graph, currentTime) {
                    const data = graph.map(route => route.expires)
                    const expires = Math.max.apply(Math, data)
                    return TimeUnit.SECONDS.toNanos(expires)
                },
                expireAfterUpdate: function(key, graph, currentTime, currentDuration) {
                    const data = graph.map(route => route.expires)
                    const expires = Math.max.apply(Math, data)
                    return TimeUnit.SECONDS.toNanos(expires)
                },
                expireAfterRead: function (key, graph, currentTime, currentDuration) {
                    return currentDuration
                }
            }))
            .build()

        this.db = db

        this.agentsAPI = dataAPIs.AgentsAPI
        this.peersAPI = dataAPIs.PeersAPI
        this.didsAPI = dataAPIs.DIDsAPI
        this.domainsAPI = dataAPIs.DomainsAPI
        this.gatewaysAPI = dataAPIs.GatewaysAPI

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

    addEndpoint(addressOfRecord, route) {
        const aor = LocatorUtils.aorAsString(addressOfRecord)
        let routes = this.db.getIfPresent(aor)
        if (routes === null) routes = []

        routes = routes.filter(r => !LocatorUtils.contactURIFilter(r, route.contactURI))
        routes.push(route)

        // See NOTE #1
        this.db.put(aor, routes)
    }

    // See NOTE #1
    removeEndpoint(addressOfRecord, contactURI, isWildcard) {
        const aor = LocatorUtils.aorAsString(addressOfRecord)
        // Remove all bindings
        if (isWildcard === true) {
            return this.db.invalidate(aor)
        }

        let routes = this.db.getIfPresent(aor)
        if (routes) {
            routes = routes.filter(route => !LocatorUtils.contactURIFilter(route, contactURI))

            if (routes.length === 0) {
              this.db.invalidate(aor)
              return
            }
            this.db.put(aor, routes)
        }
    }

    evictAll() {
        // WARNING: Should we provide a way to disable this?
        const cnt = this.db.estimatedSize()
        this.db.invalidateAll()
        LOG.warn(`Evicted ${cnt} entries from location table`)
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

            return CoreUtils.buildResponse(Status.NOT_FOUND, `No route for aorLink: ${did.spec.location.aorLink}`)
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    findEndpointBySipURI(addressOfRecord) {
        // First just look into the 'db'
        const aorString = LocatorUtils.aorAsString(addressOfRecord)
        let routes = this.db.getIfPresent(aorString)
        routes = routes ? routes.filter(route => !LocatorUtils.expiredRouteFilter(route)) : void(0)

        if (routes && routes.length > 0) {
            return CoreUtils.buildResponse(Status.OK, routes)
        }

        // Check peer's route by host
        let response = this.getPeerRouteByHost(aorString)

        if (response.status === Status.OK) {
            return response
        }

        // Then search for a DID
        try {
            response = this.findEndpointForDID(aorString)
            if (response.status === Status.OK) {
                return response
            }
        } catch (e) {
            //noop
        }

        const splitAor = aorString.split('@')
        if (splitAor.length === 2) {
            const userPart = splitAor[0].split(':')[1]

            response = this.agentsAPI.getAgentByDomain(splitAor[1], userPart)
            if (response.status === Status.OK ) return CoreUtils.buildResponse(Status.NOT_FOUND)

            response = this.peersAPI.getPeerByUsername(userPart)
            if (response.status === Status.OK ) return CoreUtils.buildResponse(Status.NOT_FOUND)
        }

        // Endpoint can only be reach thru a gateway
        response = this.getEgressRouteForAOR(aorString)
        return response.status === Status.OK ? response : CoreUtils.buildResponse(Status.NOT_FOUND)
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
        const aor = LocatorUtils.aorAsObj(addressOfRecord)
        const aors = this.db.asMap().keySet().iterator()
        const peerHost = aor.getHost().toString()
        const peerPort = LocatorUtils.getPort(aor)

        while (aors.hasNext()) {
            let routes = this.db.getIfPresent(aors.next())
            for (const x in routes) {
                const contactURI = routes[x].contactURI
                const h1 = contactURI.getHost().toString()
                const p1 = LocatorUtils.fixPort(contactURI.getPort())
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

        return route ? CoreUtils.buildResponse(Status.OK, route) :
            CoreUtils.buildResponse(Status.OK, LocatorUtils.buildForwardRoute(addressOfRecord))
    }

    getEgressRouteForDomain(addressOfRecord, domain) {
        const SipFactory = Java.type('javax.sip.SipFactory')
        const addressFactory = SipFactory.getInstance().createAddressFactory()

        if (!isEmpty(domain.spec.context.egressPolicy)) {
            // Get DID and Gateway info
            let response = this.didsAPI.getDID(domain.spec.context.egressPolicy.didRef)
            const did = response.result

            if (response.status === Status.OK) {
                response = this.gatewaysAPI.getGateway(did.metadata.gwRef)

                if (response.status === Status.OK) {
                    const gateway = response.result
                    const pattern = `sip:${domain.spec.context.egressPolicy.rule}@${domain.spec.context.domainUri}`
                    const aorObj = LocatorUtils.aorAsObj(addressOfRecord)

                    if (new RegExp(pattern).test(addressOfRecord)) {
                        const contactURI = addressFactory
                            .createSipURI(aorObj.getUser(), gateway.spec.host)
                        contactURI.setSecure(aorObj.isSecure())
                        const route = LocatorUtils.buildEgressRoute(contactURI, gateway, did, domain)
                        return CoreUtils.buildResponse(Status.OK, [route])
                    }
                }
            }
            return CoreUtils.buildResponse(Status.NOT_FOUND)
        }
        return CoreUtils.buildResponse(Status.BAD_REQUEST, 'No egressPolicy found')
    }

    listAsJSON(domainUri) {
        const s = []
        const aors = this.db.asMap().keySet().iterator()

        while (aors.hasNext()) {
            const key = aors.next()
            const routes = this.db.getIfPresent(key).filter(route => !LocatorUtils.expiredRouteFilter(route))
            let contactInfo = ''

            if (routes.length > 0) {
                const rObj = routes[0]
                let r = `${rObj.contactURI};nat=${rObj.nat};expires=${rObj.expires}`

                if (routes.length > 1) r = `${r} [...]`
                contactInfo = contactInfo + r
            }

            let tmp = {
                'addressOfRecord': key,
                'contactInfo': contactInfo
            }
            s.push(tmp)
        }

        return s
    }
}

module.exports = Locator
