/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const CoreUtils = require('@routr/core/utils')
const { Status } = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')

const MultipartConfigElement = Java.type('javax.servlet.MultipartConfigElement')
const IOUtils = Java.type('org.apache.commons.io.IOUtils')
const StandardCharsets = Java.type('java.nio.charset.StandardCharsets')

class RestUtil {
  static createFromFile (req, api) {
    if (
      !isEmpty(req.contentType()) &&
      req.contentType().indexOf('multipart/form-data') !== -1
    ) {
      req.attribute(
        'org.eclipse.jetty.multipartConfig',
        new MultipartConfigElement('/temp')
      )
      const is = req
        .raw()
        .getPart('file')
        .getInputStream()
      const fileContent = IOUtils.toString(is, StandardCharsets.UTF_8.name())
      const jsonObjs = DSUtils.convertToJson(fileContent)
      let compoundResponse = ''
      let atLeastOneError = false
      try {
        jsonObjs.forEach(jsonObj => {
          const response = api.createFromJSON(jsonObj)
          compoundResponse = `${compoundResponse}\n${response.message}`
          if (response.status !== Status.CREATED) atLeastOneError = true
        })
      } catch (e) {
        if (e instanceof SyntaxError) {
          return CoreUtils.buildResponse(
            Status.BAD_REQUEST,
            null,
            'SyntaxError: Invalid JSON'
          )
        }
        return CoreUtils.buildResponse(Status.BAD_REQUEST, e.toString())
      }
      return atLeastOneError
        ? CoreUtils.buildResponse(
            Status.BAD_REQUEST,
            null,
            'Bad configuration in at least one resource'
          )
        : CoreUtils.buildResponse(Status.OK, 'done')
    } else {
      try {
        const jsonObj = JSON.parse(req.body())
        return api.createFromJSON(jsonObj)
      } catch (e) {
        if (e instanceof SyntaxError) {
          return CoreUtils.buildResponse(
            Status.BAD_REQUEST,
            null,
            'SyntaxError: Invalid JSON'
          )
        }
        return CoreUtils.buildResponse(Status.BAD_REQUEST, e.toString())
      }
    }
  }
}

module.exports = RestUtil
