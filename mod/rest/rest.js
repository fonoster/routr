var Spark                     = Java.type('spark.Spark')
var LogManager                = Java.type('org.apache.logging.log4j.LogManager')
var BasicAuthenticationFilter = Java.type('com.qmetric.spark.authentication.BasicAuthenticationFilter')
var AuthenticationDetails     = Java.type('com.qmetric.spark.authentication.AuthenticationDetails')

function RestService(locationService, gateways, dids, domains, agents, peers, config) {
    let LOG = LogManager.getLogger()
    let credentials = config.rest
    Spark.port(config.rest.port)
    Spark.before(new BasicAuthenticationFilter("/*", new AuthenticationDetails(credentials.username, credentials.password)))
    let get = Spark.get

    get('/registry', function(request, response) {
        return locationService.listAllAsJSON()
    });

    get('/gateways', function(request, response) {
        return JSON.stringify(gateways)
    });

    get('/peers', function(request, response) {
        return JSON.stringify(peers)
    });

    get('/agents', function(request, response) {
        return JSON.stringify(agents)
    });

    get('/domains', function(request, response) {
        return JSON.stringify(domains)
    });

    get('/dids', function(request, response) {
        return JSON.stringify(dids)
    });

    this.start = function() {
        LOG.info("Starting Restful service on port " + config.rest.port)
        java.lang.Thread.currentThread().join();
    }
}