/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import isEmpty from 'utils/obj_util'
import { Status } from 'resources/status'

export default class GatewaysAPI {

    constructor() {
        this.resourcePath = 'config/gateways.yml'
        this.schemaPath = 'etc/schemas/gateways_schema.json'
        this.rUtil = new ResourcesUtil()

        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/gateways.yml' resource. Server unable to continue..."
        }
    }

    generateRef(host) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(host))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "gw" + hash.substring(hash.length() - 6).toLowerCase()
    }

    getGateways(filter)  {
        let objs = this.rUtil.getObjs(this.resourcePath, filter)

        objs.obj.forEach(obj => {
            if (!obj.metadata.ref) {
                if (!obj.metadata.ref) {
                    obj.metadata.ref = this.generateRef(obj.spec.regService.host)
                }
            }
        })

        return objs
    }

    getGateway(ref) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let gateways

        resource.forEach(obj => {
            if (obj.metadata.ref == ref) {
                if (!obj.metadata.ref) {
                    obj.metadata.ref = this.generateRef(obj.spec.regService.host)
                }
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

    deleteGateway() {
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