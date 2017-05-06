/**
 * @author Pedro Sanders
 * @since v1
 */
load ('mod/core/config_util.js')

function RestService(server, locationService, dataAPIs) {
    // For some weird reason this only works with var and not const or let
    var config = new ConfigUtil().getConfig()
    const Spark = Packages.spark.Spark
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const BasicAuthenticationFilter = Packages.com.qmetric.spark.authentication.BasicAuthenticationFilter
    const AuthenticationDetails = Packages.com.qmetric.spark.authentication.AuthenticationDetails
    const LOG = LogManager.getLogger()
    const credentials = config.rest

    Spark.port(config.rest.port)
    Spark.before(new BasicAuthenticationFilter('/*', new AuthenticationDetails(credentials.username, credentials.password)))

    const get = Spark.get
    const post = Spark.post
    // Is this a bug? For some reason I can not reach the object Spark from within the function stop
    const rStop = Spark.stop

    this.stop = () => {
        LOG.info('Stopping Restful service')
        rStop()
    }

    this.start = () => {
        LOG.info('Starting Restful service on port ' + config.rest.port)
        java.lang.Thread.currentThread().join()
    }

    get('/location', (request, response) => locationService.listAsJSON())

    get('/gateways/:filter', (request, response) => {
        const filter = request.params(":filter")
        const result = dataAPIs.getGatewaysAPI().getGateways(filter)
        return JSON.stringify(result)
    })

    get('/peers/:filter', (request, response) => {
        const filter = request.params(":filter")
        const result = dataAPIs.getPeersAPI().getPeers(filter)
        return JSON.stringify(result)
    })

    get('/agents/:filter', (request, response) => {
        const filter = request.params(":filter")
        const result = dataAPIs.getAgentsAPI().getAgents(filter)
        return JSON.stringify(result)
    })

    get('/domains/:filter', (request, response) => {
        const filter = request.params(":filter")
        const result = dataAPIs.getDomainsAPI().getDomains(filter)
        return JSON.stringify(result)
    })

    get('/dids/:filter', (request, response) => {
        const filter = request.params(":filter")
        const result = dataAPIs.getDIDsAPI().getDIDs(filter)
        return JSON.stringify(result)
    })

    post('/stop', (request, response) => {
        server.stop()
        return 'Done.'
    })
}