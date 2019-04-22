/**
 * @author Pedro Sanders
 * @since v1
 */
import CoreUtils from '@routr/core/utils'
import getConfig from '@routr/core/config_util'
import { Status } from '@routr/core/status'
import getJWTToken from '@routr/rest/jwt_token_generator'
import resourcesService from '@routr/rest/resources_service'
import parameterAuthFilter from '@routr/rest/parameter_auth_filter'
import basicAuthFilter from '@routr/rest/basic_auth_filter'

const Spark = Packages.spark.Spark
const options = Packages.spark.Spark.options
const get = Packages.spark.Spark.get
const post = Packages.spark.Spark.post
const before = Packages.spark.Spark.before
const path = Packages.spark.Spark.path
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class Rest {

    constructor(server, locator, registry, dataAPIs) {
        const config = getConfig()
        this.rest = config.spec.restService
        this.system = config.system
        this.dataAPIs = dataAPIs
        this.locator = locator
        this.registry = registry
        this.server = server
        this.config = config

        LOG.info('Starting Restful service (port: ' + this.rest.port + ', apiPath: ' + this.system.apiPath + ')')

        Spark.ipAddress(this.rest.bindAddr)

        if(!this.rest.unsecured) {
            Spark.secure(config.spec.restService.keyStore,
                config.spec.restService.keyStorePassword,
                    config.spec.restService.trustStore,
                        config.spec.restService.trustStorePassword)
        }

        Spark.port(this.rest.port)
        Spark.internalServerError((req, res) => {
            res.type('application/json')
            return '{\"status\": \"500\", \"message\":\"Internal server error XXX\"}';
        })
        Spark.notFound((req, res) => {
            res.type('application/json')
            return '{\"status\": \"404\", \"message\":\"Not found\"}';
        })
    }

    start() {
        options('/*', (req, res) => {
              const accessControlRequestHeaders = req.headers('Access-Control-Request-Headers')
              if (accessControlRequestHeaders != null) {
                  res.header('Access-Control-Allow-Headers', accessControlRequestHeaders)
              }

              const accessControlRequestMethod = req.headers('Access-Control-Request-Method')
              if (accessControlRequestMethod != null) {
                  res.header('Access-Control-Allow-Methods', accessControlRequestMethod)
              }
              return 'OK'
        })

        path(this.system.apiPath, (r) => {
            before('/*', (req, res) => {
              res.header('Access-Control-Allow-Origin', '*')
              if (req.pathInfo().endsWith('/credentials')) {
                basicAuthFilter(req, res, this.dataAPIs.UsersAPI)
              } else {
                parameterAuthFilter(req, res, this.config.salt)
              }
            })

            // Its always running! Use to ping Sip IO server
            get('/system/status', (req, res) => '{\"status\": \"Up\"}')

            post('/system/status/:status', (req, res) => {
                // halt or error
                const status = req.params(':status')
                if (status.equals('down')) {
                    this.server.stop()
                } else {
                    res.status(401);
                    res.body('{\"status\": \"400\", \"message\":\"Bad Request\"}')
                }
            })

            get('/system/info', (req, res) => JSON.stringify(this.system))

            get('/credentials', (req, res) => getJWTToken(req, res, this.config.salt))

            get('/location', (req, res) => JSON.stringify(CoreUtils.buildResponse(Status.OK, this.locator.listAsJSON())))

            get('/registry', (req, res) => JSON.stringify(CoreUtils.buildResponse(Status.OK, this.registry.listAsJSON())))

            resourcesService(this.dataAPIs.AgentsAPI, 'Agent')
            resourcesService(this.dataAPIs.PeersAPI, 'Peer')
            resourcesService(this.dataAPIs.DomainsAPI, 'Domain')
            resourcesService(this.dataAPIs.GatewaysAPI, 'Gateway')
            resourcesService(this.dataAPIs.DIDsAPI, 'DID')
        })
    }

    stop() {
        LOG.info('Stopping Restful service')
        Spark.stop()
    }
}
