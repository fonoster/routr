/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const FilesUtil = require('@routr/utils/files_util')
const { Status } = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')
const paginateArray = require('paginate-array')
const flat = require('flat')
const unflatten = require('flat').unflatten
const merge = require('deepmerge')

const System = Java.type('java.lang.System')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const YAMLFactory = Java.type(
  'com.fasterxml.jackson.dataformat.yaml.YAMLFactory'
)
const JsonSchemaFactory = Java.type('com.networknt.schema.JsonSchemaFactory')
const ObjectMapper = Java.type('com.fasterxml.jackson.databind.ObjectMapper')

const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const schemaPath = 'etc/schemas'

class DSUtils {
  // Deprecated
  static convertToJson (yamlStr) {
    const yamlReader = new ObjectMapper(new YAMLFactory())
    const mapper = new ObjectMapper()
    const obj = yamlReader.readValue(
      yamlStr,
      Java.type('java.lang.Object').class
    )
    return JSON.parse(mapper.writeValueAsString(obj))
  }

  static toJsonStr (yamlStr) {
    const yamlReader = new ObjectMapper(new YAMLFactory())
    const mapper = new ObjectMapper()
    const obj = yamlReader.readValue(
      yamlStr,
      Java.type('java.lang.Object').class
    )
    return mapper.writeValueAsString(obj)
  }

  static roMessage (path) {
    return `$[0].${path}: is a readonly field, it cannot be changed`
  }

  static validateObj (schemaPath, jsonObj) {
    const factory = JsonSchemaFactory.getInstance()
    const mapper = new ObjectMapper()
    const schema = factory.getSchema(FilesUtil.readFile(schemaPath))
    const node = mapper.readTree(JSON.stringify(jsonObj))
    const errors = schema.validate(node)
    const e = []
    if (errors.size() > 0) {
      const i = errors.iterator()
      while (i.hasNext()) {
        const error = i.next()
        e.push(error.getMessage())
      }
    }
    return e
  }

  static validateEntity (obj, newObj, mode) {
    let kind
    try {
      kind = DSUtils.getKind(obj)
    } catch (e) {
      const errors = []
      errors.push(e)
      return errors
    }

    // The validator expects an array
    let o = obj
    if (!Array.isArray(o)) {
      o = []
      o.push(obj)
    }

    const e = DSUtils.validateObj(
      `${schemaPath}/${kind.toLowerCase()}s_schema.json`,
      o
    )

    if (mode === 'write') {
      const roErrors = DSUtils.validateRO(obj, newObj)
      roErrors.forEach(error => e.push(error))
    }

    //if (e.length > 0) LOG.error(e.join())

    return e
  }

  /**
   * PUT operations must use mode = 'readOnly' to fail when attempting overwrite
   */
  static validateRO (oldObj, newObj) {
    const pathsToFields = DSUtils.getPathsFor(
      oldObj.kind.toLowerCase(),
      'readOnly'
    )

    const eqArray = (a1, a2) =>
      Array.isArray(a1) && a1.filter(v => a2.includes(v)).length === a1.length
    const noEq = (a1, a2) => !Array.isArray(a1) && a1 !== a2

    return pathsToFields
      .map(path => {
        const oldValue = DSUtils.resolve(path, oldObj)
        const newValue = DSUtils.resolve(path, newObj)
        if (!eqArray(oldValue, newValue) && noEq(oldValue, newValue)) {
          return DSUtils.roMessage(path)
        }
      })
      .filter(path => (path ? true : false))
  }

  static removeWO (obj) {
    const pathsToFields = DSUtils.getPathsFor(
      obj.kind.toLowerCase(),
      'writeOnly'
    )
    const flatObj = flat(obj)
    pathsToFields.forEach(path => delete flatObj[path])
    return unflatten(flatObj)
  }

  static patchObj (oldObj, newObj) {
    const pathsToFields = DSUtils.getPathsFor(
      oldObj.kind.toLowerCase(),
      'writeOnly'
    )
    const flatNewObj = flat(newObj)
    const flatOldObj = flat(oldObj)
    pathsToFields.forEach(path => {
      if (!flatNewObj[path] && flatOldObj[path]) {
        flatNewObj[path] = flatOldObj[path]
      }
    })
    return unflatten(flatNewObj)
  }

  static getPathsFor (kind, mode) {
    const jStr = FilesUtil.readFile(
      `${schemaPath}/${kind.toLowerCase()}s_schema.json`
    )
    return Object.keys(flat(JSON.parse(jStr)))
      .filter(
        path =>
          path.endsWith(mode) &&
          DSUtils.resolve(path, JSON.parse(jStr)) === true
      )
      .map(path => path.replace(/.items|properties.|items.properties./g, ''))
      .map(path => path.replace(`.${mode}`, ''))
  }

  static getKind (obj) {
    if (
      !obj.kind ||
      ['user', 'agent', 'peer', 'domain', 'gateway', 'number'].indexOf(
        obj.kind.toLowerCase()
      ) === -1
    ) {
      throw 'Not a valid entity. `kind` must be: User, Agent, Peer, Domain, Gateway, Number'
    }
    return obj.kind
  }

  static deepSearch (response, path, value) {
    let data
    response.data.forEach(obj => {
      if (value && DSUtils.resolve(path, obj) === value.toString()) {
        data = obj
      }
    })
    return isEmpty(data)
      ? CoreUtils.buildResponse(Status.NOT_FOUND)
      : CoreUtils.buildResponse(Status.OK, null, data)
  }

  static objExist (response) {
    const status = response.status
    return status === Status.OK || status === Status.CREATED
  }

  static transformFilter (filter = '*') {
    return !isEmpty(filter) && filter !== '*' ? `*.[?(${filter})]` : filter
  }

  static resolve (path, obj) {
    return path.split('.').reduce(function (prev, curr) {
      return prev ? prev[curr] : null
    }, obj || self)
  }

  static getParameters (config, defaultParameters, allowedKeys) {
    const params = config.spec.dataSource.parameters || ''
    const envParams = System.getenv('DATA_SOURCE_PARAMETERS') || ''
    const p1 = DSUtils.getParametersFromString(envParams, allowedKeys)
    const p2 = DSUtils.getParametersFromString(params, allowedKeys)
    const p3 = DSUtils.getParametersFromString(defaultParameters, allowedKeys)
    return merge.all([p3, p2, p1])
  }

  // TODO: Please rename this!
  static getParametersFromString (params, allowedKeys) {
    if (params.length === 0) return {}
    const parameters = {}
    params.split(',').forEach(par => {
      try {
        const key = par.split('=')[0]
        const value = par.split('=')[1]
        if (allowedKeys.indexOf(key) === -1) {
          throw `Invalid parameter: ${key}`
        } else {
          parameters[key] = value
        }
      } catch (e) {
        throw `Invalid parameters string: ${params}. Should be something like 'host=localhost,port=6379'`
      }
    })
    return parameters
  }

  static paginate (items, page, itemsPerPage) {
    const pagination = paginateArray(items, page, itemsPerPage)

    return {
      status: Status.OK,
      message: Status.message[Status.OK].value,
      meta: {
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        itemsPerPage: pagination.perPage,
        totalItems: pagination.total
      },
      data: pagination.data
    }
  }
}

module.exports = DSUtils
