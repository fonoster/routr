/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import { Status } from 'resources/status'
import isEmpty from 'utils/obj_util'

const SipFactory = Packages.javax.sip.SipFactory

export default class DomainsAPI {

    constructor() {
        this.resourcePath = 'config/domains.yml'
        this.schemaPath = 'etc/schemas/domains_schema.json'
        this.rUtil = new ResourcesUtil()
        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/domains.yml' resource. Server unable to continue..."
        }
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
    }

    getDomains(filter) {
        return this.rUtil.getObjs(this.resourcePath, filter)
    }

    getDomain(domainUri) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let domain

        resource.forEach(obj => {
            if (obj.spec.context.domainUri == domainUri) {
                domain = obj
            }
        })

        if (!isEmpty(domain)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: domain
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    domainExist(domainUri){
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