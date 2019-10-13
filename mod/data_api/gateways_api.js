/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    buildAddr
} = require('@routr/utils/misc_utils')
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const {
    Status
} = require('@routr/core/status')
const {
    FOUND_DEPENDENT_OBJECTS_RESPONSE
} = require('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

class GatewaysAPI {

    constructor(dataSource) {
        this.ds = dataSource
        this.cache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build()
    }

    createFromJSON(jsonObj) {
        if (!this.gatewayExist(jsonObj.spec.host, jsonObj.spec.port)) {
            const response = this.ds.insert(jsonObj)
            const host = buildAddr(jsonObj.spec.host, jsonObj.spec.port)
            this.cache.put(host, response)
            return response
        }

        return CoreUtils.buildResponse(Status.CONFLICT)
    }

    updateFromJSON(jsonObj) {
        if (this.gatewayExist(jsonObj.spec.host, jsonObj.spec.port)) {
            const response = this.ds.update(jsonObj)
            const host = buildAddr(jsonObj.spec.host, jsonObj.spec.port)
            this.cache(host, response)
            return response
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getGateways(filter, page, itemsPerPage) {
        return this.ds.withCollection('gateways').find(filter, page, itemsPerPage)
    }

    getGateway(ref) {
        return this.ds.withCollection('gateways').get(ref)
    }

    getGatewayByHostAndPort(h, port) {
        if (!port) return this.getGatewayByHost(host)
        const host = buildAddr(h, port)

        let response = this.cache.getIfPresent(host)

        if (response === null) {
            const r1 = DSUtils.deepSearch(this.getGateways(), 'spec.port', port)
            const r2 = DSUtils.deepSearch(this.getGateways(), 'spec.host', host)

            if (r1.status === Status.NOT_FOUND || r2.status === Status.NOT_FOUND) {
                response = {
                    status: Status.NOT_FOUND
                }
            }

            this.cache.put(host, response)
        }

        return response
    }


    getGatewayByHost(host) {
        let response = this.cache.getIfPresent(host)

        if (response === null) {
            response = DSUtils.deepSearch(this.getGateways(), 'spec.host', host)
            this.cache.put(host, response)
        }

        return response
    }

    gatewayExist(host, port) {
        return DSUtils.objExist(this.getGatewayByHostAndPort(host, port))
    }

    deleteGateway(ref) {
        if (this.cache.getIfPresent(ref)) {
            this.cache.invalidate(ref)
        }

        let response = this.getGateway(ref)

        if (response.status !== Status.OK) {
            return response
        }

        const gateway = response.data

        response = this.ds.withCollection('numbers').find(`@.metadata.gwRef=='${gateway.metadata.ref}'`)
        const numbers = response.data

        return numbers.length === 0 ? this.ds.withCollection('gateways').remove(ref) : FOUND_DEPENDENT_OBJECTS_RESPONSE
    }

}

module.exports = GatewaysAPI
