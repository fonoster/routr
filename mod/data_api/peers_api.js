/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const {
    Status
} = require('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

class PeersAPI {

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

        if (!this.peerExist(jsonObj.spec.credentials.username)) {
            const response = this.ds.insert(jsonObj)
            this.cache.put(jsonObj.spec.credentials.username, response)
            return response
        }

        return CoreUtils.buildResponse(Status.CONFLICT)
    }

    updateFromJSON(jsonObj) {
        if (!jsonObj.metadata || !jsonObj.metadata.ref) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY,
                DSUtils.roMessage('metadata.ref'))
        }

        const oldObj = this.getPeer(jsonObj.metadata.ref).data

        if (!oldObj || !oldObj.kind) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY)
        }

        // Patch writeOnly fields
        const patchObj = DSUtils.patchObj(oldObj, jsonObj)
        const errors = DSUtils.validateEntity(patchObj, oldObj, 'write')

        if (errors.length > 0) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY, errors)
        }

        if (this.peerExist(patchObj.spec.credentials.username)) {
            const response = this.ds.update(patchObj)
            this.cache.put(patchObj.spec.credentials.username, response)
            return response
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    getPeers(filter, page, itemsPerPage) {
        return this.ds.withCollection('peers').find(filter, page, itemsPerPage)
    }

    getPeer(ref) {
        return this.ds.withCollection('peers').get(ref)
    }

    peerExist(username) {
        return DSUtils.objExist(this.getPeerByUsername(username))
    }

    getPeerByUsername(username) {
        let response = this.cache.getIfPresent(username)

        if (response === null) {
            response = DSUtils.deepSearch(this.getPeers(), "spec.credentials.username", username)
            this.cache.put(username, response)
        }

        return response
    }

    deletePeer(ref) {
        if (this.cache.getIfPresent(ref)) {
            this.cache.invalidate(ref)
        }

        return this.ds.withCollection('peers').remove(ref)
    }

    cleanCache() {
        this.cache.invalidateAll()
    }
}

module.exports = PeersAPI
