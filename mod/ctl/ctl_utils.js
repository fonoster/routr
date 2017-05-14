/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')

function getWithAuth(resource) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const rest = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:' + rest.port
    const result = Unirest.get(baseUrl + '/' + resource).basicAuth(rest.username, rest.secret).asJson()
    return JSON.parse(result.getBody())
}

function postWithAuth(cmd, data) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const rest = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:' + rest.port
    let result

    if (data) {
        result = Unirest.post(baseUrl + '/' + cmd).basicAuth(rest.username, rest.secret)
        .body(JSON.stringify(data))
        .asJson()
    } else {
        result = Unirest.post(baseUrl + '/' + cmd).basicAuth(rest.username, rest.secret).asJson()
    }

    return JSON.parse(result.getBody())
}

function putWithAuth(cmd, data) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const rest = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:' + rest.port
    let result

    if (data) {
        result = Unirest.put(baseUrl + '/' + cmd).basicAuth(rest.username, rest.secret)
        .body(JSON.stringify(data))
        .asJson()
    } else {
        result = Unirest.put(baseUrl + '/' + cmd).basicAuth(rest.username, rest.secret).asJson()
    }

    return JSON.parse(result.getBody())
}


function deleteWithAuth(cmd) {
    const Unirest = Packages.com.mashape.unirest.http.Unirest
    const rest = new ResourcesUtil().getJson('config/config.yml').rest
    const baseUrl = 'http://localhost:' + rest.port
    const result = Unirest.delete(baseUrl + '/' + cmd).basicAuth(rest.username, rest.secret).asJson()
    return JSON.parse(result.getBody())
}