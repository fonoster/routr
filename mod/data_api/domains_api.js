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
        return DSUtil.deepSearch(this.getDomains().result, "metadata.ref", ref)
    }

    getDomainByUri(domainUri) {
        return DSUtil.deepSearch(this.getDomains().result, "spec.context.domainUri", domainUri)
    }

    domainExist(domainUri) {
        return DSUtil.objExist(this.getDomainByUri(domainUri))
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