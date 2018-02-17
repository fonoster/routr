/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'
import { Status } from 'resources/status'
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
        this.rest = config.spec.services.rest
        this.system = config.system

        LOG.info('Starting Restful service on port ' + this.rest.port)
        Spark.secure(config.spec.services.rest.secure.keyStore,
            config.spec.services.rest.secure.keyStorePassword,
                config.spec.services.rest.secure.trustStore,
                    config.spec.services.rest.secure.trustStorePassword)
        Spark.port(this.rest.port)
        Spark.internalServerError((request, response) => {
            response.type("application/json");
            return "{\"status\": \"500\", \"message\":\"Internal server error\"}";
        })
        Spark.notFound((request, response) => {
            response.type("application/json");
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
            before("/credentials", (request, response) => basicAuthFilter(request, response, this.dataAPIs.UsersAPI))

            before("/system/status",  (request, response) => parameterAuthFilter(request, response, this.config.salt))

            before("/system/info",  (request, response) => parameterAuthFilter(request, response, this.config.salt))

            before("/location",  (request, response) => parameterAuthFilter(request, response, this.config.salt))

            before("/registry",  (request, response) => parameterAuthFilter(request, response, this.config.salt))

            // Its always running! Use to ping Sip IO server
            get('/system/status', (request, response) => "{\"status\": \"Up\"}")

            post('/system/status/:status', (request, response) => {
                // halt or error
                const status = request.params(":status")
                if (status.equals("down")) {
                    this.server.stop()
                } else {
                    response.status(401);
                    response.body("{\"status\": \"400\", \"message\":\"Bad Request\"}")
                }
            })

            get('/system/info', (request, response) => JSON.stringify(this.system))

            get("/credentials", (request, response) => getJWTToken(request, response, this.config.salt))

            get('/location', (request, response) => this.locator.listAsJSON())

            get('/registry', (request, response) => this.registry.listAsJSON())

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