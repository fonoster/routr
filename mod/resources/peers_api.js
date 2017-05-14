/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')
load('mod/resources/status.js')
load('mod/utils/obj_util.js')

var PeersAPI = (() => {
    const self = this
    const rUtil = new ResourcesUtil()
    const resourcePath = 'config/peers.yml'
    const schemaPath = 'mod/resources/schemas/peers_schema.json'

    self.getPeers = filter => rUtil.getObjs(resourcePath, filter)

    self.getPeer = username => {
        const resource = rUtil.getJson(resourcePath)
        let peer

        resource.forEach(obj => {
            if (obj.spec.credentials.username == username) {
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

    self.peerExist = username => {
        const result = self.getPeer(username)
        if (result.status == Status.OK) return true
        return false
    }

    self.createPeer = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    self.updatePeer = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    self.deletePeer = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    function _getInstance() {
        if (!rUtil.isResourceValid(schemaPath, resourcePath)) {
            throw "Invalid 'config/peers.yml' resource. Server unable to continue..."
        }

        return self
    }

    return {
        getInstance: _getInstance
    }
})()