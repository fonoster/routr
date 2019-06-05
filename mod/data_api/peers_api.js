/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

class PeersAPI {

    constructor(dataSource) {
        this.ds = dataSource
        this.cache = Caffeine.newBuilder()
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .maximumSize(100)
          .build();
    }

    updateFromJSON(jsonObj) {
        if (this.peerExist(jsonObj.spec.credentials.username)) {
            const response = this.ds.update(jsonObj)
            this.cache.put(jsonObj.spec.credentials.username, response)
            return response
        }

        return CoreUtils.buildResponse(Status.NOT_FOUND)
    }

    createFromJSON(jsonObj) {
        if (!this.peerExist(jsonObj.spec.credentials.username)) {
            const response = this.ds.insert(jsonObj)
            this.cache.put(jsonObj.spec.credentials.username, response)
            return response
        }

        return CoreUtils.buildResponse(Status.CONFLICT)
    }

    getPeers(filter) {
        return this.ds.withCollection('peers').find(filter)
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

}

module.exports = PeersAPI
