/**
 * @author Pedro Sanders
 * @since v1
 */
package io.routr.core;

import java.util.TimerTask;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;

import org.graalvm.polyglot.Context;

public class Launcher {
    private static String baseScript = String.join(
        System.getProperty("line.separator"),
        "var System = Java.type('java.lang.System')",
        "load(System.getProperty('user.dir') + '/libs/jvm-npm.js')"
    );

    private static String mainScript =
      "load(System.getProperty('user.dir') + '/libs/app.bundle.js')";

    private static String mainScriptDev = String.join(
        System.getProperty("line.separator"),
        "load(System.getProperty('user.dir') + ",
        "'/node_modules/@routr/core/main.js')"
    );

    private static String registryScript = String.join(
        System.getProperty("line.separator"),
        "load(System.getProperty('user.dir') + ",
        "'/node_modules/@routr/registry/registry.js')"
    );

    static public void main(String... args) {
        try {
            new Launcher().launch(baseScript, mainScript, registryScript);
        } catch(ScriptException ex) {
            System.out.println("Unable to run server: " + ex.getMessage());
        }
    }

    // TODO: Check Java version and show warning if version >= 11
    public void launch(String baseScript, String mainScript,
      String registryScript) throws ScriptException {
        String engine = System.getenv("ROUTR_JS_ENGINE");
        String mode = System.getenv("ROUTR_LAUNCH_MODE");

        if (mode != null && mode.equalsIgnoreCase("dev")) {
            mainScript = this.mainScriptDev;
        }

        if (engine == null || engine.equals("graal.js")) {
            launchWithGraalJS(baseScript, mainScript, registryScript);
        } else if (engine != null && engine.equals("nashorn")) {
            launchWithNashorn(baseScript, mainScript);
        } else {
            throw new RuntimeException("Invalid js engine: " + engine);
        }
    }

    public void launchWithNashorn(String baseScript, String mainScript) throws ScriptException {
        ScriptEngine engine = new ScriptEngineManager()
            .getEngineByName("nashorn");
        engine.eval(baseScript);
        engine.eval(mainScript);
    }

    public Context createGraalJSContext() {
        return Context
            .newBuilder()
            .option("js.nashorn-compat", "true")
            .allowExperimentalOptions(true)
            .allowIO(true)
            .allowAllAccess(true).build();
    }

    public void launchWithGraalJS(String baseScript,
        String mainScript, String registryScript) {
        Context mainCtx = createGraalJSContext();
        Context registryCtx = createGraalJSContext();

        // Runs the main thread
        mainCtx.eval("js", baseScript);
        mainCtx.eval("js", mainScript);

        // Runs the main registry thread
        registryCtx.eval("js", baseScript);
        registryCtx.eval("js", registryScript);

        java.util.Timer timer = new java.util.Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run () {
                registryCtx.eval("js", "new Registry().registerAll()");
            }
        }, 10000, 60 * 1000);
    }
}
