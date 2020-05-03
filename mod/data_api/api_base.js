/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const CoreUtils = require('@routr/core/utils')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')
const merge = require('deepmerge')
const {
  Status,
  UNFULFILLED_DEPENDENCY_RESPONSE,
  ENTITY_ALREADY_EXIST_RESPONSE
} = require('@routr/core/status')
const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray

class APIBase {
  constructor (dataSource, resourceType) {
    this.resourceType = resourceType
    this.ds = dataSource
    this.cache = Caffeine.newBuilder()
      .expireAfterWrite(5, TimeUnit.MINUTES)
      .build()
  }

  createFromJSON (
    jsonObj,
    alreadyExist,
    hasUnfulfilledDependency,
    getCacheKey
  ) {
    const errors = DSUtils.validateEntity(jsonObj)
    if (errors.length > 0) {
      return CoreUtils.buildResponse(
        Status.UNPROCESSABLE_ENTITY,
        errors.join(', ')
      )
    }

    if (hasUnfulfilledDependency(jsonObj)) {
      return UNFULFILLED_DEPENDENCY_RESPONSE
    }

    if (!alreadyExist(jsonObj)) {
      const response = this.ds.insert(jsonObj)
      this.cache.put(getCacheKey(jsonObj), response)
      return response
    }

    return ENTITY_ALREADY_EXIST_RESPONSE
  }

  updateFromJSON (jsonObj, getCacheKey) {
    if (!jsonObj.metadata || !jsonObj.metadata.ref) {
      return CoreUtils.buildResponse(
        Status.UNPROCESSABLE_ENTITY,
        DSUtils.roMessage('metadata.ref')
      )
    }

    const oldObj = this.getResource(jsonObj.metadata.ref).data

    if (!oldObj || !oldObj.kind) {
      return CoreUtils.buildResponse(
        Status.UNPROCESSABLE_ENTITY,
        DSUtils.roMessage('metadata.ref')
      )
    }

    // Patch writeOnly fields
    //const patchObj = DSUtils.patchObj(oldObj, jsonObj)
    const patchObj = merge(oldObj, jsonObj, { arrayMerge: overwriteMerge })
    const errors = DSUtils.validateEntity(patchObj, oldObj, 'write')

    if (errors.length > 0) {
      return CoreUtils.buildResponse(
        Status.UNPROCESSABLE_ENTITY,
        errors.join(', ')
      )
    }

    const response = this.ds.update(patchObj)
    const cacheKey = getCacheKey(patchObj)
    this.cache.put(cacheKey, response)

    return response
  }

  getResources (filter, page, itemsPerPage) {
    return this.ds
      .withCollection(this.resourceType)
      .find(filter, page, itemsPerPage)
  }

  getResource (ref) {
    return this.ds.withCollection(this.resourceType).get(ref)
  }

  invalidate (ref, getCacheKey) {
    const response = this.getResource(ref)

    if (response.status !== Status.OK) return response

    this.cache.invalidate(getCacheKey(response.data))
  }

  cleanCache () {
    this.cache.invalidateAll()
  }
}

module.exports = APIBase
