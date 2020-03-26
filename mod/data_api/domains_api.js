/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const APIBase = require('@routr/data_api/api_base')
const { Status } = require('@routr/core/status')
const foundDependentObjects = {
  status: Status.CONFLICT,
  message: Status.message[4092].value
}
const getCacheKey = j => j.spec.context.domainUri

class DomainsAPI extends APIBase {
  constructor (dataSource) {
    super(dataSource, 'domains')
  }

  createFromJSON (jsonObj) {
    const hasUnfulfilledDependency = j => {
      return (
        j.spec.context.egressPolicy &&
        !this.doesNumberExist(j.spec.context.egressPolicy.numberRef)
      )
    }
    const alreadyExist = j => this.domainExist(j.spec.context.domainUri)
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

  getDomains (filter, page, itemsPerPage) {
    return super.getResources(filter, page, itemsPerPage)
  }

  getDomain (ref) {
    return super.getResource(ref)
  }

  getDomainByUri (domainUri) {
    let response = this.cache.getIfPresent(domainUri)

    if (response === null) {
      response = DSUtils.deepSearch(
        this.getDomains(),
        'spec.context.domainUri',
        domainUri
      )
      this.cache.put(domainUri, response)
    }
    return response
  }

  domainExist (domainUri) {
    return DSUtils.objExist(this.getDomainByUri(domainUri))
  }

  deleteDomain (ref) {
    let response = this.getDomain(ref)

    if (response.status !== Status.OK) {
      return response
    }

    const domain = response.data

    if (this.cache.getIfPresent(domain.spec.context.domainUri)) {
      this.cache.invalidate(domain.spec.context.domainUri)
    }

    response = this.ds
      .withCollection('agents')
      .find(`'${domain.spec.context.domainUri}' in @.spec.domains`)
    const agents = response.data

    return agents.length === 0
      ? this.ds.withCollection('domains').remove(ref)
      : foundDependentObjects
  }

  deleteDomainByUri (uri) {
    const response = this.getDomainByUri(uri)
    return response.status !== Status.OK
      ? response
      : this.deleteDomain(response.data.metadata.ref)
  }

  doesNumberExist (numberRef) {
    const response = this.ds.withCollection('numbers').get(numberRef)
    return response.status === Status.OK
  }
}

module.exports = DomainsAPI
