/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')

function getWithAuth(resource) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const rest = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:' + rest.port
    const r = Unirest.get(baseUrl + '/' + resource).basicAuth(rest.username, rest.secret).asJson()
    return JSON.parse(r.getBody())
}

function postWithAuth(cmd) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const rest = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:' + rest.port
    const r = Unirest.post(baseUrl + '/' + cmd).basicAuth(rest.username, rest.secret).asJson()
    return JSON.parse(r.getBody())
}
