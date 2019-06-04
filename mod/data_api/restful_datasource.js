/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtil = require('@routr/data_api/utils')
const getConfig = require('@routr/core/config_util')
const { Status } = require('@routr/core/status')

const System = Java.type('java.lang.System')
const URLEncoder = Java.type('java.net.URLEncoder')
const Unirest = Java.type('com.mashape.unirest.http.Unirest')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')

const LOG = LogManager.getLogger()
const badRequest = { status: Status.BAD_REQUEST, message: Status.message[Status.BAD_REQUEST].value }
const defaultRestfulParams = { baseUrl: 'http://localhost:8080/v1/ctl', username: 'admin', secret: 'changeit' }

class RestfulDataSource {

    constructor(config = getConfig()) {
        const parameters = DSUtil.getParameters(config, defaultRestfulParams,
            ['baseUrl', 'username', 'secret'])

        if (!parameters.baseUrl || !parameters.username || !parameters.secret) {
            LOG.error("Restful Data Source incorrectly configured.\nYou must specify the baseUrl, username and secret when using this data provider")
            System.exit(1)
        }

        this.baseUrl = parameters.baseUrl
        this.username =  parameters.username
        this.secret = parameters.secret
    }

    withCollection(collection) {
        this.collection = collection
        return this
    }

    save(obj, method, ref = '') {
        try {
            if (obj != 'noobj' && DSUtil.isValidEntity(obj) == false) {
                return badRequest
            }

            const path = obj == 'noobj'? '/' + this.collection + ref
                : '/' + obj.kind.toString().toLowerCase() + 's' + ref
            const r = method(this.baseUrl + path)
                .header("Content-Type", "application/json")
                    .basicAuth(this.username, this.secret)
                        .body(JSON.stringify(obj)).asString()
            return JSON.parse(r.getBody())
        } catch(e) {
            return CoreUtils.buildErrResponse(e)
        }
    }

    insert(obj) {
        return this.save(obj, Unirest.post)
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
            const r = Unirest.get(this.baseUrl + '/'
              + this.collection
              + '?filter='
              + URLEncoder.encode(filter)).basicAuth(this.username, this.secret).asString()

            const response = JSON.parse(r.getBody())

            return response.status != Status.OK? CoreUtils.buildResponse(response.status, []): response
        } catch(e) {
            return CoreUtils.buildErrResponse(e)
        }
    }

    update(obj) {
        return this.save(obj, Unirest.put, '/' + obj.metadata.ref)
    }

    remove(ref) {
        return this.save('noobj', Unirest.delete, '/' + ref)
    }
}

module.exports = RestfulDataSource
