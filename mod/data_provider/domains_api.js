/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'data_provider/ds'
import DSUtil from 'data_provider/utils'
import FilesUtil from 'utils/files_util'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

const SipFactory = Packages.javax.sip.SipFactory

export default class DomainsAPI {

    constructor(resourcePath = 'config/domains.yml') {
        this.resourcePath = resourcePath
        this.schemaPath = 'etc/schemas/domains_schema.json'
        this.ds = new DataSource()

        if (!DSUtil.isValidDataSource(this.schemaPath, FilesUtil.readFile(resourcePath))) {
            throw "Invalid 'config/domains.yml' resource. Server unable to continue..."
        }

        this.addressFactory = SipFactory.getInstance().createAddressFactory()
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

    getDomains(filter) {
        let response = this.ds.withCollection('domains').find(filter)

        response.result.forEach(obj => {
            if (!obj.metadata.ref) {
                if (!obj.metadata.ref) {
                    obj.metadata.ref = this.generateRef(obj.spec.context.domainUri)
                }
            }
        })

        return response
    }

    getDomain(ref) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
        let domain

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.context.domainUri)
            }

            if (obj.metadata.ref == ref) {
                domain = obj
            }
        })

        if (!isEmpty(domain)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: domain
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getDomainByUri(domainUri) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
        let domain

        resource.forEach(obj => {
            if (obj.spec.context.domainUri == domainUri) {
                if (!obj.metadata.ref) {
                    obj.metadata.ref = this.generateRef(obj.spec.context.domainUri)
                }
                domain = obj
            }
        })

        if (!isEmpty(domain)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: domain
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    domainExist(domainUri){
        const response = this.getDomainByUri(domainUri)
        if (response.status == Status.OK) return true
        return false
    }

    deleteDomain(ref) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    generateRef(domainUri) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(domainUri))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "dm" + hash.substring(hash.length() - 6).toLowerCase()
    }
}