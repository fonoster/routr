/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import { Status } from 'resources/status'
import isEmpty from 'utils/obj_util'

export default class GatewaysAPI {

    constructor() {
        this.resourcePath = 'config/gateways.yml'
        this.schemaPath = 'etc/schemas/gateways_schema.json'
        this.rUtil = new ResourcesUtil()

        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/gateways.yml' resource. Server unable to continue..."
        }
    }

    getGateways(filter)  {
        return this.rUtil.getObjs(this.resourcePath, this.filter)
    }

    getGateway(ref) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let gateways

        resource.forEach(obj => {
            if (obj.metadata.ref == ref) {
                gateways = obj
            }
        })

        if (!isEmpty(gateways)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: gateways
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getGWByRef(ref) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let gateways

        resource.forEach(obj => {
            if (obj.metadata.ref == ref) {
                gateways = obj
            }
        })

        if (!isEmpty(gateways)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: gateways
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