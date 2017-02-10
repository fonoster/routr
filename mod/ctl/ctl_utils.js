var Unirest = Java.type("com.mashape.unirest.http.Unirest")

load('mod/utils/yaml_converter.js')

function getWithAuth(resource) {
    var credentials = new YamlToJsonConverter().getJson('config/config.yml').rest
    var baseUrl = "http://localhost:4567"
    let r = Unirest.get(baseUrl + "/" + resource).basicAuth(credentials.username, credentials.password).asJson()
    return JSON.parse(r.getBody())
}