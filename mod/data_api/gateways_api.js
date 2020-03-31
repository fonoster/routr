/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const APIBase = require('@routr/data_api/api_base')
const { Status } = require('@routr/core/status')
const { buildAddr } = require('@routr/utils/misc_utils')
const { FOUND_DEPENDENT_OBJECTS_RESPONSE } = require('@routr/core/status')
const getCacheKey = j => buildAddr(j.spec.host, j.spec.port)

class GatewaysAPI extends APIBase {
  constructor (dataSource) {
    super(dataSource, 'gateways')
  }

  createFromJSON (jsonObj) {
    const hasUnfulfilledDependency = () => false
    const alreadyExist = j => this.gatewayExist(j.spec.host, j.spec.port)
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

  getGateways (filter, page, itemsPerPage) {
    return super.getResources(filter, page, itemsPerPage)
  }

  getGateway (ref) {
    return super.getResource(ref)
  }

  getGatewayByHostAndPort (h, p) {
    if (!p) return this.getGatewayByHost(h)
    const host = buildAddr(h, p)

    let response = this.cache.getIfPresent(host)

    if (response === null) {
      const gws = this.getGateways().data.filter(
        g => g.spec.port + '' === p + '' && g.spec.host === h
      )

      if (gws.length === 0) {
        return {
          status: Status.NOT_FOUND
        }
      }

      response = {
        status: Status.OK,
        data: gws[0]
      }

      this.cache.put(host, response)
    }

    return response
  }

  getGatewayByHost (host) {
    let response = this.cache.getIfPresent(host)

    if (response === null) {
      response = DSUtils.deepSearch(this.getGateways(), 'spec.host', host)
      this.cache.put(host, response)
    }

    return response
  }

  gatewayExist (host, port) {
    return DSUtils.objExist(this.getGatewayByHostAndPort(host, port))
  }

  deleteGateway (ref) {
    this.invalidate(ref, getCacheKey)

    let response = this.getGateway(ref)

    if (response.status !== Status.OK) {
      return response
    }

    const gateway = response.data

    response = this.ds
      .withCollection('numbers')
      .find(`@.metadata.gwRef=='${gateway.metadata.ref}'`)
    const numbers = response.data

    return numbers.length === 0
      ? this.ds.withCollection('gateways').remove(ref)
      : FOUND_DEPENDENT_OBJECTS_RESPONSE
  }
}

module.exports = GatewaysAPI
