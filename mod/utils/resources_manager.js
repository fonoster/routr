/**
 * @author Pedro Sanders
 * @since v1
 */
function ResourcesPipeline() {
    const YAMLFactory = Packages.com.fasterxml.jackson.dataformat.yaml.YAMLFactory
    const JsonSchemaFactory = Packages.com.networknt.schema.JsonSchemaFactory
    const ObjectMapper = Packages.com.fasterxml.jackson.databind.ObjectMapper
    const factory = new JsonSchemaFactory()

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

    this.getJson = yamlFile => { return JSON.parse(getJsonString(yamlFile)) }

    this.validate = (schemaPath, nodePath) => {
        const schema = factory.getSchema(readFile(schemaPath))
        const mapper = new ObjectMapper()
        const node = mapper.readTree(getJsonString(nodePath))
        return schema.validate(node);
    }
}
