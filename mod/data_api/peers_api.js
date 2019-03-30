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
        return DSUtil.deepSearch(this.getPeers(), "metadata.ref", ref)
    }

    peerExist(username) {
        return DSUtil.objExist(this.getPeerByUsername(username))
    }

    getPeerByUsername(username) {
        return DSUtil.deepSearch(this.getPeers(), "spec.credentials.username", username)
    }

    deletePeer(ref) {
        return this.ds.withCollection('peers').remove(ref)
    }

}
