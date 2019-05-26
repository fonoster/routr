/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtil = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const { FOUND_DEPENDENT_OBJECTS_RESPONSE } = require ('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

class GatewaysAPI {

    constructor(dataSource) {
        this.ds = dataSource
        this.cache = Caffeine.newBuilder()
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .maximumSize(100)
          .build();
    }

    createFromJSON(jsonObj) {
        return this.gatewayExist(jsonObj.spec.host)? CoreUtils.buildResponse(Status.CONFLICT):this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        return !this.gatewayExist(jsonObj.spec.host)? CoreUtils.buildResponse(Status.NOT_FOUND):this.ds.update(jsonObj)
    }

    getGateways(filter)  {
        return this.ds.withCollection('gateways').find(filter)
    }

    getGateway(ref) {
       return this.ds.withCollection('gateways').get(ref)
    }

    getGatewayByHost(host) {
        let gw = this.cache.getIfPresent(host)

        if (gw == null) {
            gw = DSUtil.deepSearch(this.getGateways(), "spec.host", host)
            this.cache.put(host, gw)
        }

        return gw
    }

    gatewayExist(host) {
        return DSUtil.objExist(this.getGatewayByHost(host))
    }

    deleteGateway(ref) {
        if (this.cache.getIfPresent(ref)) {
          this.cache.invalidate(ref)
        }

        let response = this.getGateway(ref)

        if (response.status != Status.OK) {
            return response
        }

        const gateway = response.result

        response = this.ds.withCollection('dids').find("@.metadata.gwRef=='" + gateway.metadata.ref + "'")
        const dids = response.result

        return dids.length == 0? this.ds.withCollection('gateways').remove(ref): FOUND_DEPENDENT_OBJECTS_RESPONSE
    }

}

module.exports = GatewaysAPI
