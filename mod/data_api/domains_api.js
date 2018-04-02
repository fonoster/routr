/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

const foundDependentObjects = { status: Status.CONFLICT, message: Status.message[4092].value }

export default class DomainsAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        if(this.domainExist(jsonObj.spec.context.domainUri)) {
            return DSUtil.buildResponse(Status.CONFLICT)
        }
        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if(!this.domainExist(jsonObj.spec.context.domainUri)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }
        return this.ds.update(jsonObj)
    }

    getDomains(filter) {
        return this.ds.withCollection('domains').find(filter)
    }

    getDomain(ref) {
        const response = this.getDomains()
        let domain

        response.result.forEach(obj => {
            if (obj.metadata.ref == ref) {
                domain = obj
            }
        })

        if (isEmpty(domain)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }

        return DSUtil.buildResponse(Status.OK, domain)
    }

    getDomainByUri(domainUri) {
        const response = this.getDomains()
        let domain

        response.result.forEach(obj => {
            if (obj.spec.context.domainUri == domainUri) {
                domain = obj
            }
        })

        if (isEmpty(domain)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }

        return DSUtil.buildResponse(Status.OK, domain)
    }

    domainExist(domainUri) {
        const response = this.getDomainByUri(domainUri)
        if (response.status == Status.OK) {
            return true
        }
        return false
    }

    deleteDomain(ref) {
        let response = this.getDomain(ref)

        if (response.status != Status.OK) {
            return response
        }

        const domain = response.result

        response = this.ds.withCollection('agents').find("'" + domain.spec.context.domainUri + "' in @.spec.domains")
        const agents = response.result

        if (agents.length == 0) {
            return this.ds.withCollection('domains').remove(ref)
        }

        return foundDependentObjects
    }
}