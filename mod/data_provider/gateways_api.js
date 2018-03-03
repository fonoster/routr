/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'data_provider/ds'
import DSUtil from 'data_provider/utils'
import FilesUtil from 'utils/files_util'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class GatewaysAPI {

    constructor(resourcePath = 'config/gateways.yml') {
        this.resourcePath = resourcePath
        this.schemaPath = 'etc/schemas/gateways_schema.json'
        this.ds = new DataSource()

        if (!DSUtil.isValidDataSource(this.schemaPath, FilesUtil.readFile(resourcePath))) {
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
        let response = this.ds.withCollection('gateways').find(filter)

        response.result.forEach(obj => {
            if (!obj.metadata.ref) obj.metadata.ref = this.generateRef(obj.spec.regService.host)
        })

        return response.result
    }

    getGateway(ref) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
        let gateways

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.regService.host)
            }

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
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
        let gateways

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.regService.host)
            }

            if (obj.spec.regService.host == host) {
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

    gatewayExist(host) {
        const response = this.getGatewayByHost(host)
        if (response.status == Status.OK) return true
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