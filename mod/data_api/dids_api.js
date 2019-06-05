/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const { UNFULFILLED_DEPENDENCY_RESPONSE } = require('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

class DIDsAPI {

    constructor(dataSource) {
        this.ds = dataSource
        this.cache = Caffeine.newBuilder()
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .maximumSize(5000)
          .build();
    }

    createFromJSON(jsonObj) {
        const response = this.ds.withCollection('gateways').get(jsonObj.metadata.gwRef)

        if (response.status !== Status.OK) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }

        if (!this.didExist(jsonObj.spec.location.telUrl)) {
            const response = this.ds.insert(jsonObj)
            this.cache.put(jsonObj.spec.location.telUrl, response)
            return response
        }

        return  CoreUtils.buildResponse(Status.CONFLICT)
    }

    updateFromJSON(jsonObj) {
        const response = this.ds.withCollection('gateways').get(jsonObj.metadata.gwRef)

        if (response.status !== Status.OK) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }

        if (this.didExist(jsonObj.spec.location.telUrl)) {
            const response = this.ds.update(jsonObj)
            this.cache.put(jsonObj.spec.location.telUrl, response)
            return response
        }

        return  CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getDIDs(filter) {
        return this.ds.withCollection('dids').find(filter)
    }

    getDID(ref) {
        return this.ds.withCollection('gateways').get(ref)
    }

    /**
     * note: telUrl maybe a string in form of 'tel:${number}' or
     * a TelURL Object.
     */
    getDIDByTelUrl(telUrl) {
        let response = this.cache.getIfPresent(telUrl)

        if (response === null) {
            response = DSUtils.deepSearch(this.getDIDs(), "spec.location.telUrl", telUrl)
            this.cache.put(telUrl, response)
        }

        return response
    }

    didExist(telUrl) {
        return DSUtils.objExist(this.getDIDByTelUrl(telUrl))
    }

    deleteDID(ref) {
        if (this.cache.getIfPresent(ref)) {
          this.cache.invalidate(ref)
        }
        return this.ds.withCollection('dids').remove(ref)
    }

}

module.exports = DIDsAPI
