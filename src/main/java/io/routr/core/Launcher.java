package io.routr.core;

import java.util.TimerTask;
import java.util.Timer;
import javax.script.*;
import java.io.IOException;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class Launcher {
    private static final Logger LOG = LogManager.getLogger();
    // Copied from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes#Polyfill
    public static final String NASHORN_POLYFILL_STRING_PROTOTYPE_INCLUDES = "if (!String.prototype.includes) { Object.defineProperty(String.prototype, 'includes', { value: function(search, start) { if (typeof start !== 'number') { start = 0 } if (start + search.length > this.length) { return false } else { return this.indexOf(search, start) !== -1 } } }) }";
    public static final String NASHORN_POLYFILL_ARRAY_PROTOTYPE_INCLUDES  = "if (!Array.prototype.includes) { Object.defineProperty(Array.prototype, 'includes', { value: function(valueToFind, fromIndex) { if (this == null) { throw new TypeError('\"this\" is null or not defined'); } var o = Object(this); var len = o.length >>> 0; if (len === 0) { return false; } var n = fromIndex | 0; var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0); function sameValueZero(x, y) { return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y)); } while (k < len) { if (sameValueZero(o[k], valueToFind)) { return true; } k++; } return false; } }); }";

    private static String serverRunner = "load(System.getProperty('user.dir') + '/libs/server.bundle.js')";
    private static String routeLoaderRunner
        = "load(System.getProperty('user.dir') + '/libs/route_loader.bundle.js');";
    private static String restRunner = "load(System.getProperty('user.dir') + '/libs/rest.bundle.js')";
    private static String registryRunner = "load(System.getProperty('user.dir') + '/libs/registry.bundle.js')";
    private static String baseScript = String.join(
        System.getProperty("line.separator"),
        NASHORN_POLYFILL_STRING_PROTOTYPE_INCLUDES,
        NASHORN_POLYFILL_ARRAY_PROTOTYPE_INCLUDES,
        "var System = Java.type('java.lang.System')"
    );
    private static ScriptEngine mainCtx;

    static public void main(String... args) throws IOException,
        InterruptedException  {
        // Checks Java version and show error if 8 < version > 11
        int javaVersion = getVersion();
        if (javaVersion > 11 || javaVersion < 8) {
            LOG.fatal("Routr is only supported in Java versions 8 through 11");
            System.exit(1);
        }
        try {
            new Launcher().launch();
        } catch(ScriptException ex) {
            LOG.fatal("Unable to run server: " + ex.getMessage());
        }
    }

    public void launch() throws ScriptException, IOException,
        InterruptedException  {
        String engineName = System.getenv("ROUTR_JS_ENGINE") != null
          ? System.getenv("ROUTR_JS_ENGINE")
          : "graal.js";
        JSEngine engine = JSEngine.get(engineName);
        ScriptEngine mainCtx = createJSContext(engine);
        ScriptEngine registryCtx = createJSContext(engine);
        ScriptEngine restCtx = createJSContext(engine);
        ScriptEngine routeLoaderCtx = createJSContext(engine);

        GRPCServer server = new GRPCServer(mainCtx);

        // Runs the main thread
        mainCtx.eval(this.baseScript);
        mainCtx.put("server", null);
        mainCtx.eval(serverRunner);

        // Runs the route loader
        routeLoaderCtx.eval(this.baseScript);
        routeLoaderCtx.put("loader", null);
        routeLoaderCtx.eval(routeLoaderRunner);

        // Runs the restful api threadPool
        restCtx.eval(this.baseScript);
        restCtx.eval(restRunner);
        // Runs the main registry thread
        registryCtx.eval(this.baseScript);
        registryCtx.put("reg", null);
        registryCtx.eval(registryRunner);

        Timer timer = new Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run () {
                try {
                    registryCtx.eval("reg.registerAll()");
                } catch(ScriptException e) {
                    // ?
                }
            }
        }, 10 * 1000, 60 * 1000);

        // TODO: This should be configurable
        timer.schedule(new TimerTask() {
            @Override
            public void run () {
                try {
                    routeLoaderCtx.eval("loader.loadStaticRoutes()");
                } catch(ScriptException e) {}
            }
        }, 0, 120 * 1000);

        server.start();
        server.blockUntilShutdown();
    }

    public ScriptEngine createJSContext(JSEngine eng) throws ScriptException {
        ScriptEngine engine = null;
        try {
            engine = new ScriptEngineManager().getEngineByName(eng.getName());
            Bindings bindings = engine.getBindings(ScriptContext.ENGINE_SCOPE);
            bindings.put("polyglot.js.allowIO", true);
            bindings.put("polyglot.js.allowAllAccess", true);
            bindings.put("polyglot.js.allowCreateThread", true);
        } catch(NullPointerException e) {
            LOG.fatal("Unable to run server [Invalid js engine => '"
              + eng.getName() + "']");
            System.exit(1);
        }
        return engine;
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
