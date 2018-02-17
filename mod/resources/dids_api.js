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

    generateRef(telUrl) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(telUrl))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "dd" + hash.substring(hash.length() - 6).toLowerCase()
    }

    getDIDs(filter) {
        let objs = this.rUtil.getObjs(this.resourcePath, filter)

        objs.obj.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.location.telUrl)
            }
        })

        return objs
    }

    getDID(ref) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let did

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.location.telUrl)
            }

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

        if (!(telUrl instanceof Packages.javax.sip.address.TelURL)) throw 'Expects a TelURL as parameter'

        url = 'tel:' + telUrl.getPhoneNumber()

        resource.forEach(obj => {
            if (obj.spec.location.telUrl == telUrl) {
                if (!obj.metadata.ref) {
                    obj.metadata.ref = this.generateRef(obj.spec.location.telUrl)
                }
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
        const result = this.getDID(ref)
        if (result.status == Status.OK) return true
        return false
    }

    didExistByTelUrl(telUrl) {
        const result = this.getDIDByTelUrl(telUrl)
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

    deleteDID() {
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