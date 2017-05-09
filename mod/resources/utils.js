/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/status.js')

function ResourcesUtil() {
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const YAMLFactory = Packages.com.fasterxml.jackson.dataformat.yaml.YAMLFactory
    const JsonSchemaFactory = Packages.com.networknt.schema.JsonSchemaFactory
    const JsonPath = com.jayway.jsonpath.JsonPath
    const Option = Packages.com.jayway.jsonpath.Option
    const ObjectMapper = Packages.com.fasterxml.jackson.databind.ObjectMapper
    const factory = new JsonSchemaFactory()

    const conf = Packages.com.jayway.jsonpath.Configuration.defaultConfiguration()
    conf.addOptions(Option.ALWAYS_RETURN_LIST)

    function readFile (path) {
        const Files = Packages.java.nio.file.Files
        const Paths = Packages.java.nio.file.Paths
        const lines = Files.readAllLines(Paths.get(path), Packages.java.nio.charset.StandardCharsets.UTF_8)
        const data = []
        lines.forEach(line => { data.push(line) })
        return data.join('\n')
    }

    function getJsonString(yamlFile) {
        const yaml = readFile(yamlFile)
        const yamlReader = new ObjectMapper(new YAMLFactory())
        const obj = yamlReader.readValue(yaml, java.lang.Object.class)
        const jsonWriter = new ObjectMapper()
        return jsonWriter.writeValueAsString(obj)
    }

    function isJson(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    this.isResourceValid = (schemaPath, nodePath) => {
        const schema = factory.getSchema(readFile(schemaPath))
        const mapper = new ObjectMapper()
        const node = mapper.readTree(getJsonString(nodePath))

        const errors = schema.validate(node);

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

    this.getJson = yamlFile => JSON.parse(getJsonString(yamlFile))

    this.getObjs = (resourcePath, f) => {
        if (f == null || f == undefined || f == '') {
            filter = '*'
        } else {
            filter = "*.[?(@." + f + ")]"
        }

        const resource = getJsonString(resourcePath)
        let list

        try {
            // Convert this from net.minidev.json.JSONArray
            // to Javascript Object
            list = JSON.parse(JsonPath.parse(resource).read(filter).toJSONString())
        } catch(e) {
            LOG.warn(e.getMessage())

            return {
                status: Status.BAD_REQUEST,
                message: e.getMessage(),
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            obj: list
        }
    }
}
