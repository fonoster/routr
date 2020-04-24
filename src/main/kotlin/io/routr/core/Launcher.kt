package io.routr.core

import io.routr.util.getVersion
import org.apache.logging.log4j.LogManager
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.HostAccess
import java.io.IOException
import java.util.*

/**
 * @author Pedro Sanders
 * @since v1
 */
class Launcher {
    @Throws(IOException::class, InterruptedException::class)
    fun launch() {
        val mainCtx = createJSContext(serverRunner, "server")
        val registryCtx = createJSContext(registryRunner, "reg")
        val routeLoaderCtx = createJSContext(routeLoaderRunner, "loader")
        createJSContext(restRunner, "nop")
        val server = GRPCServer(mainCtx)

        val timer = Timer()
        timer.schedule(object : TimerTask() {
            override fun run() {
                registryCtx.eval("js", "reg.registerAll()")
            }
        }, 10 * 1000.toLong(), 60 * 1000.toLong())

        timer.schedule(object : TimerTask() {
            override fun run() {
                routeLoaderCtx.eval("js", "loader.loadStaticRoutes()")
            }
        }, 0, 120 * 1000.toLong())
        server.start()
        server.blockUntilShutdown()
    }

    private fun createJSContext(src: String?, `var`: String?): Context {
        val ctx = Context.newBuilder("js")
            .allowExperimentalOptions(true)
            .allowIO(true)
            .allowHostClassLookup { true }
            .allowHostAccess(HostAccess.ALL)
            .allowCreateThread(true)
            .build()
        ctx.eval("js", baseScript)
        ctx.getBindings("js").putMember(`var`, null)
        ctx.eval("js", src)
        return ctx
    }

    companion object {
        private val LOG = LogManager.getLogger()
        private const val serverRunner = "load(System.getProperty('user.dir') + '/libs/server.bundle.js')"
        private const val routeLoaderRunner = "load(System.getProperty('user.dir') + '/libs/route_loader.bundle.js');"
        private const val registryRunner = "load(System.getProperty('user.dir') + '/libs/registry.bundle.js')"
        private const val restRunner = "load(System.getProperty('user.dir') + '/libs/rest.bundle.js')"
        private val baseScript = java.lang.String.join(
                System.getProperty("line.separator"),
                "var System = Java.type('java.lang.System')"
        )

        @Throws(IOException::class, InterruptedException::class)
        @JvmStatic
        fun main(args: Array<String>) {
            // Checks Java version and show error if 8 < version > 11
            val javaVersion = getVersion()
            if (javaVersion > 11 || javaVersion < 8) {
                LOG.fatal("Routr is only supported in Java versions 8 through 11")
                System.exit(1)
            }
            Launcher().launch()
        }
    }
}