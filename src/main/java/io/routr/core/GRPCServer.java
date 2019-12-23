package io.routr.core;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import java.io.IOException;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;
import javax.script.*;
import java.util.TimerTask;
import java.util.Timer;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class GRPCServer {
    private static final Logger LOG = LogManager.getLogger();
    private Server server;
    private ScriptEngine context;

    public GRPCServer(ScriptEngine context) {
        this.context = context;
    }

    public void start() throws IOException {
        // TODO: Get this from config file :(
        int port = 50099;
        server = ServerBuilder
          .forPort(port)
            .addService(new ControllerImpl(this.context))
              .build()
                .start();

        LOG.debug("Starting gRPC service, listening on " + port);

        Runtime.getRuntime().addShutdownHook(new Thread() {
            @Override
            public void run() {
              LOG.debug("Shutting down gRPC service");
              GRPCServer.this.stop();
            }
        });
    }

    public void stop() {
        if (server != null) {
            server.shutdown();
        }
    }

    public void blockUntilShutdown() throws InterruptedException {
        if (server != null) {
            server.awaitTermination();
        }
    }

    static class ControllerImpl extends ControllerGrpc.ControllerImplBase {
        private ScriptEngine context;

        public ControllerImpl(ScriptEngine context) {
            this.context = context;
        }

        @Override
        public void runCommand(CommandRequest req, StreamObserver<CommandReply> responseObserver) {
            CommandReply reply = CommandReply.newBuilder().setMessage(req.getName()).build();
            ScriptEngine context = this.context;
            try {
                if(req.getName().equals("stop-server")) {
                    Timer timer = new Timer();
                    timer.schedule(new TimerTask() {
                        @Override
                        public void run () {
                            try {
                              context.eval("server.stopIfReady()");
                            } catch(ScriptException e) {}
                        }
                    }, 1000, 10 * 1000);
                } else if(req.getName().equals("restart-server")) {
                    Timer timer = new Timer();
                    timer.schedule(new TimerTask() {
                        @Override
                        public void run () {
                            try {
                              // Sends restart code
                              context.eval("server.stopIfReady(123)");
                            } catch(ScriptException e) {}
                        }
                    }, 1000, 10 * 1000);
                } else if(req.getName().equals("stop-server-now")) {
                    context.eval("server.stop()");
                } else if(req.getName().equals("restart-server-now")) {
                    context.eval("server.stop(123)");
                } else if(req.getName().equals("evict-all")) {
                    context.eval("server.locator.evictAll()");
                }
            } catch(ScriptException e) {}
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        }
    }
}
