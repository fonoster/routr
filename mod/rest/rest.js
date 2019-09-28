/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const UsersAPI = require('@routr/data_api/users_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const PeersAPI = require('@routr/data_api/peers_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DSSelector = require('@routr/data_api/ds_selector')
const config = require('@routr/core/config_util')()
const {
    reloadConfig
} = require('@routr/core/config_util')
const {
    Status
} = require('@routr/core/status')
const getJWTToken = require('@routr/rest/jwt_token_generator')
const resourcesService = require('@routr/rest/resources_service')
const locationService = require('@routr/rest/location_service')
const parameterAuthFilter = require('@routr/rest/parameter_auth_filter')
const basicAuthFilter = require('@routr/rest/basic_auth_filter')
const moment = require('moment')

const NHTClient = Java.type('io.routr.nht.NHTClient')
const Spark = Java.type('spark.Spark')
const options = Java.type('spark.Spark').options
const get = Java.type('spark.Spark').get
const post = Java.type('spark.Spark').post
const before = Java.type('spark.Spark').before
const path = Java.type('spark.Spark').path

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class Rest {

    constructor(server) {
        this.locator = null
        this.server = server
        this.nht = new NHTClient('vm://routr')

        LOG.info(`Starting Restful service (port: ${config.spec.restService.port}, apiPath: ${config.system.apiPath})`)

        Spark.ipAddress(config.spec.restService.bindAddr)
        Spark.threadPool(config.spec.restService.maxThreads,
            config.spec.restService.minThreads,
                config.spec.restService.timeOutMillis)

        if (!config.spec.restService.unsecured) {
            Spark.secure(config.spec.restService.keyStore,
                config.spec.restService.keyStorePassword,
                config.spec.restService.trustStore,
                config.spec.restService.trustStorePassword)
        }

        Spark.port(config.spec.restService.port)
        Spark.internalServerError((req, res) => {
            res.type('application/json')
            return '{\"status\": \"500\", \"message\":\"Internal server error\"}'
        })
        Spark.notFound((req, res) => {
            res.type('application/json')
            return '{\"status\": \"404\", \"message\":\"Not found\"}'
        })
    }

    start() {
        const ds = DSSelector.getDS()

        options('/*', (req, res) => {
            const accessControlRequestHeaders =
              req.headers('Access-Control-Request-Headers')
            if (accessControlRequestHeaders !== null) {
                res.header('Access-Control-Allow-Headers',
                  accessControlRequestHeaders)
            }

            const accessControlRequestMethod =
              req.headers('Access-Control-Request-Method')
            if (accessControlRequestMethod !== null) {
                res.header('Access-Control-Allow-Methods',
                  accessControlRequestMethod)
            }
            return 'OK'
        })

        path(config.system.apiPath, (r) => {
            before('/*', (req, res) => {
                res.header('Access-Control-Allow-Origin', '*')
                if (req.pathInfo().endsWith('/credentials') ||
                    req.pathInfo().endsWith('/token')) {
                    basicAuthFilter(req, res, new UsersAPI(ds))
                } else {
                    parameterAuthFilter(req, res, config.salt)
                }
            })

            // Its always running! Use to ping Routr server
            get('/system/status', (req, res) => '{\"status\": \"Up\"}')

            post('/system/status/:status', (req, res) => {
                switch (req.params(':status')) {
                    case 'down':
                        this.server.stop()
                        break;
                    case 'reload':
                        reloadConfig()
                        res.status(200)
                        return '{\"status\": \"200\", \"message\":\"Reloaded configuration from file.\"}'
                        break;
                    default:
                        res.status(400)
                        return '{\"status\": \"400\", \"message\":\"Bad Request\"}'
                }
            })

            get('/system/info', (req, res) => JSON.stringify(config.system))

            // Deprecated
            get('/credentials', (req, res) => getJWTToken(req, res,
                config.salt))

            get('/token', (req, res) => JSON.stringify(
                CoreUtils.buildResponse(Status.OK,
                    getJWTToken(req, res, config.salt))))

            get('/registry', (req, res) => JSON.stringify(
                CoreUtils.buildResponse(Status.OK,
                  this.nht.list().map(r => {
                    const reg = JSON.parse(r)
                    reg.regOnFormatted = moment(reg.registeredOn).fromNow()
                    return reg
                  })))
            )

            locationService(this.locator)



            resourcesService(new AgentsAPI(ds), 'Agent')
            resourcesService(new PeersAPI(ds), 'Peer')
            resourcesService(new DomainsAPI(ds), 'Domain')
            resourcesService(new GatewaysAPI(ds), 'Gateway')
            resourcesService(new NumbersAPI(ds), 'Number')
        })
    }

    stop() {
        LOG.info('Stopping Restful service')
        Spark.stop()
    }
}

module.exports = Rest