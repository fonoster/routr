/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const APIBase = require('@routr/data_api/api_base')
const { Status } = require('@routr/core/status')
const { FOUND_DEPENDENT_OBJECTS_RESPONSE } = require('@routr/core/status')
const getCacheKey = j => j.spec.location.telUrl

class NumbersAPI extends APIBase {
  constructor (dataSource) {
    super(dataSource, 'numbers')
  }

  createFromJSON (jsonObj) {
    const hasUnfulfilledDependency = j => {
      const r = this.ds.withCollection('gateways').get(j.metadata.gwRef)
      return r.status !== Status.OK
    }
    const alreadyExist = j => this.numberExist(getCacheKey(j))
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

  getNumbers (filter, page, itemsPerPage) {
    return super.getResources(filter, page, itemsPerPage)
  }

  getNumber (ref) {
    return super.getResource(ref)
  }

  /**
   * note: telUrl maybe a string in form of 'tel:${number}' or
   * a TelURL Object.
   */
  getNumberByTelUrl (telUrl) {
    let response = this.cache.getIfPresent(telUrl)

    if (response === null) {
      response = DSUtils.deepSearch(
        this.getNumbers(),
        'spec.location.telUrl',
        telUrl
      )
      this.cache.put(telUrl, response)
    }

    return response
  }

  numberExist (telUrl) {
    return DSUtils.objExist(this.getNumberByTelUrl(telUrl))
  }

  deleteNumber (ref) {
    this.invalidate(ref, getCacheKey)

    const response = this.ds
      .withCollection('domains')
      .find(`@.spec.context.egressPolicy.numberRef=='${ref}'`)
    const domains = response.data

    return domains.length === 0
      ? this.ds.withCollection('numbers').remove(ref)
      : FOUND_DEPENDENT_OBJECTS_RESPONSE
  }
}

module.exports = NumbersAPI
