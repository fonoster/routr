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
    ENTITY_ALREADY_EXIST_RESPONSE
} = require('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

const foundDependentObjects = {
    status: Status.CONFLICT,
    message: Status.message[4092].value
}

class DomainsAPI {

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

        if (jsonObj.spec.context.egressPolicy &&
            !this.doesNumberExist(jsonObj.spec.context.egressPolicy.numberRef)) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }

        if (!this.domainExist(jsonObj.spec.context.domainUri)) {
            const response = this.ds.insert(jsonObj)
            this.cache.put(jsonObj.spec.context.domainUri, response)
            return response
        }

        return ENTITY_ALREADY_EXIST_RESPONSE
    }

    updateFromJSON(jsonObj) {
        if (!jsonObj.metadata || !jsonObj.metadata.ref) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY,
              DSUtils.roMessage('metadata.ref'))
        }

        const oldObj = this.getDomain(jsonObj.metadata.ref).data

        if (!oldObj || !oldObj.kind) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY)
        }

        // Patch WO fields
        const patchObj = DSUtils.patchObj(oldObj, jsonObj)
        const errors = DSUtils.validateEntity(patchObj, oldObj, 'write')
        if (errors.length > 0) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY, errors)
        }

        if (patchObj.spec.context.egressPolicy &&
            !this.doesNumberExist(patchObj.spec.context.egressPolicy.numberRef)) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }

        if (this.domainExist(patchObj.spec.context.domainUri)) {
            const response = this.ds.update(patchObj)
            this.cache.put(patchObj.spec.context.domainUri, response)
            return response
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getDomains(filter, page, itemsPerPage) {
        return this.ds.withCollection('domains').find(filter, page, itemsPerPage)
    }

    getDomain(ref) {
        return this.ds.withCollection('domains').get(ref)
    }

    getDomainByUri(domainUri) {
        let response = this.cache.getIfPresent(domainUri)

        if (response === null) {
            response = DSUtils.deepSearch(this.getDomains(), "spec.context.domainUri", domainUri)
            this.cache.put(domainUri, response)
        }
        return response
    }

    domainExist(domainUri) {
        return DSUtils.objExist(this.getDomainByUri(domainUri))
    }

    deleteDomain(ref) {
        let response = this.getDomain(ref)

        if (response.status !== Status.OK) {
            return response
        }

        const domain = response.data

        if (this.cache.getIfPresent(domain.spec.context.domainUri)) {
            this.cache.invalidate(domain.spec.context.domainUri)
        }

        response = this.ds.withCollection('agents').find(`'${domain.spec.context.domainUri}' in @.spec.domains`)
        const agents = response.data

        return agents.length === 0 ? this.ds.withCollection('domains').remove(ref) : foundDependentObjects
    }

    deleteDomainByUri(uri) {
        const response = this.getDomainByUri(uri)
        return response.status !== Status.OK
          ? response : this.deleteDomain(response.data.metadata.ref)
    }

    doesNumberExist(numberRef) {
        const response = this.ds.withCollection('numbers').get(numberRef)
        return response.status === Status.OK
    }

    cleanCache() {
        this.cache.invalidateAll()
    }
}

module.exports = DomainsAPI
