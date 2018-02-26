/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'ext/rest_data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class DomainsAPI {

    constructor() {
        const sipFactory = Packages.javax.sip.SipFactory.getInstance()
        this.addressFactory =  sipFactory.createAddressFactory()
        this.dsUtil = new DSUtil()
    }

    getDomains(filter) {
        return this.dsUtil.getObjs('domains', filter)
    }

    getDomain(domainUri) {
        try {
            const result = this.dsUtil.getWithAuth('/domains/' + domainUri)

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
                    obj: result
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

    domainExist(domainUri) {
        const result = this.getDomain(domainUri)
        if (result.status == Status.OK) return true
        return false
    }

    createDomain() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateDomain() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteDomains() {
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