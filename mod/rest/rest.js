var Spark        = Java.type('spark.Spark')
var LogManager   = Java.type('org.apache.logging.log4j.LogManager')

function RestService(locationService, providers, peers, agents, dids, port=4567){
    let LOG = LogManager.getLogger()
    Spark.port(port)

    Spark.get('/originate', function(request, response) {
        return "Not yet implemented"
    });

    Spark.get('/registry', function(request, response) {
        return locationService.listAllAsJSON()
    });

    Spark.get('/providers', function(request, response) {
        return JSON.stringify(providers)
    });

    Spark.get('/peers', function(request, response) {
        return JSON.stringify(peers)
    });

    Spark.get('/agents', function(request, response) {
        return JSON.stringify(agents)
    });

    Spark.get('/dids', function(request, response) {
        return JSON.stringify(dids)
    });

    this.start = function() {
        LOG.info("Starting Restful service on port " + port)
        java.lang.Thread.currentThread().join();
    }
}