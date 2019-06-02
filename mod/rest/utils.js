/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtil = require('@routr/data_api/utils')
const isEmpty = require('@routr/utils/obj_util')

const MultipartConfigElement = Packages.javax.servlet.MultipartConfigElement
const IOUtils = Packages.org.apache.commons.io.IOUtils
const StandardCharsets = Packages.java.nio.charset.StandardCharsets

class RestUtil {

    static createFromFile(req, api) {
        if (!isEmpty(req.contentType()) && req.contentType().indexOf('multipart/form-data') !== -1) {
            req.attribute('org.eclipse.jetty.multipartConfig', new MultipartConfigElement('/temp'))
            const is = req.raw().getPart('file').getInputStream()
            const fileContent = IOUtils.toString(is, StandardCharsets.UTF_8.name());
            const jsonObjs = DSUtil.convertToJson(fileContent)
            let compoundResponse = ''
            jsonObjs.forEach(jsonObj => {
                const response = api.createFromJSON(jsonObj)
                compoundResponse = compoundResponse + '\n' + response.message
            })
            return compoundResponse
        } else {
            const jsonObj = JSON.parse(req.body())
            const response = api.createFromJSON(jsonObj)
            return JSON.stringify(response)
        }
    }
}

module.exports = RestUtil
