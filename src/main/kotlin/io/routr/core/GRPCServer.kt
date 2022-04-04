package io.routr.core

import io.grpc.Server
import io.grpc.ServerBuilder
import io.grpc.stub.StreamObserver
import io.routr.core.ControllerGrpc.ControllerImplBase
import java.io.IOException
import java.util.*
import kotlin.system.exitProcess
import org.apache.logging.log4j.LogManager
import org.graalvm.polyglot.Context

/**
 * @author Pedro Sanders
 * @since v1
 */
class GRPCServer(private val context: Context) {
  private var server: Server? = null
  fun start() {
    // TODO: Get this from config file :(
    val port = 50099
    try {
      server = ServerBuilder.forPort(port).addService(ControllerImpl(context)).build().start()
      LOG.debug("Starting gRPC service, listening on $port")
      Runtime.getRuntime()
          .addShutdownHook(
              object : Thread() {
                override fun run() {
                  LOG.debug("Shutting down gRPC service")
                  this@GRPCServer.stop()
                }
              }
          )
    } catch (ex: IOException) {
      LOG.fatal("Unable to start grpcService: " + ex.message)
      exitProcess(status = 1)
    }
  }

  fun stop() {
    if (server != null) {
      server!!.shutdown()
    }
  }

  @Throws(InterruptedException::class)
  fun blockUntilShutdown() {
    if (server != null) {
      server!!.awaitTermination()
    }
  }

  internal class ControllerImpl(private val context: Context) : ControllerImplBase() {
    override fun runCommand(req: CommandRequest, responseObserver: StreamObserver<CommandReply>) {
      val reply = CommandReply.newBuilder().setMessage(req.name).build()
      val context = context
      when (req.name) {
        "stop-server" -> {
          val timer = Timer()
          timer.schedule(
              object : TimerTask() {
                override fun run() {
                  context.eval("js", "server.stopIfReady()")
                }
              },
              1000,
              10 * 1000.toLong()
          )
        }
        "restart-server" -> {
          val timer = Timer()
          timer.schedule(
              object : TimerTask() {
                override fun run() {
                  context.eval("js", "server.stopIfReady(123)")
                }
              },
              1000,
              10 * 1000.toLong()
          )
        }
        "stop-server-now" -> {
          context.eval("js", "server.stop()")
        }
        "restart-server-now" -> {
          context.eval("js", "server.stop(123)")
        }
        "evict-all" -> {
          context.eval("js", "server.locator.evictAll()")
        }
      }
      responseObserver.onNext(reply)
      responseObserver.onCompleted()
    }
  }

  companion object {
    private val LOG = LogManager.getLogger(GRPCServer::class.java)
  }
}
