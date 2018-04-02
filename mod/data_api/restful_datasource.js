/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import getConfig from 'core/config_util'
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

const Unirest = Packages.com.mashape.unirest.http.Unirest
const InvalidPathException = Packages.com.jayway.jsonpath.InvalidPathException
const System = Packages.java.lang.System
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const badRequest = { status: Status.BAD_REQUEST, message: Status.message[Status.BAD_REQUEST].value }
const defaultRestfulParams = {
    baseUrl: 'http://localhost/v1/ctl',
    username: 'admin',
    secret: 'changeit'
}

export default class RestfulDataSource {

    constructor(config = getConfig()) {
        let parameters

        if (System.getenv("SIPIO_DS_PARAMETERS") != null) {
            parameters = this.getParams(System.getenv("SIPIO_DS_PARAMETERS"))
        }

        if (!parameters && !config.spec.dataSource.parameters) {
            parameters = defaultRestfulParams
        }

        if (!parameters.baseUrl || !parameters.username || !parameters.secret) {
            LOG.error("Restful Data Source incorrectly configured.\nYou must specify the baseUrl, username and secret when using this data provider")
            exit(1)
        }

        this.baseUrl = parameters.baseUrl
        this.username =  parameters.username
        this.secret = parameters.secret
    }

    getParams(params) {
        const parameters = {}
        params.forEach(par => {
            const key = par.split("=")[0]
            const value =  par.split("=")[1]
            switch (key) {
                case "baseUrl":
                    parameters.baseUrl = value
                    break
                case "username":
                    username = value
                    break
                case "secret":
                    secret = value
                    break
                default:
                    LOG.warn('Invalid parameter: ' + key)
            }
        })
        return parameters
    }

    withCollection(collection) {
        this.collection = collection;
        return this;
    }

    save(obj, method, ref = '') {
        try {
            if (!DSUtil.isValidEntity(obj)) {
                return badRequest
            }

            const path = '/' + obj.kind.toString().toLowerCase() + 's' + ref
            const r = method(this.baseUrl + path)
                .header("Content-Type", "application/json")
                    .basicAuth(this.username, this.secret)
                        .body(JSON.stringify(obj)).asString()

            return JSON.parse(r.getBody())
        } catch(e) {
            return buildErrResponse(e)
        }
    }

    insert(obj) {
        save(obj, Unirest.post)
    }

    get(ref) {
        try {
            const r = Unirest.get(this.baseUrl + '/' + this.collection +  '/' + ref)
            .basicAuth(this.username, this.secret).asString()
            return JSON.parse(r.getBody())
        } catch(e) {
            return buildErrorResponse(e)
        }
    }

    find(filter = "*") {
        try {
            const encodeFilter = java.net.URLEncoder.encode(filter)

            const r = Unirest.get(this.baseUrl + '/' + this.collection +  '/' + this.collection + '?filter=' + encodeFilter)
                .basicAuth(this.username, this.secret).asString()

            const response = JSON.parse(r.getBody())

            if (response.status && response.status != 200) {
                return DSUtil.buildResponse(response.status, [])
            }

            return response
        } catch(e) {
            return DSUtil.buildErrResponse(e)
        }
    }

    update(obj) {
        save(obj, Unirest.put, '/' + obj.metadata.ref)
    }

    remove(ref) {
        try {
            const r = Unirest.delete(this.baseUrl + '/'
                + this.collection + '/' + ref)
                    .basicAuth(this.username, this.secret).asString()
            return JSON.parse(r.getBody())
        } catch(e) {
            return DSUtil.buildErrResponse(e)
        }
    }
}