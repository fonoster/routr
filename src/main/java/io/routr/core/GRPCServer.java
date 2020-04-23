package io.routr.core;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import org.graalvm.polyglot.Context;
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
    private Context context;

    public GRPCServer(Context context) {
        this.context = context;
    }

    public void start() {
        // TODO: Get this from config file :(
        int port = 50099;
        try {

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
        } catch(IOException ex) {
          LOG.fatal("Unable to start grpcService: " + ex.getMessage());
          System.exit(1);
        }
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
        private Context context;

        public ControllerImpl(Context context) {
            this.context = context;
        }

        @Override
        public void runCommand(CommandRequest req, StreamObserver<CommandReply> responseObserver) {
            CommandReply reply = CommandReply.newBuilder().setMessage(req.getName()).build();
            Context context = this.context;
            if(req.getName().equals("stop-server")) {
                Timer timer = new Timer();
                timer.schedule(new TimerTask() {
                    @Override
                    public void run () {
                        context.eval("js","server.stopIfReady()");
                    }
                }, 1000, 10 * 1000);
            } else if(req.getName().equals("restart-server")) {
                Timer timer = new Timer();
                timer.schedule(new TimerTask() {
                    @Override
                    public void run () {
                        context.eval("js","server.stopIfReady(123)");
                    }
                }, 1000, 10 * 1000);
            } else if(req.getName().equals("stop-server-now")) {
                context.eval("js","server.stop()");
            } else if(req.getName().equals("restart-server-now")) {
                context.eval("js","server.stop(123)");
            } else if(req.getName().equals("evict-all")) {
                context.eval("js","server.locator.evictAll()");
            }
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        }
    }
}
