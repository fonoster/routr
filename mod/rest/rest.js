/**
 * @author Pedro Sanders
 * @since v1
 */
load ('mod/core/config_util.js')
load('mod/resources/status.js')

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
    Spark.before(new BasicAuthenticationFilter('/*', new AuthenticationDetails(credentials.username, credentials.secret)))
    const get = Spark.get
    const post = Spark.post
    const put = Spark.put
    const del = Spark.delete
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

    post('/resources', (request, response) => {
        const data = request.body()
        const json = JSON.parse(data)
        let kind
        let result = {}

        // Is array or single then what kind is?
        if (Array.isArray(json)) {
            kind = json[0].kind
        } else {
            kind = json.kind
        }

        switch(kind) {
            case 'Agent':
                result = dataAPIs.getAgentsAPI().createFromJSONObj(data)
                break;
            case 'Domain':
                result = dataAPIs.getDomainsAPI().createFromJSONObj(data)
                break;
            case 'Gateway':
                result = dataAPIs.getGatewaysAPI().createFromJSONObj(data)
                break;
            case 'DID':
                result = dataAPIs.getDIDsAPI().createFromJSONObj(data)
                break;
            case 'Peer':
                result = dataAPIs.getPeersAPI().createFromJSONObj(data)
                break;
            default:
                result.status = Status.BAD_REQUEST
                result.message = 'Unknown resource type.'
        }

        return JSON.stringify(result)
    })

    put('/resources', (request, response) => {
        const data = request.body()
        const json = JSON.parse(data)
        let kind
        let result = {}

        // Is array or single then what kind is?
        if (Array.isArray(json)) {
            kind = json[0].kind
        } else {
            kind = json.kind
        }

        switch(kind) {
            case 'Agent':
                result = dataAPIs.getAgentsAPI().updateFromJSONObj(data)
                break;
            case 'Domain':
                result = dataAPIs.getDomainsAPI().updateFromJSONObj(data)
                break;
            case 'Gateway':
                result = dataAPIs.getGatewaysAPI().updateFromJSONObj(data)
                break;
            case 'DID':
                result = dataAPIs.getDIDsAPI().updateFromJSONObj(data)
                break;
            case 'Peer':
                result = dataAPIs.getPeersAPI().updateFromJSONObj(data)
                break;
            default:
                result.status = Status.BAD_REQUEST
                result.message = 'Unknown resource type.'
        }

        return JSON.stringify(result)
    })

    // This is for internal use, so is ok to go unconventional
    del('/resources/:type/:ref', (request, response) => {
        const type = request.params(":type")
        const ref = request.params(":ref")
        const filter = request.queryParams('filter')

        switch(type) {
            case 'agent':
                result = dataAPIs.getAgentsAPI().deleteAgents(ref, filter)
                break;
            case 'domain':
                result = dataAPIs.getDomainsAPI().deleteDomains(ref, filter)
                break;
            case 'gateway':
                result = dataAPIs.getGatewaysAPI().deleteGateways(ref, filter)
                break;
            case 'did':
                result = dataAPIs.getDIDsAPI().deleteDIDs(ref, filter)
                break;
            case 'peer':
                result = dataAPIs.getPeersAPI().deletePeers(ref, filter)
                break;
            default:
                result.status = Status.BAD_REQUEST
                result.message = 'Unknown resource type.'
        }

        return JSON.stringify(result)
    })

    post('/stop', (request, response) => {
        server.stop()
        return 'Done.'
    })
}