/**
 * @author Pedro Sanders
 * @since v1
 */
const LocatorUtils = require('@routr/location/utils')
const DomainsAPI = require('@routr/data_api/domains_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DSSelector = require('@routr/data_api/ds_selector')
const SDSelector = require('@routr/data_api/store_driver_selector')
const StoreAPI = require('@routr/data_api/store_api')
const isEmpty = require('@routr/utils/obj_util')
const {
    Status
} = require('@routr/core/status')

const HashMap = Java.type('java.util.HashMap')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class RouteLoader {

    constructor() {
        this.store = new StoreAPI(SDSelector.getDriver()).withCollection('location')
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
        LOG.debug(`location.RouteLoader.loadStaticRoutes [loading static routes]`)
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

}

module.exports = RouteLoader

loader = new RouteLoader()
