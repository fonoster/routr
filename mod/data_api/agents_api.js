/**
 * @author Pedro Sanders
 * @since v1
 */
import CoreUtils from 'core/utils'
import DSUtil from 'data_api/utils'
import { Status } from 'core/status'
import { UNFULFILLED_DEPENDENCY_RESPONSE } from 'core/status'
import isEmpty from 'utils/obj_util'

export default class AgentsAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    save(domain) {
        if (!this.doesDomainExist(domain)) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        }
        return this.existInAnotherDomain(domain)? CoreUtils.buildResponse(Status.CONFLICT): this.ds.update(domain)
    }

    createFromJSON(domain) {
       save(domain)
    }

    updateFromJSON(jsonObj) {
        save(domain)
    }

    getAgents(filter) {
        return this.ds.withCollection('agents').find(filter)
    }

    getAgentByDomain(domainUri, username) {
        const response = this.getAgents()
        let agent
        response.result.forEach(obj => {
            if (obj.spec.credentials.username == username) {
                obj.spec.domains.forEach(d => {
                    if (domainUri == d) {
                        agent = obj
                    }
                })
            }
        })

        return isEmpty(agent)? CoreUtils.buildResponse(Status.NOT_FOUND): CoreUtils.buildResponse(Status.OK, agent)
    }

    getAgentByRef(ref) {
        return DSUtil.deepSearch(this.getAgents().result, "metadata.ref", ref)
    }

    /**
     * Takes either one argument(ref) or two arguments(domainUri and username)
     */
    getAgent(arg1, arg2) {
        return arguments.length == 2? this.getAgentByDomain(arg1, arg2): this.getAgentByRef(arg1)
    }

    agentExist(domainUri, username) {
       return DSUtil.objExist(this.getAgent(domainUri, username))
    }

    deleteAgent(ref) {
        return this.ds.withCollection('agents').remove(ref)
    }

    existInAnotherDomain(agent) {
        const response = getAgents("@.spec.credentials.username=="
            + agent.spec.credentials.username)
        for (const x in response.result) {
            const curAgent = response.result[x]
            for (var y in curAgent.spec.domains) {
                const curDomain = curAgent.spec.domains[y]
                if (agent.spec.domains.indexOf(curDomain) != -1) {
                    return true
                }
            }
        }
        return false
    }

    doesDomainExist(agent) {
        const domains = JSON.stringify(jsonObj.spec.domains).replaceAll("\"","'")
        const response = this.ds.withCollection('domains').find("@.spec.context.domainUri in " + domains)
        return response.result.length != agent.spec.domains.length? false: true
    }
}
