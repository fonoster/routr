/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class GatewaysAPI {

    constructor() {
        this.resourcePath = 'config/gateways.yml'
        this.schemaPath = 'etc/schemas/gateways_schema.json'
        this.dsUtil = new DSUtil()

        if (!this.dsUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/gateways.yml' resource. Server unable to continue..."
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

    getGateways(filter)  {
        let objs = this.dsUtil.getObjs(this.resourcePath, filter)

        objs.obj.forEach(obj => {
            if (!obj.metadata.ref) obj.metadata.ref = this.generateRef(obj.spec.regService.host)
        })

        return objs
    }

    getGateway(ref) {
        const resource = DSUtil.getJson(this.resourcePath)
        let gateways

        resource.forEach(obj => {
            if (!obj.metadata.ref) obj.metadata.ref = this.generateRef(obj.spec.regService.host)
            if (obj.metadata.ref == ref) gateways = obj
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

    deleteGateway(ref) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    generateRef(host) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(host))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "gw" + hash.substring(hash.length() - 6).toLowerCase()
    }
}