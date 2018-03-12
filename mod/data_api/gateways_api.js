/**
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

export default class GatewaysAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        if(this.gatewayExist(jsonObj.spec.regService.host)) {
            return {
                status: Status.CONFLICT,
                message: Status.message[Status.CONFLICT].value,
            }
        }

        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if(!this.gatewayExist(jsonObj.spec.regService.host)) {
            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value,
            }
        }

        return this.ds.update(jsonObj)
    }

    getGateways(filter)  {
        return this.ds.withCollection('gateways').find(filter)
    }

    getGateway(ref) {
        const response = this.getGateways()
        let gateways

        response.result.forEach(obj => {
            if (obj.metadata.ref == ref) {
                gateways = obj
            }
        })

        if (!isEmpty(gateways)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: gateways
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getGatewayByHost(host) {
        const response = this.getGateways()
        let gateways

        response.result.forEach(obj => {
            if (obj.spec.regService.host == host) {
                gateways = obj
            }
        })

        if (isEmpty(gateways)) {
            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: gateways
        }
    }

    gatewayExist(host) {
        const response = this.getGatewayByHost(host)
        if (response.status == Status.OK) return true
        return false
    }

    deleteGateway(ref) {
        let response = this.getGateway(ref)

        if (response.status != Status.OK) {
            return response
        }

        const gateway = response.result

        response = this.ds.withCollection('dids').find("@.metadata.gwRef=='" + gateway.metadata.ref + "'")
        const dids = response.result

        if (dids.length == 0) {
            return this.ds.withCollection('gateways').remove(ref)
        } else {
            return {
                status: Status.CONFLICT,
                message: Status.message[4092].value
            }
        }
    }

}