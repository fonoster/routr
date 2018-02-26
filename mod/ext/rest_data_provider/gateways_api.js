/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'ext/rest_data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class GatewaysAPI {

    constructor() {
        this.dsUtil = new DSUtil()
    }

    getGateways(filter)  {
        return this.dsUtil.getObjs('gateways', filter)
    }

    getGateway(ref) {
        try {
            const filter = '?filter=@.metadata.ref==\'' + ref + '\''
            const result = this.dsUtil.getWithAuth('/gateways' + filter)

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

    gatewayExist(ref) {
        const result = this.getGateway(ref)
        if (result.status == Status.OK) return true
        return false
    }

    createGateway() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateGateway() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteGateways() {
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