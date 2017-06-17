/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import getConfig from 'core/config_util.js'

const Unirest = Packages.com.mashape.unirest.http.Unirest
const InetAddress = Packages.java.net.InetAddress

export default class CtlUtils {

    constructor() {
        const config = getConfig()
        const rest = config.spec.services.rest
        this.credentials = rest.credentials
        this.baseUrl = 'http://' + rest.bindAddr + ':' + rest.port
    }

    getWithAuth(resource) {
        const result = Unirest.get(this.baseUrl + '/' + resource).basicAuth(this.credentials.username, this.credentials.secret).asJson()
        return JSON.parse(result.getBody())
    }

    postWithAuth(cmd, data) {
        let result

        if (data) {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.credentials.username, this.credentials.secret)
            .body(JSON.stringify(data))
            .asJson()
        } else {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.credentials.username, this.credentials.secret).asJson()
        }

        return JSON.parse(result.getBody())
    }

    postWithAuth(cmd, data) {
        let result

        if (data) {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.credentials.username, this.credentials.secret)
            .body(JSON.stringify(data))
            .asJson()
        } else {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.credentials.username, this.credentials.secret).asJson()
        }

        return JSON.parse(result.getBody())
    }

    putWithAuth(cmd, data) {
        let result

        if (data) {
            result = Unirest.put(this.baseUrl + '/' + cmd).basicAuth(this.credentials.username, this.credentials.secret)
            .body(JSON.stringify(data))
            .asJson()
        } else {
            result = Unirest.put(this.baseUrl + '/' + cmd).basicAuth(this.credentials.username, this.credentials.secret).asJson()
        }

        return JSON.parse(result.getBody())
    }

    deleteWithAuth(cmd) {
        const result = Unirest.delete(this.baseUrl + '/' + cmd).basicAuth(this.credentials.username, this.credentials.secret).asJson()
        return JSON.parse(result.getBody())
    }
}

