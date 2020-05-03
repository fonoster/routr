/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const APIBase = require('@routr/data_api/api_base')
const { Status } = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')
const getCacheKey = j => j.metadata.ref

class AgentsAPI extends APIBase {
  constructor (dataSource) {
    super(dataSource, 'agents')
  }

  createFromJSON (jsonObj) {
    const hasUnfulfilledDependency = j => !this.doesDomainExist(j)
    const alreadyExist = j => this.existInAnotherDomain(j)
    return super.createFromJSON(
      jsonObj,
      alreadyExist,
      hasUnfulfilledDependency,
      getCacheKey
    )
  }

  updateFromJSON (jsonObj) {
    return super.updateFromJSON(jsonObj, getCacheKey)
  }

  getAgents (filter, page, itemsPerPage) {
    return super.getResources(filter, page, itemsPerPage)
  }

  getAgentByDomain (domainUri, username) {
    const key = `${domainUri.trim()}.${username.trim()}`
    let agent = this.cache.getIfPresent(key)

    if (agent === null) {
      const response = this.getAgents()

      response.data.forEach(obj => {
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

    return isEmpty(agent)
      ? CoreUtils.buildResponse(Status.NOT_FOUND)
      : CoreUtils.buildResponse(Status.OK, null, agent)
  }

  getAgentByRef (ref) {
    return super.getResource(ref)
  }

  /**
   * Takes either one argument(ref) or two arguments(domainUri and username)
   */
  getAgent (arg1, arg2) {
    return arguments.length === 2
      ? this.getAgentByDomain(arg1, arg2)
      : this.getAgentByRef(arg1)
  }

  agentExist (domainUri, username) {
    return DSUtils.objExist(this.getAgent(domainUri, username))
  }

  deleteAgent (ref) {
    const response = this.getAgent(ref)

    if (response.status !== Status.OK) return response

    const agent = response.data

    agent.spec.domains.forEach(domain => {
      const key = `${domain.trim()}.${agent.spec.credentials.username.trim()}`
      if (this.cache.getIfPresent(key)) {
        this.cache.invalidate(key)
      }
    })

    return this.ds.withCollection('agents').remove(ref)
  }

  existInAnotherDomain (agent) {
    const response = this.getAgents(
      `@.spec.credentials.username==${agent.spec.credentials.username}`
    )
    for (const x in response.data) {
      const curAgent = response.data[x]
      for (var y in curAgent.spec.domains) {
        const curDomain = curAgent.spec.domains[y]
        if (agent.spec.domains.indexOf(curDomain) !== -1) {
          return true
        }
      }
    }
    return false
  }

  doesDomainExist (agent) {
    const domains = JSON.stringify(agent.spec.domains).replaceAll('"', "'")
    const response = this.ds
      .withCollection('domains')
      .find(`@.spec.context.domainUri in ${domains}`)
    return response.data.length === agent.spec.domains.length
  }
}

module.exports = AgentsAPI
