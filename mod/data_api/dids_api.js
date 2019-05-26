/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtil = require('@routr/data_api/utils')
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
        const response = this.ds.withCollection('gateways').find("@.metadata.ref=='" + jsonObj.metadata.gwRef + "'")

        if (response.result.length == 0) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }

        return this.didExist(jsonObj.spec.location.telUrl)?
          CoreUtils.buildResponse(Status.CONFLICT):this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        const response = this.ds.withCollection('gateways').find("@.metadata.ref=='" + jsonObj.metadata.gwRef + "'")

        if (response.result.length == 0) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }

        return !this.didExist(jsonObj.spec.location.telUrl)?
          CoreUtils.buildResponse(Status.NOT_FOUND) : this.ds.update(jsonObj)
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
        let did = this.cache.getIfPresent(telUrl)

        if (did == null) {
            did = DSUtil.deepSearch(this.getDIDs(), "spec.location.telUrl", telUrl)
            this.cache.put(telUrl, did)
        }

        return did
    }

    didExist(telUrl) {
        return DSUtil.objExist(this.getDIDByTelUrl(telUrl))
    }

    deleteDID(ref) {
        if (this.cache.getIfPresent(ref)) {
          this.cache.invalidate(ref)
        }
        return this.ds.withCollection('dids').remove(ref)
    }

}

module.exports = DIDsAPI
