/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'ext/redis_data_provider/ds'
import DSUtil from 'data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class DomainsAPI {

    constructor() {
        this.ds = new DataSource()
    }

    createFromJSON(jsonObj) {
        if(this.domainExist(jsonObj.spec.context.domainUri)) {
            return {
                status: Status.CONFLICT,
                message: Status.message[Status.CONFLICT].value,
            }
        }

        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if(!this.domainExist(jsonObj.spec.context.domainUri)) {
            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value,
            }
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
        const response = this.getDomains()
        let domain

        response.result.forEach(obj => {
            if (obj.spec.context.domainUri == domainUri) {
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

    domainExist(domainUri) {
        const response = this.getDomainByUri(domainUri)
        if (response.status == Status.OK) return true
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
        } else {
            return {
                status: Status.CONFLICT,
                message: Status.message[409.2].value
            }
        }
    }
}