/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'ext/rest_data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class AgentsAPI {

    constructor() {
        this.dsUtil = new DSUtil()
    }

    getAgents(filter) {
        return this.dsUtil.getObjs('agents', filter)
    }

    getAgent(domainUri, username) {
        try {
            const filter = '?domainUri=' + domainUri + '&filter=@.spec.credentials.username==\'' + username + '\''
            const result = this.dsUtil.getWithAuth('/agents' + filter)

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

    agentExist(domainUri, username) {
        const result = this.getAgent(domainUri, username)
        if (result.status == Status.OK) return true
        return false
    }

    createAgent() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateAgent() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteAgent() {
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