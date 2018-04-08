/**
 * @author Pedro Sanders
 * @since v1
 */
import CoreUtils from 'core/utils'
import FilesUtil from 'utils/files_util'
import { Status } from 'core/status'
import isEmpty from 'utils/obj_util'

const System = Packages.java.lang.System
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const YAMLFactory = Packages.com.fasterxml.jackson.dataformat.yaml.YAMLFactory
const JsonSchemaFactory = Packages.com.networknt.schema.JsonSchemaFactory
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
            kind = DSUtil.getKind(obj)
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

    static isValidJson(str) {
        try {
            JSON.parse(str)
        } catch (e) {
            return false
        }
        return true
    }

    static getKind(obj) {
        if(['user', 'agent', 'peer', 'domain', 'gateway', 'did']
            .indexOf(obj.kind.toLowerCase()) == -1) {
            throw "Not a valid entity. `kind` must be: User, Agent, Peer, Domain, Gateway, DID"
        }
        return obj.kind
    }

    static deepSearch(objects, path, value) {
        let result
        objects.forEach(obj => {
            if (DSUtil.resolve(path, obj) == value) {
                result = obj
            }
        })
        return isEmpty(result)? CoreUtils.buildResponse(Status.NOT_FOUND) : CoreUtils.buildResponse(Status.OK, result)
    }

    static objExist(response) {
       return response.status == Status.OK? true: false
    }

    static transformFilter(filter = '*') {
        return !isEmpty(filter) && !filter.equals('*')? "*.[?(" + filter + ")]" : filter
    }

    static resolve(path, obj) {
        return path.split('.').reduce(
          function(prev, curr) {
            return prev ? prev[curr] : null
          }, obj || self
        )
    }

    static getParameters(config, getFromEnv, defaultParameters) {
        let parameters = isEmpty(config.spec.dataSource.parameters) == false?
          config.spec.dataSource.parameters: defaultParameters

        if (System.getenv("SIPIO_DS_PARAMETERS") != null) {
          parameters = getFromEnv(System.getenv("SIPIO_DS_PARAMETERS"))
        }

        return parameters
    }
}
