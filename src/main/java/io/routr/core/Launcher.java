package io.routr.core;

import java.util.TimerTask;
import java.util.Timer;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.HostAccess;
import java.io.IOException;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class Launcher {
    private static final Logger LOG = LogManager.getLogger();
    private static String serverRunner = "load(System.getProperty('user.dir') + '/libs/server.bundle.js')";
    private static String routeLoaderRunner
        = "load(System.getProperty('user.dir') + '/libs/route_loader.bundle.js');";
    private static String restRunner = "load(System.getProperty('user.dir') + '/libs/rest.bundle.js')";
    private static String registryRunner = "load(System.getProperty('user.dir') + '/libs/registry.bundle.js')";
    private static String baseScript = String.join(
        System.getProperty("line.separator"),
        "var System = Java.type('java.lang.System')"
    );

    static public void main(String... args) throws IOException,
        InterruptedException  {
        // Checks Java version and show error if 8 < version > 11
        int javaVersion = getVersion();
        if (javaVersion > 11 || javaVersion < 8) {
            LOG.fatal("Routr is only supported in Java versions 8 through 11");
            System.exit(1);
        }
        new Launcher().launch();
    }

    public void launch() throws IOException,
        InterruptedException  {
        Context mainCtx = createJSContext(serverRunner, "server");
        Context registryCtx = createJSContext(registryRunner, "reg");
        Context restCtx = createJSContext(restRunner, "nop");
        Context routeLoaderCtx = createJSContext(routeLoaderRunner, "loader");
        GRPCServer server = new GRPCServer(mainCtx);

        Timer timer = new Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run () {
                registryCtx.eval("js","reg.registerAll()");
            }
        }, 10 * 1000, 60 * 1000);

        // TODO: This should be configurable
        timer.schedule(new TimerTask() {
            @Override
            public void run () {
                routeLoaderCtx.eval("js", "loader.loadStaticRoutes()");
            }
        }, 0, 120 * 1000);

        server.start();
        server.blockUntilShutdown();
    }

    public Context createJSContext(String src, String var) {
        Context ctx = Context.newBuilder("js")
            .allowExperimentalOptions(true)
            .allowIO(true)
            .allowHostClassLookup(s -> true)
            .allowHostAccess(HostAccess.ALL)
            .allowCreateThread(true)
            .build();
        ctx.eval("js", this.baseScript);
        ctx.getBindings("js").putMember(var, null);
        ctx.eval("js", src);
        return ctx;
    }

    private static int getVersion() {
        String version = System.getProperty("java.version");
        if(version.startsWith("1.")) {
            version = version.substring(2, 3);
        } else {
            int dot = version.indexOf(".");
            if(dot != -1) { version = version.substring(0, dot); }
        } return Integer.parseInt(version);
    }
}
