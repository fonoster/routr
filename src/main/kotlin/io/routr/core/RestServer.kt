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
    val jsonString = mainCtx.eval("js", "restConfigJson").asString()
    val config = getConfig(jsonString)

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
                val ctx = createJSContext(REST_RUNNER)
                ctx.getBindings("js").putMember("req", req)
                ctx.getBindings("js").putMember("res", res)
                ctx.eval("js", "checkAuth(req, res)")
              } else {
                val ctx = createJSContext(REST_RUNNER)
                ctx.getBindings("js").putMember("req", req)
                ctx.getBindings("js").putMember("res", res)
                ctx.eval("js", "checkToken(req, res)")
              }
            }
          }
      )

      get("/token") { req, res ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.getBindings("js").putMember("req", req)
          ctx.getBindings("js").putMember("res", res)
          ctx.eval("js", "getToken(req, res)").asString()
        }
      }

      get("/credentials") { req, res ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.getBindings("js").putMember("req", req)
          ctx.getBindings("js").putMember("res", res)
          ctx.eval("js", "getCredentials(req, res)").asString()
        }
      }

      get("/system/status") { _, _ ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.eval("js", "getSystemStatus()").asString()
        }
      }

      post("/system/status:status") { req, res ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.getBindings("js").putMember("req", req)
          ctx.getBindings("js").putMember("res", res)
          ctx.eval("js", "postSystemStatus(req, res)").asString()
        }
      }

      get("/system/logs") { _, _ ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.eval("js", "getSystemLogs()").asString()
        }
      }

      get("/system/info") { _, _ ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.eval("js", "getSystemInfo()").asString()
        }
      }

      get("/system/config") { _, _ ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.eval("js", "getSystemConfig()").asString()
        }
      }

      put("/system/config") { req, _ ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.getBindings("js").putMember("req", req)
          ctx.eval("js", "putSystemConfig(req)").asString()
        }
      }

      get("/registry") { req, _ ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.getBindings("js").putMember("req", req)
          ctx.eval("js", "getRegistry(req)").asString()
        }
      }

      get("/location") { req, _ ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.getBindings("js").putMember("req", req)
          ctx.eval("js", "getLocation(req)").asString()
        }
      }

      delete("/location") { _, res ->
        run {
          val ctx = createJSContext(REST_RUNNER)
          ctx.getBindings("js").putMember("res", res)
          ctx.eval("js", "deleteLocation(req)").asString()
        }
      }

      registerResource("Domain")
      registerResource("Agent")
      registerResource("Gateway")
      registerResource("Number")
      registerResource("Peer")
    }
  }

  fun registerResource(resource: String) {
    val resBase = "/${resource}s".toLowerCase()
    val resByRef = "${resBase}/:ref"
    post(resBase) { req, res -> evalOperation("postResource", resource, req, res) }
    get(resBase) { req, res -> evalOperation("getResources", resource, req, res) }
    get(resByRef) { req, res -> evalOperation("getResource", resource, req, res) }
    delete(resByRef) { req, res -> evalOperation("delResource", resource, req, res) }
    put(resByRef) { req, res -> evalOperation("putResource", resource, req, res) }
  }

  fun evalOperation(operation: String, resource: String, req: Any, res: Any): String {
    val ctx = createJSContext(REST_RUNNER)
    ctx.getBindings("js").putMember("req", req)
    ctx.getBindings("js").putMember("res", res)
    ctx.getBindings("js").putMember("resource", resource)
    return ctx.eval("js", "${operation}(req, res, resource)").asString()
  }

  companion object {
    private val REST_RUNNER = "load(System.getProperty('user.dir') + '/libs/rest.bundle.js')"
    private val LOG = LogManager.getLogger()
  }
}
