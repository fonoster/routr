/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'
import { Status } from 'resources/status'
import basicAuthFilter from 'rest/basic_auth_filter'
import getJWTToken from 'rest/jwt_token_generator'
import agentsService from 'rest/agents_service.js'
import peersService from 'rest/peers_service.js'
import domainsService from 'rest/domains_service.js'
import gatewaysService from 'rest/gateways_service.js'
import didsService from 'rest/dids_service.js'
import parameterAuthFilter from 'rest/parameter_auth_filter'

const Spark = Packages.spark.Spark
const get = Spark.get
const post = Spark.post
const put = Spark.put
const del = Spark.delete
const halt = Spark.halt
const before = Spark.before
const SecurityFilter = org.pac4j.sparkjava.SecurityFilter
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const BasicAuthenticationFilter = Packages.com.qmetric.spark.authentication.BasicAuthenticationFilter
const AuthenticationDetails = Packages.com.qmetric.spark.authentication.AuthenticationDetails

export default class Rest {

    constructor(server, locator, registry, dataAPIs, salt="0123456789012345678901234567890123456789") {
        const config = getConfig()
        this.rest = config.spec.services.rest
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
        this.salt = salt
        this.locator = locator
        this.registry = registry
    }

    start() {
        before("/credentials", new BasicAuthenticationFilter(
            new AuthenticationDetails(this.rest.credentials.username, this.rest.credentials.secret)))

        get("/credentials", (request, response) => getJWTToken(request, response, this.salt))

        before("/location",  (request, response) => parameterAuthFilter(request, response, this.salt))

        before("/registry",  (request, response) => parameterAuthFilter(request, response, this.salt))

        get('/location', (request, response) => this.locator.listAsJSON())

        get('/registry', (request, response) => this.registry.listAsJSON())

        agentsService(this.dataAPIs.AgentsAPI, this.salt)
        peersService(this.dataAPIs.PeersAPI, this.salt)
        domainsService(this.dataAPIs.DomainsAPI, this.salt)
        gatewaysService(this.dataAPIs.GatewaysAPI, this.salt)
        didsService(this.dataAPIs.DIDsAPI, this.salt)
    }

}