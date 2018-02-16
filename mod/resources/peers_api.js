/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import isEmpty from 'utils/obj_util'
import { Status } from 'resources/status'

const FromHeader = Packages.javax.sip.header.FromHeader

export default class PeersAPI {

    constructor() {
        this.resourcePath = 'config/peers.yml'
        this.schemaPath = 'etc/schemas/peers_schema.json'
        this.rUtil = new ResourcesUtil()

        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/peers.yml' resource. Server unable to continue..."
        }
    }

    generateRef(username) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(username))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "pr" + hash.substring(hash.length() - 6).toLowerCase()
    }

    getPeers(filter) {
        let objs = this.rUtil.getObjs(this.resourcePath, filter)

        objs.obj.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
            }
        })

        return objs
    }

    getPeer(username) {
        const resource = this.rUtil.getJson(this.resourcePath)
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
                obj: peer
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    peerExist(username) {
        const result = this.getPeer(username)
        if (result.status == Status.OK) return true
        return false
    }

    createPeer() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updatePeer() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deletePeer() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    createFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }
}