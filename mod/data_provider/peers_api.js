/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'data_provider/ds'
import DSUtil from 'data_provider/utils'
import FilesUtil from 'utils/files_util'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class PeersAPI {

    constructor(resourcePath = 'config/peers.yml') {
        this.resourcePath = resourcePath
        this.schemaPath = 'etc/schemas/peers_schema.json'
        this.ds = new DataSource()

        if (!DSUtil.isValidDataSource(this.schemaPath, FilesUtil.readFile(resourcePath))) {
            throw "Invalid 'config/peers.yml' resource. Server unable to continue..."
        }
    }

    createFromJSON(jsonObj) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateFromJSON(jsonObj) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    getPeers(filter) {
        let response = this.ds.withCollection('peers').find(filter)

        response.result.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
            }
        })

        return objs
    }

    getPeer(ref) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
        let peer

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
            }

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
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
        let peer

        resource.forEach(obj => {
            if (obj.spec.credentials.username == username) {
                if (!obj.metadata.ref) {
                    obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
                }
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
        const result = this.getPeerByUsername(username)
        if (result.status == Status.OK) return true
        return false
    }

    deletePeer(ref) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    generateRef(username) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(username))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "pr" + hash.substring(hash.length() - 6).toLowerCase()
    }

}