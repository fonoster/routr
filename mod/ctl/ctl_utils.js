/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/yaml_converter.js')

function getWithAuth(resource) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const credentials = new YamlToJsonConverter().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:4567'
    const r = Unirest.get(baseUrl + '/' + resource).basicAuth(credentials.username, credentials.password).asJson()
    return JSON.parse(r.getBody())
}

function postWithAuth(cmd) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const credentials = new YamlToJsonConverter().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:4567'
    const r = Unirest.post(baseUrl + '/' + cmd).basicAuth(credentials.username, credentials.password).asJson()
    return JSON.parse(r.getBody())
}
