/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

const conflictResponse = { status: Status.CONFLICT, message: Status.message[4091].value }

export default class AgentsAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    existInAnotherDomain(agent) {
        const response = getAgents("@.spec.credentials.username=='" + agent.spec.credentials.username + "'")
        const agents = response.results

        for(let i = 0; i < agents.length; i++) {
            const curAgent = agents[i]

            for(let y = 0; y < curAgent.spec.domains.length; y++) {
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

        if (response.result.length != agent.spec.domains.length) {
            return false
        }
        return true
    }

    createFromJSON(jsonObj) {
        if (!doesDomainExist(jsonObj)) {
            return conflictResponse
        }

        if (existInAnotherDomain(jsonObj)) {
            return DSUtil.buildResponse(Status.CONFLICT)
        }

        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if (!doesDomainExist(jsonObj)) {
            return conflictResponse
        }

        if (existInAnotherDomain(jsonObj)) {
           return DSUtil.buildResponse(Status.CONFLICT)
        }

        return this.ds.update(jsonObj)
    }

    getAgents(filter) {
        return this.ds.withCollection('agents').find(filter)
    }

    getAgentInDomain(domainUri, username) {
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
        return agent
    }

    getAgentByRef(ref) {
        const response = this.getAgents()
        let agent
        response.result.forEach(obj => {
            if (obj.metadata.ref == ref) {
                agent = obj
            }
        })
        return agent
    }

    /**
     * Takes either one argument(ref) or two arguments(domainUri and username)
     */
    getAgent(arg1, arg2) {
        let agent

        if(arguments.length == 2) {
            agent = this.getAgentInDomain(arg1, arg2)
        } else {
            agent = this.getAgentByRef(arg1)
        }

        if (isEmpty(agent)) {
           return DSUtil.buildResponse(Status.NOT_FOUND)
        }

        return DSUtil.buildResponse(Status.OK, agent)
    }

    agentExist(domainUri, username) {
        const response = this.getAgent(domainUri, username)
        if (response.status == Status.OK) return true
        return false
    }

    deleteAgent(ref) {
        return this.ds.withCollection('agents').remove(ref)
    }

}