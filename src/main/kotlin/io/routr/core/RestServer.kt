package io.routr.core

import java.io.IOException
import java.lang.Exception
import java.util.*
import org.apache.logging.log4j.LogManager
import spark.Spark.*

/**
 * @author Pedro Sanders
 * @since v1
 */
class RestServer {
  @Throws(IOException::class, InterruptedException::class)
  fun start() {
    LOG.debug("Starting Restful service server")
    val mainCtx = createJSContext(REST_RUNNER)
    val rawConfig = mainCtx.eval("js", "JSON.stringify(getConfig())").toString()
    val jsonString = mainCtx.eval("js", "getRestConfigJson()").asString()
    mainCtx.close()
    val config = jsonStringToConfig(jsonString)

    LOG.info("Restful service server listening on port ${config.port}")
    LOG.debug("Restful service server configuration: $config")

    ipAddress(config.bindAddr)
    port(config.port)
    threadPool(config.maxThreads, config.minThreads, config.timeoutMillis)
    if (!config.unsecured) {
      secure(config.keyStore, config.keyStorePassword, config.trustStore, config.trustStorePassword)
    }

    initExceptionHandler({ e ->
      run {
        LOG.fatal("Unable to start restService: ${e.message}")
        System.exit(1)
      }
    })

    notFound({ _, res ->
      run {
        res.type("application/json")
        "{\"status\": \"404\", \"message\":\"Not found\"}"
      }
    })

    exception(
        Exception::class.java,
        { e, _, res ->
          run {
            res.type("application/json")
            if (e.message == "UNAUTHORIZED REQUEST") {
              res.status(401)
              res.body("{\"status\": \"401\", \"message\":\"Unauthorized\"}")
            } else {
              LOG.error(e.message)
              res.status(500)
              res.body("{\"status\": \"500\", \"message\":\"Internal server error\"}")
            }
            LOG.error(e)
          }
        }
    )

    options(
        "/*",
        { req, res ->
          run {
            val accessControlRequestHeaders = req.headers("Access-Control-Request-Headers")
            if (accessControlRequestHeaders !== null) {
              res.header("Access-Control-Allow-Headers", accessControlRequestHeaders)
            }

            val accessControlRequestMethod = req.headers("Access-Control-Request-Method")
            if (accessControlRequestMethod !== null) {
              res.header("Access-Control-Allow-Methods", accessControlRequestMethod)
            }
            "OK"
          }
        }
    )

    // Warning: Experimental
    // webSocket("${config.apiPath}/system/logs-ws", LogsHandler::class.java)

    path(config.apiPath) {
      before(
          "/*",
          { req, res ->
            run {
              res.header("Access-Control-Allow-Origin", "*")
              if (req.pathInfo().endsWith("/credentials") || req.pathInfo().endsWith("/token")) {
                evalOperation("checkAuth", req, res, rawConfig)
              } else {
                evalOperation("checkToken", req, res, rawConfig)
              }
            }
          }
      )

      get("/token") { req, res -> evalOperation("getToken", req, res, rawConfig) }
      get("/credentials") { req, res -> evalOperation("getCredentials", req, res, rawConfig) }
      get("/system/status") { req, res -> evalOperation("getSystemStatus", req, res) }
      post("/system/status/:status") { req, res -> evalOperation("postSystemStatus", req, res, rawConfig) }
      get("/system/logs") { req, res -> evalOperation("getSystemLogs", req, res) }
      get("/system/info") { req, res -> evalOperation("getSystemInfo", req, res, rawConfig) }
      get("/system/config") { req, res -> evalOperation("getSystemConfig", req, res, rawConfig) }
      put("/system/config") { req, res -> evalOperation("putSystemConfig", req, res) }
      get("/registry") { req, res -> evalOperation("getRegistry", req, res, rawConfig) }
      get("/location") { req, res -> evalOperation("getLocation", req, res, rawConfig) }
      delete("/location") { req, res -> evalOperation("deleteLocation", req, res, rawConfig) }
 
      registerResource("Domain", rawConfig)
      registerResource("Agent", rawConfig)
      registerResource("Gateway", rawConfig)
      registerResource("Number", rawConfig)
      registerResource("Peer", rawConfig)
    }
  }

  fun registerResource(resource: String, config: String) {
    val resBase = "/${resource}s".toLowerCase()
    val resByRef = "${resBase}/:ref"
    post(resBase) { req, res -> evalResourceOperation("postResource", config, resource, req, res) }
    delete(resByRef) { req, res -> evalResourceOperation("delResource", config, resource, req, res) }
    put(resByRef) { req, res -> evalResourceOperation("putResource", config, resource, req, res) }
    get(resBase) { req, res -> evalResourceOperation("getResources", config, resource, req, res) }
    get(resByRef) { req, res -> evalResourceOperation("getResource", config, resource, req, res) }
  }

  fun evalResourceOperation(operation: String, config: String, resource: String, req: Any, res: Any): String {
    val ctx = createJSContext(REST_RUNNER)
    ctx.getBindings("js").putMember("req", req)
    ctx.getBindings("js").putMember("res", res)
    ctx.getBindings("js").putMember("resource", resource)
    ctx.getBindings("js").putMember("config", config)
    val result = ctx.eval("js", "$operation(JSON.parse(config))(req, res, resource)").asString()
    ctx.close()

    LOG.debug("Evaluating operation $operation")
    LOG.debug("op is $operation")
    LOG.debug("result is $result")

    return result
  }

  fun evalOperation(operation: String, req: Any, res: Any, config: String ?= null): String {

    val ctx = createJSContext(REST_RUNNER)
    var op = "$operation(req, res)"
    ctx.getBindings("js").putMember("req", req)
    ctx.getBindings("js").putMember("res", res)
    if (config != null) {
      op = "$operation(JSON.parse(config))(req, res)"
      ctx.getBindings("js").putMember("config", config)
    }
    val result = ctx.eval("js", op).asString()

    LOG.debug("Evaluating operation $operation")
    LOG.debug("op is $op")
    LOG.debug("result is $result")

    ctx.close()
    return result
  }

  companion object {
    private val REST_RUNNER = "load(System.getProperty('user.dir') + '/libs/rest.bundle.js')"
    private val LOG = LogManager.getLogger(RestServer::class.java)
  }
}
