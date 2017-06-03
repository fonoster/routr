/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import isEmpty from 'utils/obj_util'
import { Status } from 'resources/status'

export default class DIDsAPI {

    constructor() {
        this.resourcePath = 'config/dids.yml'
        this.schemaPath = 'etc/schemas/dids_schema.json'
        this.rUtil = new ResourcesUtil()

        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/dids.yml' resource. Server unable to continue..."
        }
    }

    getDIDs(filter) {
        return this.rUtil.getObjs(this.resourcePath, this.filter)
    }

    getDID(ref) {
        const resource = this.rUtil.getJson(this.resourcePath)
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
    getDIDByTelUrl(telUrl) {
        const resource = this.rUtil.getJson(this.resourcePath)
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

    didExist(ref) {
        const result = this.getGateway(ref)
        if (result.status == Status.OK) return true
        return false
    }

    createDID() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    createDID() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteDIDs() {
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