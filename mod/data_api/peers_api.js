/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtil = require('@routr/data_api/utils')
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
        return !this.peerExist(jsonObj.spec.credentials.username)? CoreUtils.buildResponse(Status.NOT_FOUND):this.ds.update(jsonObj)
    }

    createFromJSON(jsonObj) {
        return this.peerExist(jsonObj.spec.credentials.username)? CoreUtils.buildResponse(Status.CONFLICT):this.ds.insert(jsonObj)
    }

    getPeers(filter) {
        return this.ds.withCollection('peers').find(filter)
    }

    getPeer(ref) {
        return this.ds.withCollection('peers').get(ref)
    }

    peerExist(username) {
        return DSUtil.objExist(this.getPeerByUsername(username))
    }

    getPeerByUsername(username) {
        let peer = this.cache.getIfPresent(username)

        if (peer == null) {
            peer = DSUtil.deepSearch(this.getPeers(), "spec.credentials.username", username)
            this.cache.put(username, peer)
        }

        return peer
    }

    deletePeer(ref) {
        if (this.cache.getIfPresent(ref)) {
          this.cache.invalidate(ref)
        }

        return this.ds.withCollection('peers').remove(ref)
    }

}

module.exports = PeersAPI
