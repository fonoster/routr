/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class DIDsAPI {

    constructor() {
        this.resourcePath = 'config/dids.yml'
        this.schemaPath = 'etc/schemas/dids_schema.json'
        this.dsUtil = new DSUtil()

        if (!this.dsUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/dids.yml' resource. Server unable to continue..."
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

    getDIDs(filter) {
        let response = this.ds.withCollection('dids').find(filter)

        response.result.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.location.telUrl)
            }
        })

        return response
    }

    getDID(ref) {
        const resource = DSUtil.getJson(this.resourcePath)
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
                result: did
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
        const resource = DSUtil.getJson(this.resourcePath)
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

    deleteDID(ref) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    generateRef(telUrl) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(telUrl))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "dd" + hash.substring(hash.length() - 6).toLowerCase()
    }
}
