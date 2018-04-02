/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

export default class PeersAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        if(this.peerExist(jsonObj.spec.credentials.username)) {
           return DSUtil.buildResponse(Status.CONFLICT)
        }
        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if(!this.peerExist(jsonObj.spec.credentials.username)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }
        return this.ds.update(jsonObj)
    }

    getPeers(filter) {
        return this.ds.withCollection('peers').find(filter)
    }

    getPeer(ref) {
        let peer = DSUtil.deepSearch(this.getPeers().result, "metadata.ref", ref)

        if (isEmpty(peer)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }

        return DSUtil.buildResponse(Status.OK, peer)
    }

    getPeerByUsername(username) {
        let peer = DSUtil.deepSearch(this.getPeers().result, "spec.credentials.username", username)

        if (isEmpty(peer)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }

        return DSUtil.buildResponse(Status.OK, peer)
    }

    peerExist(username) {
        const response = this.getPeerByUsername(username)
        if (response.status == Status.OK) {
            return true
        }
        return false
    }

    deletePeer(ref) {
        return this.ds.withCollection('peers').remove(ref)
    }

}