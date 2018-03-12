/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'
import { Status } from 'data_api/status'
import getJWTToken from 'rest/jwt_token_generator'
import agentsService from 'rest/agents_service.js'
import peersService from 'rest/peers_service.js'
import domainsService from 'rest/domains_service.js'
import gatewaysService from 'rest/gateways_service.js'
import didsService from 'rest/dids_service.js'
import parameterAuthFilter from 'rest/parameter_auth_filter'
import basicAuthFilter from 'rest/basic_auth_filter'

const Spark = Packages.spark.Spark
const get = Packages.spark.Spark.get
const post = Packages.spark.Spark.post
const before = Packages.spark.Spark.before
const path = Packages.spark.Spark.path
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const BasicAuthenticationFilter = Packages.com.qmetric.spark.authentication.BasicAuthenticationFilter
const AuthenticationDetails = Packages.com.qmetric.spark.authentication.AuthenticationDetails

export default class Rest {

    constructor(server, locator, registry, dataAPIs) {
        const config = getConfig()
        this.rest = config.spec.restService
        this.system = config.system

        LOG.info("Starting Restful service (port: " + this.rest.port + ", apiPath: '" + this.system.apiPath + "')")

        Spark.secure(config.spec.restService.keyStore,
            config.spec.restService.keyStorePassword,
                config.spec.restService.trustStore,
                    config.spec.restService.trustStorePassword)
        Spark.port(this.rest.port)
        Spark.internalServerError((req, res) => {
            res.type("application/json");
            return "{\"status\": \"500\", \"message\":\"Internal server error\"}";
        })
        Spark.notFound((req, res) => {
            res.type("application/json");
            return "{\"status\": \"404\", \"message\":\"Not found\"}";
        })
        this.dataAPIs = dataAPIs
        this.locator = locator
        this.registry = registry
        this.server = server
        this.config = config
    }

    start() {
        path(this.system.apiPath, (r) => {
            before("/credentials", (req, res) => basicAuthFilter(req, res, this.dataAPIs.UsersAPI))

            before("/system/status",  (req, res) => parameterAuthFilter(req, res, this.config.salt))

            before("/system/info",  (req, res) => parameterAuthFilter(req, res, this.config.salt))

            before("/location",  (req, res) => parameterAuthFilter(req, res, this.config.salt))

            before("/registry",  (req, res) => parameterAuthFilter(req, res, this.config.salt))

            // Its always running! Use to ping Sip IO server
            get('/system/status', (req, res) => "{\"status\": \"Up\"}")

            post('/system/status/:status', (req, res) => {
                // halt or error
                const status = req.params(":status")
                if (status.equals("down")) {
                    this.server.stop()
                } else {
                    res.status(401);
                    res.body("{\"status\": \"400\", \"message\":\"Bad Request\"}")
                }
            })

            get('/system/info', (req, res) => JSON.stringify(this.system))

            get("/credentials", (req, res) => getJWTToken(req, res, this.config.salt))

            get('/location', (req, res) => this.locator.listAsJSON())

            get('/registry', (req, res) => this.registry.listAsJSON())

            agentsService(this.dataAPIs.AgentsAPI, this.config.salt)
            peersService(this.dataAPIs.PeersAPI, this.config.salt)
            domainsService(this.dataAPIs.DomainsAPI, this.config.salt)
            gatewaysService(this.dataAPIs.GatewaysAPI, this.config.salt)
            didsService(this.dataAPIs.DIDsAPI, this.config.salt)
        })
    }

    stop() {
        LOG.info('Stopping Restful service')
        Spark.stop()
    }
}