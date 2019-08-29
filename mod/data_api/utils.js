/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const FilesUtil = require('@routr/utils/files_util')
const {
    Status
} = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')

const System = Java.type('java.lang.System')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const YAMLFactory = Java.type('com.fasterxml.jackson.dataformat.yaml.YAMLFactory')
const JsonSchemaFactory = Java.type('com.networknt.schema.JsonSchemaFactory')
const ObjectMapper = Java.type('com.fasterxml.jackson.databind.ObjectMapper')

const LOG = LogManager.getLogger()
const schemaPath = 'etc/schemas'

class DSUtils {

    // Deprecated
    static convertToJson(yamlStr) {
        const yamlReader = new ObjectMapper(new YAMLFactory())
        const mapper = new ObjectMapper()
        const obj = yamlReader.readValue(yamlStr, Java.type('java.lang.Object').class)
        return JSON.parse(mapper.writeValueAsString(obj))
    }

    static toJsonStr(yamlStr) {
        const yamlReader = new ObjectMapper(new YAMLFactory())
        const mapper = new ObjectMapper()
        const obj = yamlReader.readValue(yamlStr, Java.type('java.lang.Object').class)
        return mapper.writeValueAsString(obj)
    }

    static isValidEntity(obj) {
        let kind
        try {
            kind = DSUtils.getKind(obj)
        } catch (e) {
            return false
        }

        const factory = JsonSchemaFactory.getInstance()
        const mapper = new ObjectMapper()

        // The validator expects an array
        if (!Array.isArray(obj)) {
            const o = []
            o.push(obj)
            obj = o
        }

        const schema = factory.getSchema(FilesUtil.readFile(`${schemaPath}/${kind.toLowerCase()}s_schema.json`))
        const node = mapper.readTree(JSON.stringify(obj))
        const errors = schema.validate(node)

        if (errors.size() > 0) {
            const i = errors.iterator()
            LOG.warn(`We found some errors in your resource ${node}`)
            while (i.hasNext()) {
                LOG.warn(i.next())
            }
            return false
        }
        return true
    }

    static isValidJson(str) {
        try {
            JSON.parse(str)
        } catch (e) {
            return false
        }
        return true
    }

    static getKind(obj) {
        if (['user', 'agent', 'peer', 'domain', 'gateway', 'number']
            .indexOf(obj.kind.toLowerCase()) === -1) {
            throw 'Not a valid entity. \`kind\` must be: User, Agent, Peer, Domain, Gateway, Number'
        }
        return obj.kind
    }

    static deepSearch(response, path, value) {
        let result
        response.result.forEach(obj => {
            if (value && DSUtils.resolve(path, obj) === value.toString()) {
                result = obj
            }
        })
        return isEmpty(result) ? CoreUtils.buildResponse(Status.NOT_FOUND) : CoreUtils.buildResponse(Status.OK, result)
    }

    static objExist(response) {
        const status = response.status
        return status === Status.OK || status === Status.CREATED
    }

    static transformFilter(filter = '*') {
        return !isEmpty(filter) && !filter.equals('*') ? `*.[?(${filter})]` : filter
    }

    static resolve(path, obj) {
        return path.split('.').reduce(
            function(prev, curr) {
                return prev ? prev[curr] : null
            }, obj || self
        )
    }

    static getParameters(config, defaultParameters, allowedKeys) {
        let parameters = isEmpty(config.spec.dataSource.parameters) === false ?
            config.spec.dataSource.parameters : defaultParameters

        if (System.getenv("ROUTR_DS_PARAMETERS") !== null) {
            parameters = DSUtils.getFromEnv(System.getenv("ROUTR_DS_PARAMETERS"), allowedKeys)
        }

        return parameters
    }

    static getFromEnv(params, allowedKeys) {
        const parameters = {}
        params.split(',').forEach(par => {
            const key = par.split('=')[0]
            const value = par.split('=')[1]
            allowedKeys.indexOf(key) === -1 ? LOG.warn(`Invalid parameter: ${key}`) : parameters[key] = value
        })
        return parameters
    }
}

module.exports = DSUtils
