/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')
load('mod/resources/status.js')
load('mod/utils/obj_util.js')

var DIDsAPI = (() => {
    const self = this
    const rUtil = new ResourcesUtil()
    const resourcePath = 'config/dids.yml'
    const schemaPath = 'mod/resources/schemas/dids_schema.json'

    self.getDIDs = filter => rUtil.getObjs(resourcePath, filter)

    self.getDID = ref => {
        const resource = rUtil.getJson(resourcePath)
        let did

        resource.forEach(obj => {
            if (obj.metadata.ref == ref) {
                did = obj
            }
        })

        if (!isEmpty(did)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: did
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    /**
     * note: telUrl maybe a string in form of 'tel:${number}' or
     * a TelURL.
     */
    self.getDIDByTelUrl = telUrl => {
        const resource = rUtil.getJson(resourcePath)
        let did
        let url

        if (telUrl instanceof Packages.javax.sip.address.TelURL) {
            url = 'tel:' + telUrl.getPhoneNumber()
        } else {
            url = telUrl
        }

        resource.forEach(obj => {
            if (obj.spec.location.telUrl.toString() == telUrl) {
                did = obj
            }
        })

        if (!isEmpty(did)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: did
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    self.didExist = ref => {
        const result = self.getGateway(ref)
        if (result.status == Status.OK) return true
        return false
    }

    self.createDID = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    self.createDID = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    self.deleteDID = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    function _getInstance() {
        if (!rUtil.isResourceValid(schemaPath, resourcePath)) {
            throw "Invalid 'config/dids.yml' resource. Server unable to continue..."
        }

        return self
    }

    return {
        getInstance: _getInstance
    }
})()