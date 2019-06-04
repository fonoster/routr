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
        if (!this.gatewayExist(jsonObj.spec.host)) {
            const response = this.ds.insert(jsonObj)
            this.cache.put(jsonObj.spec.host, response)
            return response
        }

        return CoreUtils.buildResponse(Status.CONFLICT)
    }

    updateFromJSON(jsonObj) {
        if (this.gatewayExist(jsonObj.spec.host)) {
            const response = this.ds.update(jsonObj)
            this.cache(jsonObj.spec.host, response)
            return response
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getGateways(filter)  {
        return this.ds.withCollection('gateways').find(filter)
    }

    getGateway(ref) {
       return this.ds.withCollection('gateways').get(ref)
    }

    getGatewayByHost(host) {
        let response = this.cache.getIfPresent(host)

        if (response === null) {
            response = DSUtil.deepSearch(this.getGateways(), "spec.host", host)
            this.cache.put(host, response)
        }

        return response
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
