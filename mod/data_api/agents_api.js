/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const {
    Status,
    UNFULFILLED_DEPENDENCY_RESPONSE
} = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

class AgentsAPI {

    constructor(dataSource) {
        this.ds = dataSource
        this.cache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build()
    }

    save(agent, operation) {
        if (!this.doesDomainExist(agent)) {
            return UNFULFILLED_DEPENDENCY_RESPONSE
        } else if (this.existInAnotherDomain(agent)) {
            return CoreUtils.buildResponse(Status.CONFLICT)
        }
        return operation === 'insert' ? this.ds.insert(agent) : this.ds.update(agent)
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
        const key = domainUri.trim() + '.' + username.trim()
        let agent = this.cache.getIfPresent(key)

        if (agent === null) {
            const response = this.getAgents()

            response.result.forEach(obj => {
                if (obj.spec.credentials.username === username) {
                    obj.spec.domains.forEach(d => {
                        if (domainUri === d) {
                            agent = obj
                            this.cache.put(key, agent)
                        }
                    })
                }
            })
        }

        return isEmpty(agent) ? CoreUtils.buildResponse(Status.NOT_FOUND) : CoreUtils.buildResponse(Status.OK, agent)
    }

    getAgentByRef(ref) {
        return this.ds.withCollection('agents').get(ref)
    }

    /**
     * Takes either one argument(ref) or two arguments(domainUri and username)
     */
    getAgent(arg1, arg2) {
        return arguments.length === 2 ? this.getAgentByDomain(arg1, arg2) : this.getAgentByRef(arg1)
    }

    agentExist(domainUri, username) {
        return DSUtils.objExist(this.getAgent(domainUri, username))
    }

    deleteAgent(ref) {
        const response = this.getAgent(ref)

        if (response.status !== Status.OK) return response

        const agent = response.result

        agent.spec.domains.forEach(domain => {
            const key = domain.trim() + '.' + agent.spec.credentials.username.trim()
            if (this.cache.getIfPresent(key)) {
                this.cache.invalidate(key)
            }
        })

        return this.ds.withCollection('agents').remove(ref)
    }

    existInAnotherDomain(agent) {
        const response = this.getAgents("@.spec.credentials.username==" +
            agent.spec.credentials.username)
        for (const x in response.result) {
            const curAgent = response.result[x]
            for (var y in curAgent.spec.domains) {
                const curDomain = curAgent.spec.domains[y]
                if (agent.spec.domains.indexOf(curDomain) !== -1) {
                    return true
                }
            }
        }
        return false
    }

    doesDomainExist(agent) {
        const domains = JSON.stringify(agent.spec.domains).replaceAll("\"", "'")
        const response = this.ds.withCollection('domains').find("@.spec.context.domainUri in " + domains)
        return response.result.length !== agent.spec.domains.length ? false : true
    }
}

module.exports = AgentsAPI
