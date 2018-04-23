
/**
 * @author Pedro Sanders
 * @since v1
 */
import CoreUtils from 'core/utils'
import DSUtil from 'data_api/utils'
import { Status } from 'core/status'

const foundDependentObjects = { status: Status.CONFLICT, message: Status.message[4092].value }

export default class DomainsAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        return this.domainExist(jsonObj.spec.context.domainUri)? CoreUtils.buildResponse(Status.CONFLICT) : this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        return !this.domainExist(jsonObj.spec.context.domainUri)? CoreUtils.buildResponse(Status.NOT_FOUND) : this.ds.update(jsonObj)
    }

    getDomains(filter) {
        return this.ds.withCollection('domains').find(filter)
    }

    getDomain(ref) {
        return DSUtil.deepSearch(this.getDomains(), "metadata.ref", ref)
    }

    getDomainByUri(domainUri) {
        return DSUtil.deepSearch(this.getDomains(), "spec.context.domainUri", domainUri)
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

        return agents.length == 0? this.ds.withCollection('domains').remove(ref) : foundDependentObjects
    }
}
