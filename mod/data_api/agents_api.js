/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtil = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const { UNFULFILLED_DEPENDENCY_RESPONSE } = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')

class AgentsAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    save(agent, operation) {
        if (!this.doesDomainExist(agent)) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        } else if(this.existInAnotherDomain(agent)) {
            return CoreUtils.buildResponse(Status.CONFLICT)
        }
        return operation == 'insert'?  this.ds.insert(agent) : this.ds.update(agent)
    }

    createFromJSON(agent) {
        return this.save(agent, 'insert')
    }

    updateFromJSON(agent) {
        return this.save(agent, 'update')
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
        return DSUtil.deepSearch(this.getAgents(), "metadata.ref", ref)
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
        const response = this.getAgents("@.spec.credentials.username=="
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
        const domains = JSON.stringify(agent.spec.domains).replaceAll("\"","'")
        const response = this.ds.withCollection('domains').find("@.spec.context.domainUri in " + domains)
        return response.result.length != agent.spec.domains.length? false: true
    }
}

module.exports = AgentsAPI
