/**
 * @author Pedro Sanders
 * @since v1
 */
package io.routr.core;

import java.util.TimerTask;
import java.util.Timer;
import javax.script.*;

public class Launcher {
    private static String baseScript = String.join(
        System.getProperty("line.separator"),
        "var System = Java.type('java.lang.System')",
        "load(System.getProperty('user.dir') + '/libs/jvm-npm.js')"
    );

    private static String mainScript =
      "load(System.getProperty('user.dir') + '/libs/app.bundle.js')";

    private final static String mainScriptDev = String.join(
        System.getProperty("line.separator"),
        "load(System.getProperty('user.dir') + ",
        "'/node_modules/@routr/core/main.js')"
    );

    private final static String registryScript = String.join(
        System.getProperty("line.separator"),
        "load(System.getProperty('user.dir') + ",
        "'/node_modules/@routr/registry/registry.js')"
    );

    private final static String restScript = String.join(
        System.getProperty("line.separator"),
        "load(System.getProperty('user.dir') + ",
        "'/node_modules/@routr/rest/rest.js')"
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
            this.mainScript = this.mainScriptDev;
        }

        JSEngine engine = JSEngine.get(System.getenv("ROUTR_JS_ENGINE"));
  
        ScriptEngine mainCtx = createJSContext(engine);
        ScriptEngine registryCtx = createJSContext(engine);
        ScriptEngine restCtx = createJSContext(engine);

        // Runs the main thread
        mainCtx.eval(this.baseScript);
        mainCtx.eval(this.mainScript);

        // Runs the restful api threadPool
        restCtx.eval(this.baseScript);
        restCtx.eval(this.restScript);
        restCtx.eval("new Rest().start()");

        // Runs the main registry thread
        registryCtx.eval(this.baseScript);
        registryCtx.eval(this.registryScript);
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

    public ScriptEngine createJSContext(JSEngine e) throws ScriptException {
        ScriptEngine engine = engine = new ScriptEngineManager().getEngineByName(e.getName());
        Bindings bindings = engine.getBindings(ScriptContext.ENGINE_SCOPE);
        bindings.put("polyglot.js.allowIO", true);
        bindings.put("polyglot.js.allowAllAccess", true);
        bindings.put("polyglot.js.allowCreateThread", true);
        return engine;
    }

}
