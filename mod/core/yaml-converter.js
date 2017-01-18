var YAMLFactory  = Java.type('com.fasterxml.jackson.dataformat.yaml.YAMLFactory')
var ObjectMapper = Java.type('com.fasterxml.jackson.databind.ObjectMapper')
var Files        = Java.type('java.nio.file.Files')
var Paths        = Java.type('java.nio.file.Paths')

function readFile (path) {
    var lines = Files.readAllLines(Paths.get(path), Java.type('java.nio.charset.StandardCharsets').UTF_8)
    var data = []
    lines.forEach(function(line) { data.push(line) })
    return data.join("\n")
}

function YamlToJsonConverter() {
    this.getJson = function(yamlFile) {
        let yaml = readFile(yamlFile)
        let yamlReader = new ObjectMapper(new YAMLFactory())
        let obj = yamlReader.readValue(yaml, Java.type('java.lang.Object').class)

        let jsonWriter = new ObjectMapper()
        return JSON.parse(jsonWriter.writeValueAsString(obj))
    }
}
