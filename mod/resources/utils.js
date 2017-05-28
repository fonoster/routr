/**
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'resources/status'
import isEmpty from 'utils/obj_util'

let LogManager = Packages.org.apache.logging.log4j.LogManager
let LOG  = LogManager.getLogger()
let YAMLFactory = Packages.com.fasterxml.jackson.dataformat.yaml.YAMLFactory
let JsonSchemaFactory = Packages.com.networknt.schema.JsonSchemaFactory
let JsonPath = Packages.com.jayway.jsonpath.JsonPath
let Option = Packages.com.jayway.jsonpath.Option
let ObjectMapper = Packages.com.fasterxml.jackson.databind.ObjectMapper

export default class ResourcesUtil {

    constructor () {
        this.factory = new JsonSchemaFactory()
        this.yamlReader = new ObjectMapper(new YAMLFactory())
        this.mapper = new ObjectMapper()
    }

    readFile (path) {
        const Files = Packages.java.nio.file.Files
        const Paths = Packages.java.nio.file.Paths
        const lines = Files.readAllLines(Paths.get(path), Packages.java.nio.charset.StandardCharsets.UTF_8)
        const data = []
        lines.forEach(line => { data.push(line) })
        return data.join('\n')
    }

    getJsonString(yamlFile) {
        const yaml = this.readFile(yamlFile)
        const obj = this.yamlReader.readValue(yaml, java.lang.Object.class)
        return this.mapper.writeValueAsString(obj)
    }

    isJson(str) {
        try {
            JSON.parse(str)
        } catch (e) {
            return false
        }
        return true
    }

    getJson (yamlFile) {
        return JSON.parse(this.getJsonString(yamlFile))
    }

    isResourceValid (schemaPath, nodePath) {
        const schema = this.factory.getSchema(this.readFile(schemaPath))
        const node = this.mapper.readTree(this.getJsonString(nodePath))
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

    getObjs (resourcePath, f) {
        let filter = '*'

        if (!isEmpty(f) && f != '*') {
            filter = "*.[?(" + f + ")]"
        }

        const resource = this.getJsonString(resourcePath)
        let list

        try {
            // Convert this from net.minidev.json.JSONArray
            // to Javascript Object
            list = JSON.parse(JsonPath.parse(resource).read(filter).toJSONString())

            if (list.length == 0) {
                return {
                    status: Status.NOT_FOUND,
                    message: Status.message[Status.NOT_FOUND].value
                }
            }
        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: e.getMessage()
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            obj: list
        }
    }
}
