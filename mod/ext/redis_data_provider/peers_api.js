/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'ext/redis_data_provider/ds'
import DSUtil from 'data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class PeersAPI {

    constructor() {
        this.ds = new DataSource()
    }

    createFromJSON(jsonObj) {
        if(this.peerExist(jsonObj.spec.credentials.username)) {
            return {
                status: Status.CONFLICT,
                message: Status.message[Status.CONFLICT].value,
            }
        }
        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if(!this.peerExist(jsonObj.spec.credentials.username)) {
            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value,
            }
        }
        return this.ds.update(jsonObj)
    }

    getPeers(filter) {
        return this.ds.withCollection('peers').find(filter)
    }

    getPeer(ref) {
        const response = this.getPeers()
        let peer

        response.result.forEach(obj => {
            if (obj.metadata.ref == ref) {
                peer = obj
            }
        })

        if (!isEmpty(peer)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: peer
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getPeerByUsername(username) {
        const response = this.getPeers()
        let peer

        response.result.forEach(obj => {
            if (obj.spec.credentials.username == username) {
                peer = obj
            }
        })

        if (!isEmpty(peer)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: peer
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    peerExist(username) {
        const response = this.getPeerByUsername(username)
        if (response.status == Status.OK) return true
        return false
    }

    deletePeer(ref) {
        return this.ds.withCollection('peers').remove(ref)
    }

}