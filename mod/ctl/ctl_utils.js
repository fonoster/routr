/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'

const Unirest = Packages.com.mashape.unirest.http.Unirest
const InetAddress = Packages.java.net.InetAddress

export default class CtlUtils {

    constructor() {
        const host = InetAddress.getLocalHost().getHostAddress()
        this.restConfig = new ResourcesUtil().getJson('config/config.yml').rest
        this.baseUrl = 'http://' + host + ':' + this.restConfig.port
    }

    getWithAuth(resource) {
        const result = Unirest.get(this.baseUrl + '/' + resource).basicAuth(this.restConfig.username, this.restConfig.secret).asJson()
        return JSON.parse(result.getBody())
    }

    postWithAuth(cmd, data) {
        let result

        if (data) {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.restConfig.username, this.restConfig.secret)
            .body(JSON.stringify(data))
            .asJson()
        } else {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.restConfig.username, this.restConfig.secret).asJson()
        }

        return JSON.parse(result.getBody())
    }

    postWithAuth(cmd, data) {
        let result

        if (data) {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.restConfig.username, this.restConfig.secret)
            .body(JSON.stringify(data))
            .asJson()
        } else {
            result = Unirest.post(this.baseUrl + '/' + cmd).basicAuth(this.restConfig.username, this.restConfig.secret).asJson()
        }

        return JSON.parse(result.getBody())
    }

    putWithAuth(cmd, data) {
        let result

        if (data) {
            result = Unirest.put(this.baseUrl + '/' + cmd).basicAuth(this.restConfig.username, this.restConfig.secret)
            .body(JSON.stringify(data))
            .asJson()
        } else {
            result = Unirest.put(this.baseUrl + '/' + cmd).basicAuth(this.restConfig.username, this.restConfig.secret).asJson()
        }

        return JSON.parse(result.getBody())
    }

    deleteWithAuth(cmd) {
        const result = Unirest.delete(this.baseUrl + '/' + cmd).basicAuth(this.restConfig.username, this.restConfig.secret).asJson()
        return JSON.parse(result.getBody())
    }
}

