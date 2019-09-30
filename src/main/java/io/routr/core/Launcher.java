package io.routr.core;

import java.util.TimerTask;
import java.util.Timer;
import javax.script.*;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class Launcher {
    // Copied from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes#Polyfill
    public static final String NASHORN_POLYFILL_STRING_PROTOTYPE_INCLUDES = "if (!String.prototype.includes) { Object.defineProperty(String.prototype, 'includes', { value: function(search, start) { if (typeof start !== 'number') { start = 0 } if (start + search.length > this.length) { return false } else { return this.indexOf(search, start) !== -1 } } }) }";
    // Copied from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes#Polyfill
    public static final String NASHORN_POLYFILL_ARRAY_PROTOTYPE_INCLUDES  = "if (!Array.prototype.includes) { Object.defineProperty(Array.prototype, 'includes', { value: function(valueToFind, fromIndex) { if (this == null) { throw new TypeError('\"this\" is null or not defined'); } var o = Object(this); var len = o.length >>> 0; if (len === 0) { return false; } var n = fromIndex | 0; var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0); function sameValueZero(x, y) { return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y)); } while (k < len) { if (sameValueZero(o[k], valueToFind)) { return true; } k++; } return false; } }); }";

    private static String baseScript = String.join(
        System.getProperty("line.separator"),
        NASHORN_POLYFILL_STRING_PROTOTYPE_INCLUDES,
        NASHORN_POLYFILL_ARRAY_PROTOTYPE_INCLUDES,
        "var System = Java.type('java.lang.System')",
        "load(System.getProperty('user.dir') + '/libs/jvm-npm.js')",
        "load(System.getProperty('user.dir') + ",
        "'/libs/app.bundle.js')",
        "var Server = require('@routr/core/server')",
        "var Rest = require('@routr/rest/rest')",
        "var Registry = require('@routr/registry/registry')"
    );

    private final static String baseScriptDev = String.join(
        System.getProperty("line.separator"),
        "load(System.getProperty('user.dir') + ",
        "'/node_modules/@routr/core/server.js')"
    );

    static public void main(String... args) {
        try {
            new Launcher().launch();
        } catch(ScriptException ex) {
            System.out.println("Unable to run server: " + ex.getMessage());
        }
    }

    // TODO: Check Java version and show warning if version >= 11
    public void launch() throws ScriptException {
        String mode = System.getenv("ROUTR_LAUNCH_MODE");

        if (mode != null && mode.equalsIgnoreCase("dev")) {
            this.baseScript = this.baseScriptDev;
        }

        String engineName = System.getenv("ROUTR_JS_ENGINE") != null
          ? System.getenv("ROUTR_JS_ENGINE")
          : "graal.js";
        JSEngine engine = JSEngine.get(engineName);
        ScriptEngine mainCtx = createJSContext(engine);
        ScriptEngine registryCtx = createJSContext(engine);
        ScriptEngine restCtx = createJSContext(engine);

        // Runs the main thread
        mainCtx.eval(this.baseScript);
        mainCtx.eval("new Server().start()");

        // Runs the restful api threadPool
        restCtx.eval(this.baseScript);
        restCtx.eval("new Rest().start()");

        // Runs the main registry thread
        registryCtx.eval(this.baseScript);
        registryCtx.eval("var reg = new Registry()");

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
        }, 10000, 60 * 1000);
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
            System.out.println("Unable to run server [Invalid js engine => '"
              + eng.getName() + "']");
            System.exit(1);
        }
        return engine;
    }

}
