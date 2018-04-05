/**
 * @author Pedro Sanders
 * @since v1
 */
import CoreUtils from 'core/utils'
import DSUtil from 'data_api/utils'
import { Status } from 'core/status'

export default class PeersAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        return this.peerExist(jsonObj.spec.credentials.username)? CoreUtils.buildResponse(Status.CONFLICT):this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        return !this.peerExist(jsonObj.spec.credentials.username)? CoreUtils.buildResponse(Status.NOT_FOUND):this.ds.update(jsonObj)
    }

    getPeers(filter) {
        return this.ds.withCollection('peers').find(filter)
    }

    getPeer(ref) {
        return DSUtil.deepSearch(this.getPeers().result, "metadata.ref", ref)
    }

    getPeerByUsername(username) {
        return DSUtil.deepSearch(this.getPeers().result, "spec.credentials.username", username)
    }

    peerExist(username) {
        return DSUtil.objExist(this.getPeerByUsername(username))
    }

    deletePeer(ref) {
        return this.ds.withCollection('peers').remove(ref)
    }

}