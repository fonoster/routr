/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const LocatorUtils = require('@routr/location/utils')
const AgentsAPI = require('@routr/data_api/agents_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const PeersAPI = require('@routr/data_api/peers_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DSSelector = require('@routr/data_api/ds_selector')
const SDSelector = require('@routr/data_api/store_driver_selector')
const StoreAPI = require('@routr/data_api/store_api')
const isEmpty = require('@routr/utils/obj_util')
const postal = require('postal')
const {
    buildAddr
} = require('@routr/utils/misc_utils')
const {
    Status
} = require('@routr/core/status')

const HashMap = Java.type('java.util.HashMap')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const Long = Java.type('java.lang.Long')
const LOG = LogManager.getLogger()

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to
 * LocatorUtils.aorAsString(addressOfRecord). This is to ensure the location of
 * the devices regardless of any additional parameters that they may have.
 */
class Locator {

    constructor() {
        this.numbersAPI = new NumbersAPI(DSSelector.getDS())
        this.store = new StoreAPI(SDSelector.getDriver()).withCollection('location')
        this.loadStaticRoutes()
        this.subscribeToPostal()
    }

    addEndpoint(addressOfRecord, route) {
        // This must be done here before we convert contactURI into a string
        const contactURI = LocatorUtils.aorAsString(route.contactURI)
        route.contactURI = route.contactURI.toString()

        LOG.debug(`location.Locator.addEndpoint [adding endpoint ${addressOfRecord} with route => ${JSON.stringify(route)}]`)
        LOG.debug(`location.Locator.addEndpoint [contactURI => ${LocatorUtils.aorAsObj(route.contactURI)}]`)

        let jsonRoutes = this.store.get(addressOfRecord)
        let routes = jsonRoutes ? JSON.parse(jsonRoutes) : []

        routes = routes
            .filter(r => !LocatorUtils.expiredRouteFilter(r))
            .filter(r => !LocatorUtils.sameSourceFilter(r, route))
            .filter(r => !LocatorUtils.contactURIFilter(r.contactURI,
                route.contactURI))

        // See NOTE #1
        routes.push(route)
        this.store.put(addressOfRecord, JSON.stringify(routes))
    }

    findEndpoint(addressOfRecord) {
        LOG.debug(`location.Locator.findEndpoint [lookup route for aor ${addressOfRecord}]`)

        const jsonRoutes = this.store.get(addressOfRecord)

        if (jsonRoutes !== null) {
            let routes = JSON.parse(jsonRoutes)
            routes = routes
                .filter(r => !LocatorUtils.expiredRouteFilter(r))
            return CoreUtils.buildResponse(Status.OK, routes)
        }

        if (addressOfRecord.startsWith('tel:')) {
            return this.findEndpointByTelUrl(addressOfRecord)
        } else {
            const tel = LocatorUtils.aorAsObj(addressOfRecord).getUser()
            const response = this.findEndpointByTelUrl(`tel:${tel}`)
            if (response.status === Status.OK) return response
        }

        const defaultRouteKey = this.store.keySet()
            .filter(key => new RegExp(key).test(addressOfRecord))

        const parse = (s, k) => JSON.parse(s.get(k[0]))

        return defaultRouteKey.length > 0 ?
            CoreUtils.buildResponse(Status.OK, parse(this.store, defaultRouteKey)) :
            CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    findEndpointByTelUrl(addressOfRecord) {
        LOG.debug(`location.Locator.findEndpointByTelUrl [lookup route for aor ${addressOfRecord}]`)
        const response = this.numbersAPI.getNumberByTelUrl(addressOfRecord)
        if (response.status === Status.OK) {
            const number = response.data
            const jsonRoutes = this.store.get(number.spec.location.aorLink)

            if(!jsonRoutes) return CoreUtils.buildResponse(Status.NOT_FOUND)

            let routes = JSON.parse(jsonRoutes)
            routes = routes
                .filter(r => !LocatorUtils.expiredRouteFilter(r))

            return routes !== null ?
                CoreUtils.buildResponse(Status.OK, routes) :
                CoreUtils.buildResponse(Status.NOT_FOUND,
                    `No route found for aorLink: ${number.spec.location.aorLink}`)
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    removeEndpoint(addressOfRecord, contactURI, isWildcard) {
        LOG.debug(`location.Locator.removeEndpoint [remove route for aor => ${addressOfRecord}, isWildcard => ${isWildcard}]`)

        let jsonRoutes = this.store.get(addressOfRecord)
        if (jsonRoutes) {

            let routes = JSON.parse(jsonRoutes)
            routes = routes.filter(route => !LocatorUtils.contactURIFilter(route.contactURI, contactURI))

            // Remove all bindings
            if (routes.length === 0 || isWildcard === true) {
                this.store.remove(addressOfRecord)
                return
            }
            this.store.put(addressOfRecord, JSON.stringify(routes))
        }
    }

    getDomainEgressRoutes(domainsAPI, numbersAPI, gatewaysAPI) {
        const SipFactory = Java.type('javax.sip.SipFactory')
        const addressFactory = SipFactory.getInstance().createAddressFactory()
        const routes = new HashMap()
        const domains = domainsAPI.getDomains().data

        domains.forEach(domain => {
            if (!isEmpty(domain.spec.context.egressPolicy)) {
                // Get Number and Gateway info
                let response = numbersAPI.getNumber(domain.spec.context
                    .egressPolicy.numberRef)
                const number = response.data

                if (response.status === Status.OK) {
                    response = gatewaysAPI.getGateway(number.metadata.gwRef)

                    if (response.status === Status.OK) {
                        const gateway = response.data
                        const addressOfRecord = `sip:${domain.spec.context.egressPolicy.rule}@${domain.spec.context.domainUri}`
                        const route = LocatorUtils
                            .buildEgressRoute(addressOfRecord, gateway, number,
                                domain)
                        routes.put(addressOfRecord, [route])
                    }
                }
            }
        })

        return routes
    }

    // What if the number of numbers is massive?
    loadStaticRoutes() {
        LOG.debug(`location.Locator.loadStaticRoutes [loading static routes]`)
        const ds = DSSelector.getDS()
        const numbersAPI = new NumbersAPI(ds)
        const domainsAPI = new DomainsAPI(ds)
        const gatewaysAPI = new GatewaysAPI(ds)
        const egressRoutes = this.getDomainEgressRoutes(domainsAPI, numbersAPI,
            gatewaysAPI)

        egressRoutes.keySet().toArray().forEach(key => {
            LOG.debug(`loading route for key => ${key}`)
            this.store.put(key, JSON.stringify(egressRoutes.get(key)))
        })
    }

    subscribeToPostal() {
        const aorAsString = a => LocatorUtils.aorAsString(a)
        postal.subscribe({
            channel: "locator",
            topic: "endpoint.remove",
            callback: (data, envelope) => {
                const aor = aorAsString(data.addressOfRecord)
                this.removeEndpoint(aor, data.contactURI, data.isWildcard)
            }
        })

        postal.subscribe({
            channel: "locator",
            topic: "endpoint.add",
            callback: (data, envelope) => {
                const aor = aorAsString(data.addressOfRecord)
                this.addEndpoint(aor, data.route)
            }
        })

        postal.subscribe({
            channel: "locator",
            topic: "endpoint.find",
            callback: (data, envelope) => {
                const response = this.findEndpoint(
                  aorAsString(data.addressOfRecord))
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

    evictAll() {
        LOG.debug(`location.Locator.evictAll [emptying location table]`)
        // WARNING: Should we provide a way to disable this?
        const keys = this.store.keySet()
        keys.forEach(key => {
            this.store.remove(key)
        })
        LOG.debug(`location.Locator.evictAll [evicted ${keys.length} entries from location table]`)
    }
}

module.exports = Locator
