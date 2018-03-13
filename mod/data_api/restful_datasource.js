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

export default class RestfulDataSource {

    constructor(dataSource, config = getConfig()) {

        if (System.getenv("SIPIO_DS_PARAMETERS") != null) {
            config.spec.dataSource.parameters = {}
            const parameters = System.getenv("SIPIO_DS_PARAMETERS").split(",")
            parameters.forEach(par => {
                const key = par.split("=")[0]
                const value =  par.split("=")[1]
                switch (key) {
                    case "baseUrl":
                        config.spec.dataSource.parameters.baseUrl = value
                        break
                    case "username":
                        config.spec.dataSource.parameters.username = value
                        break
                    case "secret":
                        config.spec.dataSource.parameters.secret = value
                        break
                    default:
                        LOG.warn('Invalid parameter: ' + key)
                }
            })
        }

        if (!config.spec.dataSource.parameters) {
            config.spec.dataSource.parameters = {}
            config.spec.dataSource.parameters.baseUrl = 'http://localhost/v1/ctl'
            config.spec.dataSource.parameters.username = 'admin'
            config.spec.dataSource.parameters.secret = 'changeit'
        }

        if (!config.spec.dataSource.parameters.baseUrl ||
            !config.spec.dataSource.parameters.username ||
            !config.spec.dataSource.parameters.secret) {
            LOG.error("Restful Data Source incorrectly configured.\nYou must specify the baseUrl, username and secret when using this data provider")
            exit(1)
        }

        this.baseUrl = config.spec.dataSource.parameters.baseUrl
        this.username =  config.spec.dataSource.parameters.username
        this.secret =  config.spec.dataSource.parameters.secret
    }

    withCollection(collection) {
        this.collection = collection;
        return this;
    }

    insert(obj) {
        try {
            if (!DSUtil.isValidEntity(obj)) {
                return {
                    status: Status.BAD_REQUEST,
                    message: Status.message[Status.BAD_REQUEST].value
                }
            }

            return this.postWithAuth(obj)
        } catch(e) {
            LOG.error(e.getMessage())

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    get(ref) {
        try {
            return this.getWithAuth('/' + this.collection +  '/' + ref)
        } catch(e) {
            LOG.error(e.getMessage())
            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    find(filter = "*") {
        try {
            const encodeFilter = java.net.URLEncoder.encode(filter)
            const response = this.getWithAuth('/' + this.collection + '?filter=' + encodeFilter)

            if (response.status && response.status != 200) {
                return {
                    status: response.status,
                    message: Status.message[response.status].value,
                    result: []
                }
            }

            return response
        } catch(e) {
            LOG.error(e.getMessage())
            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    update(obj) {
        try {
            if (!DSUtil.isValidEntity(obj)) {
                return {
                    status: Status.BAD_REQUEST,
                    message: Status.message[Status.BAD_REQUEST].value
                }
            }

            return this.putWithAuth(obj)
        } catch(e) {
            LOG.error(e.getMessage())

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    remove(ref) {
        try {
            return this.deleteWithAuth('/' + this.collection + '/' + ref)
        } catch(e) {
            LOG.error(e.getMessage())

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    // Helper functions

    getWithAuth(path) {
        const r = Unirest.get(this.baseUrl + path)
            .basicAuth(this.username, this.secret).asString()
        return JSON.parse(r.getBody())
    }

    postWithAuth(obj) {
        const path = '/' + obj.kind.toString().toLowerCase() + 's'
        const r = Unirest.post(this.baseUrl + path)
            .header("Content-Type", "application/json")
                .basicAuth(this.username, this.secret)
                    .body(JSON.stringify(obj)).asString()

        return JSON.parse(r.getBody())
    }

    putWithAuth(obj) {
        const path = '/' + obj.kind.toString().toLowerCase() + 's' + '/' + obj.metadata.ref
        const r = Unirest.put(this.baseUrl + path)
            .header("Content-Type", "application/json")
                .basicAuth(this.username, this.secret)
                    .body(JSON.stringify(obj)).asString()

        return JSON.parse(r.getBody())
    }

    deleteWithAuth(path) {
        const r = Unirest.delete(this.baseUrl + path)
           .basicAuth(this.username, this.secret).asString()
        return JSON.parse(r.getBody())
    }

}