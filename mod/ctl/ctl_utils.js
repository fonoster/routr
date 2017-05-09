/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')

function getWithAuth(resource) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const credentials = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:4567'
    const r = Unirest.get(baseUrl + '/' + resource).basicAuth(credentials.username, credentials.secret).asJson()
    return JSON.parse(r.getBody())
}

function postWithAuth(cmd) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const credentials = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:4567'
    const r = Unirest.post(baseUrl + '/' + cmd).basicAuth(credentials.username, credentials.secret).asJson()
    return JSON.parse(r.getBody())
}
