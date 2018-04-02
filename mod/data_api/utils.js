/**
 * @author Pedro Sanders
 * @since v1
 */
import FilesUtil from 'utils/files_util'
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const YAMLFactory = Packages.com.fasterxml.jackson.dataformat.yaml.YAMLFactory
const JsonSchemaFactory = Packages.com.networknt.schema.JsonSchemaFactory
const JsonPath = Packages.com.jayway.jsonpath.JsonPath
const Option = Packages.com.jayway.jsonpath.Option
const ObjectMapper = Packages.com.fasterxml.jackson.databind.ObjectMapper
const schemaPath = 'etc/schemas'

export default class DSUtil {

    static convertToJson(yamlStr) {
        const yamlReader = new ObjectMapper(new YAMLFactory())
        const mapper = new ObjectMapper()
        const obj = yamlReader.readValue(yamlStr, java.lang.Object.class)
        return JSON.parse(mapper.writeValueAsString(obj))
    }

    static isValidEntity(obj) {
        let kind
        try {
            kind = this.getKind(obj)
        } catch(e) {
            return false
        }

        const factory = new JsonSchemaFactory()
        const mapper = new ObjectMapper()

        // The validator expects an array
        if (!Array.isArray(obj)) {
            const o = []
            o.push(obj)
            obj = o
        }

        const schema = factory.getSchema(FilesUtil.readFile(schemaPath + '/' + kind.toLowerCase() + 's_schema.json'))
        const node = mapper.readTree(JSON.stringify(obj))
        const errors = schema.validate(node)

        if (errors.size() > 0) {
            const i = errors.iterator()
            LOG.warn('We found some errors in your resource ' + node)
            while(i.hasNext()) {
               LOG.warn(i.next())
            }
            return false
        }

        return true
    }

    static isValidDataSource(schemaPath, yamlStr) {
        const factory = new JsonSchemaFactory()
        const mapper = new ObjectMapper()

        const schema = factory.getSchema(FilesUtil.readFile(schemaPath))
        const node = mapper.readTree(JSON.stringify(this.convertToJson(yamlStr)))
        const errors = schema.validate(node)

        if (errors.size() > 0) {
            const i = errors.iterator()
            LOG.warn('We found some errors in your resource ' + node)
            while(i.hasNext()) {
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
        if (!obj.kind || (
            obj.kind.toLowerCase() != 'user' &&
            obj.kind.toLowerCase() != 'agent' &&
            obj.kind.toLowerCase() != 'peer' &&
            obj.kind.toLowerCase() != 'domain' &&
            obj.kind.toLowerCase() != 'gateway' &&
            obj.kind.toLowerCase() != 'did')) {
            throw "Not a valid entity. `kind` must be: User, Agent, Peer, Domain, Gateway, DID"
        }

        return obj.kind
    }

    static buildErrResponse(e) {
        LOG.error(e.getMessage())

        return {
            status: Status.INTERNAL_SERVER_ERROR,
            message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
            result: e.getMessage()
        }
    }

    static buildResponse(status, result) {
        if (status == Status.BAD_RESPONSE) {
            LOG.warn(e.getMessage())
        }

        const response = {
            status: status,
            message: Status.message[status].value
        }

        if (result) {
            response.result = result
        }

        return response
    }

    static deepSearch(objects, path, value) {
        let result
        objects.forEach(obj => {
            if (resolve(path, obj) == value) {
                result = obj
            }
        })

        if (isEmpty(result)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }

        return DSUtil.buildResponse(Status.OK, result)
    }
}

function resolve(path, obj) {
    return path.split('.').reduce(function(prev, curr) {
        return prev ? prev[curr] : null
    }, obj || self)
}
