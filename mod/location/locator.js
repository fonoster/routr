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

const Expiry = Java.extend(Java.type('com.github.benmanes.caffeine.cache.Expiry'))
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')
const HashMap = Java.type('java.util.HashMap')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const Long = Java.type('java.lang.Long')
const LOG = LogManager.getLogger()

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to LocatorUtils.aorAsString(addressOfRecord).
 * This is important to ensure the location of the devices regardless of any additional
 * parameters that they may have.
 */
class Locator {

    constructor() {
        this.numbersAPI = new NumbersAPI(DSSelector.getDS())
        this.db = Locator.createCache()
        this.loadStaticRoutes()
        this.subscribeToPostal()
        this.store = new StoreAPI(SDSelector.getDriver())
    }

    addEndpoint(addressOfRecord, route) {
        LOG.debug(`location.Locator.addEndpoint [adding endpoint ${addressOfRecord} with rout => ${JSON.stringify(route)}]`)
        LOG.debug(`location.Locator.addEndpoint [contactURI => ${LocatorUtils.aorAsObj(route.contactURI)}]`)

        let routes = this.db.getIfPresent(addressOfRecord)
        if (routes === null) routes = []

        routes = routes.filter(r => !LocatorUtils.contactURIFilter(r.contactURI, route.contactURI))
        routes.push(route)
        // See NOTE #1
        this.db.put(addressOfRecord, routes)
    }

    findEndpoint(addressOfRecord) {
        LOG.debug(`location.Locator.findEndpoint [lookup route for aor ${addressOfRecord}]`)

        if (addressOfRecord.startsWith('tel:')) {
            return this.findEndpointByTelUrl(addressOfRecord)
        }

        const routes = this.db.getIfPresent(addressOfRecord)

        if (routes !== null) {
            return CoreUtils.buildResponse(Status.OK, routes)
        }

        const defaultRouteKey = this.db.asMap().keySet()
            .stream()
            .filter(key => new RegExp(key).test(addressOfRecord))
            .findFirst()

        return defaultRouteKey.isPresent()
          ? CoreUtils.buildResponse(Status.OK, this.db.getIfPresent(defaultRouteKey.get()))
          : CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    findEndpointByTelUrl(addressOfRecord) {
        LOG.debug(`location.Locator.findEndpointByTelUrl [lookup route for aor ${addressOfRecord}]`)
        const response = this.numbersAPI.getNumberByTelUrl(addressOfRecord)
        if (response.status === Status.OK) {
            const number = response.data
            const routes = this.db.getIfPresent(number.spec.location.aorLink)
            return routes !== null
              ? CoreUtils.buildResponse(Status.OK, routes)
              : CoreUtils.buildResponse(Status.NOT_FOUND,
                `No route found for aorLink: ${number.spec.location.aorLink}`)
        }
        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    removeEndpoint(addressOfRecord, contactURI, isWildcard) {
        LOG.debug(`location.Locator.removeEndpoint [remove route for aor => ${addressOfRecord}, isWildcard => ${isWildcard}]`)
        // Remove all bindings
        if (isWildcard === true) {
            return this.db.invalidate(addressOfRecord)
        }

        let routes = this.db.getIfPresent(addressOfRecord)
        if (routes) {
            routes = routes.filter(route => !LocatorUtils.contactURIFilter(route.contactURI, contactURI))

            if (routes.length === 0) {
              this.db.invalidate(addressOfRecord)
              return
            }
            this.db.put(addressOfRecord, routes)
        }
    }

    getDomainEgressRoutes(domains, numbersAPI, gatewaysAPI) {
        const SipFactory = Java.type('javax.sip.SipFactory')
        const addressFactory = SipFactory.getInstance().createAddressFactory()
        const routes = new HashMap()

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
                        const contactURI = addressFactory.createSipURI(
                          gateway.metadata.ref, buildAddr(gateway.spec.host,
                            gateway.spec.port))
                        //contactURI.setSecure(aorObj.isSecure())
                        const route = LocatorUtils.buildEgressRoute(contactURI,
                          gateway, number, domain)

                        routes.put(`sip:${domain.spec.context.egressPolicy.rule}@${domain.spec.context.domainUri}`, [route])
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
        const domains = domainsAPI.getDomains().data
        const egressRoutes = this.getDomainEgressRoutes(domains, numbersAPI,
          gatewaysAPI)
        this.db.putAll(egressRoutes)
    }

    subscribeToPostal() {
        const aorAsString = a => LocatorUtils.aorAsString(a)
        postal.subscribe({
            channel: "locator",
            topic: "endpoint.remove",
            callback: (data, envelope) => {
                const aor = aorAsString(data.addressOfRecord)
                this.removeEndpoint(aor, data.contactURI, data.isWildcard)
                this.store.withCollection('location').remove(aor)
            }
        })

        postal.subscribe({
            channel: "locator",
            topic: "endpoint.add",
            callback: (data, envelope) => {
                const aor = aorAsString(data.addressOfRecord)
                this.addEndpoint(aor, data.route)

                // Also adding to the network hashtable
                const routes = this.db.getIfPresent(aor)
                  .map(route => {
                      route.contactURI = route.contactURI.toString()
                      return route
                  })
                const entry = { addressOfRecord: aor, routes: routes }
                this.store.withCollection('location').put(aor, JSON.stringify(entry))
            }
        })

        postal.subscribe({
            channel: "locator",
            topic: "endpoint.find",
            callback: (data, envelope) => {
                const response = this.findEndpoint(
                  LocatorUtils.aorAsString(data.addressOfRecord))
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

    static createCache() {
        const exp = graph => {
          const data = graph.map(route => route.expires)
          const expires = Math.max.apply(Math, data)
          return expires === -1
            ? TimeUnit.SECONDS.toNanos(Long.MAX_VALUE)
            : TimeUnit.SECONDS.toNanos(expires)
        }

        const db = Caffeine.newBuilder()
        .expireAfter(new Expiry({
              expireAfterCreate: (key, graph, currentTime) => exp(graph),
              expireAfterUpdate: (key, graph, currentTime, currentDuration) => exp(graph),
              expireAfterRead: function (key, graph, currentTime, currentDuration) {
                  return currentDuration
              }
          }))
        .build()
        return db
    }

    evictAll() {
        LOG.debug(`location.Locator.evictAll [emptying location table]`)
        // WARNING: Should we provide a way to disable this?
        const cnt = this.db.estimatedSize()
        this.db.invalidateAll()
        LOG.debug(`location.Locator.evictAll [evicted ${cnt} entries from location table]`)
    }
}

module.exports = Locator
