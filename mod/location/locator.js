/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const LocatorUtils = require('@routr/location/utils')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DSSelector = require('@routr/data_api/ds_selector')
const SDSelector = require('@routr/data_api/store_driver_selector')
const StoreAPI = require('@routr/data_api/store_api')
const postal = require('postal')
const { Status } = require('@routr/core/status')
const phone = require('phone')

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

/**
 * NOTE #1: Notice that addressOfRecord.toString !eq to
 * LocatorUtils.aorAsString(addressOfRecord). This is to ensure the location of
 * the devices regardless of any additional parameters that they may have.
 */
class Locator {
  constructor () {
    this.numbersAPI = new NumbersAPI(DSSelector.getDS())
    this.store = new StoreAPI(SDSelector.getDriver()).withCollection('location')
    this.subscribeToPostal()
  }

  addEndpoint (addressOfRecord, route) {
    // This must be done here before we convert contactURI into a string
    const contactURI = LocatorUtils.aorAsString(route.contactURI)
    route.contactURI = route.contactURI.toString()

    LOG.debug(
      `location.Locator.addEndpoint [adding endpoint ${addressOfRecord} with route => ${JSON.stringify(
        route
      )}]`
    )
    LOG.debug(
      `location.Locator.addEndpoint [contactURI => ${LocatorUtils.aorAsObj(
        route.contactURI
      )}]`
    )

    let jsonRoutes = this.store.get(addressOfRecord)
    let routes = jsonRoutes ? JSON.parse(jsonRoutes) : []

    routes = routes
      .filter(r => !LocatorUtils.expiredRouteFilter(r))
      .filter(r => !LocatorUtils.sameSourceFilter(r, route))
      .filter(
        r => !LocatorUtils.contactURIFilter(r.contactURI, route.contactURI)
      )

    // See NOTE #1
    routes.push(route)
    this.store.put(addressOfRecord, JSON.stringify(routes))
  }

  findEndpoint (addressOfRecord) {
    LOG.debug(
      `location.Locator.findEndpoint [lookup route for aor ${addressOfRecord}]`
    )

    const jsonRoutes = this.store.get(addressOfRecord)

    if (jsonRoutes !== null) {
      let routes = JSON.parse(jsonRoutes)
      routes = routes.filter(r => !LocatorUtils.expiredRouteFilter(r))
      return CoreUtils.buildResponse(Status.OK, null, routes)
    }

    if (addressOfRecord.startsWith('tel:')) {
      return this.findEndpointByTelUrl(addressOfRecord)
    } else {
      const tel = LocatorUtils.aorAsObj(addressOfRecord).getUser()
      try {
        const telE164 = phone(tel)[0]
        const response = this.findEndpointByTelUrl(`tel:${telE164}`)
        if (response.status === Status.OK) return response
      } catch (e) {
        // Ignore
      }
    }

    const defaultRouteKey = this.store
      .keySet()
      .filter(key => new RegExp(key).test(addressOfRecord))

    const parse = (s, k) => JSON.parse(s.get(k[0]))

    return defaultRouteKey.length > 0
      ? CoreUtils.buildResponse(
          Status.OK,
          null,
          parse(this.store, defaultRouteKey)
        )
      : CoreUtils.buildResponse(Status.NOT_FOUND)
  }

  findEndpointByTelUrl (addressOfRecord) {
    LOG.debug(
      `location.Locator.findEndpointByTelUrl [lookup route for aor ${addressOfRecord}]`
    )
    const response = this.numbersAPI.getNumberByTelUrl(addressOfRecord)
    if (response.status === Status.OK) {
      const number = response.data
      const jsonRoutes = this.store.get(number.spec.location.aorLink)

      if (!jsonRoutes) return CoreUtils.buildResponse(Status.NOT_FOUND)

      let routes = JSON.parse(jsonRoutes)
      routes = routes.filter(r => !LocatorUtils.expiredRouteFilter(r))

      return routes !== null
        ? CoreUtils.buildResponse(Status.OK, null, routes)
        : CoreUtils.buildResponse(
            Status.NOT_FOUND,
            `No route found for aorLink: ${number.spec.location.aorLink}`
          )
    }
    return CoreUtils.buildResponse(Status.NOT_FOUND)
  }

  removeEndpoint (addressOfRecord, contactURI, isWildcard) {
    LOG.debug(
      `location.Locator.removeEndpoint [remove route for aor => ${addressOfRecord}, isWildcard => ${isWildcard}]`
    )

    let jsonRoutes = this.store.get(addressOfRecord)
    if (jsonRoutes) {
      let routes = JSON.parse(jsonRoutes)
      routes = routes.filter(
        route => !LocatorUtils.contactURIFilter(route.contactURI, contactURI)
      )

      // Remove all bindings
      if (routes.length === 0 || isWildcard === true) {
        this.store.remove(addressOfRecord)
        return
      }
      this.store.put(addressOfRecord, JSON.stringify(routes))
    }
  }

  subscribeToPostal () {
    const aorAsString = a => LocatorUtils.aorAsString(a)
    postal.subscribe({
      channel: 'locator',
      topic: 'endpoint.remove',
      callback: (data, envelope) => {
        const aor = aorAsString(data.addressOfRecord)
        this.removeEndpoint(aor, data.contactURI, data.isWildcard)
      }
    })

    postal.subscribe({
      channel: 'locator',
      topic: 'endpoint.add',
      callback: (data, envelope) => {
        const aor = aorAsString(data.addressOfRecord)
        this.addEndpoint(aor, data.route)
      }
    })

    postal.subscribe({
      channel: 'locator',
      topic: 'endpoint.find',
      callback: (data, envelope) => {
        const response = this.findEndpoint(aorAsString(data.addressOfRecord))
        postal.publish({
          channel: 'locator',
          topic: 'endpoint.find.reply',
          data: {
            response: response,
            requestId: data.requestId
          }
        })
      }
    })
  }

  evictAll () {
    LOG.debug(`location.Locator.evictAll [emptying location table]`)
    // WARNING: Should we provide a way to disable this?
    const keys = this.store.keySet()
    keys.forEach(key => this.store.remove(key))
    LOG.debug(
      `location.Locator.evictAll [evicted ${
        keys.length
      } entries from location table]`
    )
  }
}

module.exports = Locator
