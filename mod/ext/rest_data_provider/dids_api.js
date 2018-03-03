/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'ext/rest_data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class DIDsAPI {

    constructor() {
        this.dsUtil = new DSUtil()
    }

    getDIDs(filter) {
        return this.dsUtil.getObjs('dids', filter)
    }

    getDID(ref) {
        try {
            const filter = '?filter=@.metadata.ref==\'' + ref + '\''
            const result = this.dsUtil.getWithAuth('/dids' + filter)

            if (result.status && result.status != 200) {
                return {
                    status: result.status,
                    message: result.message
                }
            }

            if (!isEmpty(result)) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    obj: result[0]
                }
            }
        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: e.getMessage()
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
        if (!(telUrl instanceof Packages.javax.sip.address.TelURL)) throw 'Expects a TelURL as parameter'

        const url = 'tel:' + telUrl.getPhoneNumber()

        try {
            const filter = '?filter=@.spec.location.telUrl==\'' + url + '\''
            const result = this.dsUtil.getWithAuth('/dids' + filter)

            if (result.status && result.status != 200) {
                return {
                    status: result.status,
                    message: result.message
                }
            }

            if (!isEmpty(result)) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    obj: result[0]
                }
            }
        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: e.getMessage()
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    didExist(telUrl) {
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