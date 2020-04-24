package io.routr.core

import io.grpc.ManagedChannel
import io.grpc.ManagedChannelBuilder
import io.grpc.StatusRuntimeException
import io.routr.core.ControllerGrpc.ControllerBlockingStub
import org.apache.logging.log4j.LogManager
import java.util.concurrent.TimeUnit

/**
 * @author Pedro Sanders
 * @since v1
 */
class GRPCClient internal constructor(private val channel: ManagedChannel) {
    private val blockingStub: ControllerBlockingStub = ControllerGrpc.newBlockingStub(channel)

    constructor(host: String?, port: Int) : this(ManagedChannelBuilder.forAddress(host, port).usePlaintext().build()) {}

    @Throws(InterruptedException::class)
    fun shutdown() {
        channel.shutdown().awaitTermination(5, TimeUnit.SECONDS)
    }

    fun run(name: String?) {
        val request = CommandRequest.newBuilder().setName(name).build()
        try {
            blockingStub.runCommand(request)
        } catch (e: StatusRuntimeException) {
            LOG.warn("RPC failed: {0}", e.status)
            return
        }
    }

    companion object {
        private val LOG = LogManager.getLogger()
    }

}