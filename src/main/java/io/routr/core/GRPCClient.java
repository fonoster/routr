package io.routr.core;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import java.util.concurrent.TimeUnit;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class GRPCClient {
    private static final Logger LOG = LogManager.getLogger();
    private final ManagedChannel channel;
    private final ControllerGrpc.ControllerBlockingStub blockingStub;

    public GRPCClient(String host, int port) {
        this(ManagedChannelBuilder.forAddress(host, port).usePlaintext().build());
    }

    GRPCClient(ManagedChannel channel) {
        this.channel = channel;
        blockingStub = ControllerGrpc.newBlockingStub(channel);
    }

    public void shutdown() throws InterruptedException {
        channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
    }

    public void run(String name) {
        CommandRequest request = CommandRequest.newBuilder().setName(name).build();
        CommandReply response;
        try {
            response = blockingStub.runCommand(request);
        } catch (StatusRuntimeException e) {
            LOG.warn("RPC failed: {0}", e.getStatus());
            return;
        }
    }
}
