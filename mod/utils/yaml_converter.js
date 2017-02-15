/**
 * @author Pedro Sanders
 * @since v1
 */
function YamlToJsonConverter() {
    const YAMLFactory = Packages.com.fasterxml.jackson.dataformat.yaml.YAMLFactory
    const ObjectMapper = Packages.com.fasterxml.jackson.databind.ObjectMapper

    function readFile (path) {
        const Files = Packages.java.nio.file.Files
        const Paths = Packages.java.nio.file.Paths
        const lines = Files.readAllLines(Paths.get(path), Packages.java.nio.charset.StandardCharsets.UTF_8)
        const data = []
        lines.forEach(line => { data.push(line) })
        return data.join('\n')
    }

    this.getJson = yamlFile => {
        const yaml = readFile(yamlFile)
        const yamlReader = new ObjectMapper(new YAMLFactory())
        const obj = yamlReader.readValue(yaml, java.lang.Object.class)
        const jsonWriter = new ObjectMapper()
        return JSON.parse(jsonWriter.writeValueAsString(obj))
    }
}
