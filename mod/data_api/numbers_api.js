/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const {
    Status
} = require('@routr/core/status')
const {
    UNFULFILLED_DEPENDENCY_RESPONSE,
    FOUND_DEPENDENT_OBJECTS_RESPONSE
} = require('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

class NumbersAPI {

    constructor(dataSource) {
        this.ds = dataSource
        this.cache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build()
    }

    createFromJSON(jsonObj) {
        const errors = DSUtils.validateEntity(jsonObj)
        if (errors.length > 0) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY, errors)
        }

        const response = this.ds.withCollection('gateways').get(jsonObj.metadata.gwRef)

        if (response.status !== Status.OK) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }

        if (!this.numberExist(jsonObj.spec.location.telUrl)) {
            const response = this.ds.insert(jsonObj)
            this.cache.put(jsonObj.spec.location.telUrl, response)
            return response
        }

        return CoreUtils.buildResponse(Status.CONFLICT)
    }

    updateFromJSON(jsonObj) {
        let errors = DSUtils.validateEntity(jsonObj)
        if (errors.length > 0) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY, errors)
        }

        const oldObj = this.getNumber(jsonObj.metadata.ref).data

        if (!oldObj || !oldObj.kind) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY,
              DSUtils.roMessage('metadata.ref'))
        }

        const patchObj = DSUtils.patchObj(oldObj, jsonObj) // Patch with the RO fields
        errors = DSUtils.validateEntity(patchObj, oldObj, 'write')

        if (errors.length > 0) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY, errors)
        }

        if (this.numberExist(patchObj.spec.location.telUrl)) {
            const response = this.ds.update(patchObj)
            this.cache.put(patchObj.spec.location.telUrl, response)
            return response
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getNumbers(filter, page, itemsPerPage) {
        return this.ds.withCollection('numbers').find(filter, page, itemsPerPage)
    }

    getNumber(ref) {
        return this.ds.withCollection('numbers').get(ref)
    }

    /**
     * note: telUrl maybe a string in form of 'tel:${number}' or
     * a TelURL Object.
     */
    getNumberByTelUrl(telUrl) {
        let response = this.cache.getIfPresent(telUrl)

        if (response === null) {
            response = DSUtils.deepSearch(this.getNumbers(), "spec.location.telUrl", telUrl)
            this.cache.put(telUrl, response)
        }

        return response
    }

    numberExist(telUrl) {
        return DSUtils.objExist(this.getNumberByTelUrl(telUrl))
    }

    deleteNumber(ref) {
        if (this.cache.getIfPresent(ref)) {
            this.cache.invalidate(ref)
        }

        const response = this.ds.withCollection('domains')
          .find(`@.spec.context.egressPolicy.numberRef=='${ref}'`)
        const domains = response.data

        return domains.length === 0
          ? this.ds.withCollection('numbers').remove(ref)
          : FOUND_DEPENDENT_OBJECTS_RESPONSE
    }

    cleanCache() {
        this.cache.invalidateAll()
    }
}

module.exports = NumbersAPI
